use windows::Win32::System::Registry::{HKEY, RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY_CLASSES_ROOT, HKEY_CURRENT_CONFIG, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, HKEY_USERS, REG_SAM_FLAGS, KEY_QUERY_VALUE, KEY_WOW64_64KEY, REG_VALUE_TYPE, REG_SZ};
use windows::Win32::System::Com::StringFromCLSID;
use windows::Win32::Foundation::MAX_PATH;
use windows::core::{GUID, HSTRING};

use crate::errors::{ErrorType, AppError};

pub fn read_value(key: &str, value: &str) -> Result<String, AppError> {
    let key_handle = open_key(key, KEY_QUERY_VALUE | KEY_WOW64_64KEY)?;
    let mut dtype = REG_VALUE_TYPE::default();
    let mut buf = [0u16; MAX_PATH as usize];
    let mut buf_size = buf.len() as u32;

    unsafe {
        let status = RegQueryValueExW(key_handle, &HSTRING::from(value), None, Some(&mut dtype), Some(buf.as_mut_ptr().cast()), Some(&mut buf_size));
        RegCloseKey(key_handle);
        if status.is_err() {
            return Err(AppError { err_type: ErrorType::RegistryError, message: format!("Error reading registry value") });
        }
        if dtype != REG_SZ {
            return Err(AppError { err_type: ErrorType::RegistryError, message: format!("Registry value was the wrong type") });
        }

        Ok(String::from_utf16_lossy(&buf[0..buf_size as usize]).trim_end_matches(0 as char).to_string())
    }
}

pub fn value_exists(key: &str, value: &str) -> Result<bool, AppError> {
    let key_handle = open_key(key, KEY_QUERY_VALUE | KEY_WOW64_64KEY)?;
    let mut dtype = REG_VALUE_TYPE::default();

    unsafe {
        let status = RegQueryValueExW(key_handle, &HSTRING::from(value), None, Some(&mut dtype), None, None);
        RegCloseKey(key_handle);
        Ok(status.is_ok())
    }
}

// pub fn key_exists(key: &str) -> Result<bool, AppError> {
//     let (sub_key, root_key) = split_key(key)?;
//     let key_handle = &mut HKEY::default();
//     unsafe {
//         let status = RegOpenKeyExW(root_key, &HSTRING::from(sub_key), 0, KEY_QUERY_VALUE | KEY_WOW64_64KEY, key_handle);
//         if status.is_ok() {
//             RegCloseKey(*key_handle);
//             return Ok(true);
//         }
//         return Ok(false);
//     }
// }

pub fn get_guid_string(guid: GUID) -> Result<String, AppError> {
    unsafe {
        let result = StringFromCLSID(&guid).map_err(|_| {
            AppError { err_type: ErrorType::RegistryError, message: format!("Failed to convert GUID to string" )}
        })?;
        return Ok(result.to_string().unwrap());
    }
}

pub fn open_key(key: &str, sam_desired: REG_SAM_FLAGS) -> Result<HKEY, AppError> {
    let (sub_key, root_key) = split_key(key)?;

    let key_handle = &mut HKEY::default();
    unsafe {
        let status = RegOpenKeyExW(root_key, &HSTRING::from(sub_key), 0, sam_desired, key_handle);
        if status.is_err() {
            return Err(AppError { err_type: ErrorType::RegistryError, message: format!("Error opening registry key {}", key) });
        }
    }
    Ok(*key_handle)
}

pub fn split_key(key: &str) -> Result<(String, HKEY), AppError> {
    let pos = match key.find("\\") {
        Some(t) => t,
        None => return Err(AppError { err_type: ErrorType::RegistryError, message: format!("Registry key was an invalid format: {}", key) })
    };

    let root_part = &key[0..pos];
    let path_part = &key[pos+1..];

    let p = root_part.to_uppercase();
    let root_key = match p.as_str() {
        "HKEY_CLASSES_ROOT" => HKEY_CLASSES_ROOT,
        "HKEY_CURRENT_CONFIG" => HKEY_CURRENT_CONFIG,
        "HKEY_CURRENT_USER" => HKEY_CURRENT_USER,
        "HKEY_LOCAL_MACHINE" => HKEY_LOCAL_MACHINE,
        "HKEY_USERS" => HKEY_USERS,
        _ => return Err(AppError { err_type: ErrorType::RegistryError, message: format!("Unexpected root key {}", root_part) })
    };
    return Ok((String::from(path_part), root_key));
}
