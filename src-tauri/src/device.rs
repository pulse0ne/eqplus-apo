//! adapted from cpal

use std::{slice, ffi::OsString, os::windows::prelude::OsStringExt};

use once_cell::sync::Lazy;
use serde::Serialize;
use windows::Win32::Media::Audio::{self, PKEY_AudioEndpoint_GUID};
use windows::Win32::Media::Audio::Apo::{PKEY_FX_PreMixEffectClsid, PKEY_FX_PostMixEffectClsid, PKEY_FX_StreamEffectClsid, PKEY_FX_ModeEffectClsid, PKEY_FX_EndpointEffectClsid};
use windows::Win32::System::Com::{self, CLSIDFromString, StructuredStorage, STGM_READ, VT_LPWSTR};
use windows::Win32::Devices::Properties;
use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, PROPERTYKEY};
use windows::core::{GUID, HSTRING};

use crate::{errors::{AppError, ErrorType}, registry::{self}};
use crate::com;

const EQUALIZERAPO_PRE_MIX_GUID: GUID = GUID::from_u128(0xeacd2258_fcac_4ff4_b36d_419e924a6d79);
const EQUALIZERAPO_POST_MIX_GUID: GUID = GUID::from_u128(0xec1cc9ce_faed_4822_828a_82a81a6f018f);


/// Wrapper because of that stupid decision to remove `Send` and `Sync` from raw pointers.
#[derive(Clone)]
struct IAudioClientWrapper(Audio::IAudioClient);
unsafe impl Send for IAudioClientWrapper {}
unsafe impl Sync for IAudioClientWrapper {}

static ENUMERATOR: Lazy<Enumerator> = Lazy::new(|| {
    // COM initialization is thread local, but we only need to have COM initialized in the
    // thread we create the objects in
    com::com_initialized();

    // building the devices enumerator object
    unsafe {
        let enumerator = Com::CoCreateInstance::<_, Audio::IMMDeviceEnumerator>(
            &Audio::MMDeviceEnumerator,
            None,
            Com::CLSCTX_ALL,
        )
        .unwrap();

        Enumerator(enumerator)
    }
});

/// Send/Sync wrapper around `IMMDeviceEnumerator`.
struct Enumerator(Audio::IMMDeviceEnumerator);

unsafe impl Send for Enumerator {}
unsafe impl Sync for Enumerator {}


#[derive(Clone, Serialize)]
pub struct DeviceInfo {
    pub guid: String,
    pub name: String,
    pub apo_installed: bool,
}

impl DeviceInfo {
    #[cfg(target_os = "windows")]
    pub fn enumerate() -> Result<Vec<DeviceInfo>, AppError> {
        unsafe {
            let device_collection = ENUMERATOR
                .0
                .EnumAudioEndpoints(Audio::eRender, Audio::DEVICE_STATE_ACTIVE)
                .map_err(|_| {
                    AppError{ err_type: ErrorType::GenericIoError, message: format!("Failed to enumerate audio endpoints") }
                })?;

            let count = device_collection.GetCount().map_err(|_| {
                AppError{ err_type: ErrorType::GenericIoError, message: format!("Failed to count devices from collection") }
            })?;

            let mut devices: Vec<DeviceInfo> = Vec::new();

            for i in 0..count {
                let device = match device_collection.Item(i) {
                    Ok(d) => d,
                    Err(_) => continue
                };

                // Open the device's property store.
                let property_store = device
                    .OpenPropertyStore(STGM_READ)
                    .expect("could not open property store");

                let device_name = read_device_property(&property_store, &Properties::DEVPKEY_Device_FriendlyName as *const _ as *const _)?;
                let device_guid = read_device_property(&property_store, &PKEY_AudioEndpoint_GUID as *const _ as *const _)?;

                let mut installed = false;

                let key_path = format!("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{}", device_guid.to_lowercase());
                for fx_prop_key in APO_FX_GUIDS {
                    let fx_guid = fx_prop_key_as_string(fx_prop_key)?;
                    let path = format!("{}{}", key_path, "\\FxProperties");
                    if registry::value_exists(path.as_str(), fx_guid.as_str()).unwrap_or(false) {
                        let apo_guid_string = registry::read_value(path.as_str(), fx_guid.as_str())?;
                        let guid = CLSIDFromString(&HSTRING::from(apo_guid_string)).map_err(|_| {
                            AppError { err_type: ErrorType::GenericIoError, message: format!("Failed to get GUID from string") }
                        })?;
                        if guid == EQUALIZERAPO_PRE_MIX_GUID || guid == EQUALIZERAPO_POST_MIX_GUID {
                            installed = true;
                            break;
                        }
                    }
                }

                devices.push(DeviceInfo { guid: device_guid.to_lowercase(), name: device_name, apo_installed: installed });
            }
            return Ok(devices);
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn enumerate() -> Result<Vec<DeviceInfo>, AppError> {
        let dummy_device = DeviceInfo {
            guid: "00000000-0000-0000-0000-000000000000".to_string(),
            name: "Dummy Device".to_string(),
            apo_installed: true
        };
        return vec![dummy_device];
    }
}

const APO_FX_GUIDS: &'static [PROPERTYKEY] = &[
    PKEY_FX_PreMixEffectClsid,
    PKEY_FX_PostMixEffectClsid,
    PKEY_FX_StreamEffectClsid,
    PKEY_FX_ModeEffectClsid,
    PKEY_FX_EndpointEffectClsid
];

fn fx_prop_key_as_string(prop_key: &PROPERTYKEY) -> Result<String, AppError> {
        let s = registry::get_guid_string(prop_key.fmtid)?;
        Ok(format!("{},{}", s.to_lowercase(), prop_key.pid))
}

fn read_device_property(store: &IPropertyStore, key: *const PROPERTYKEY) -> Result<String, AppError> {
    unsafe {
        let mut property_value = store
        .GetValue(key)
        .map_err(|err| {
            let msg =
                format!("failed to retrieve value from property store: {}", err);
            AppError{ err_type: ErrorType::GenericIoError, message: msg }
        })?;

        let prop_variant = &property_value.Anonymous.Anonymous;

        if prop_variant.vt != VT_LPWSTR {
            let msg = format!(
                "property store produced invalid data: {:?}",
                prop_variant.vt
            );
            return Err(AppError{ err_type: ErrorType::GenericIoError, message: msg });
        }
        let ptr_utf16 = *(&prop_variant.Anonymous as *const _ as *const *const u16);

        // Find the length of the value
        let mut len = 0;
        while *ptr_utf16.offset(len) != 0 {
            len += 1;
        }

        // Create the utf16 slice and convert it into a string.
        let value_slice = slice::from_raw_parts(ptr_utf16, len as usize);
        let value_os_string: OsString = OsStringExt::from_wide(value_slice);
        let value_string = match value_os_string.into_string() {
            Ok(string) => string,
            Err(os_string) => os_string.to_string_lossy().into(),
        };

        // Clean up the property.
        StructuredStorage::PropVariantClear(&mut property_value).ok();

        Ok(value_string)
    }
}
