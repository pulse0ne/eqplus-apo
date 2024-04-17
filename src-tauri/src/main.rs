// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod errors;
mod filters;
#[cfg(windows)]
mod win32;
#[cfg(not(windows))]
mod dev;

use errors::{AppError, ErrorType};
use filters::{FilterBank, DeviceFilterMapping};
use std::{path::Path, fs::{self}, sync::Mutex};
use tauri::generate_handler;
use simple_logger::SimpleLogger;
use log::{LevelFilter, info, warn, debug};
#[cfg(windows)]
use win32::device::DeviceInfo;
#[cfg(windows)]
use win32::config::get_equalizer_apo_config_dir;

#[cfg(not(windows))]
use dev::device::DeviceInfo;
#[cfg(not(windows))]
use dev::config::get_equalizer_apo_config_dir;

use crate::filters::mapping_to_apo;

const E_APO_CONFIG: &str = "config.txt";
const EQPLUS_CONFIG: &str = "eqplus.txt";
const INCLUDE_LINE: &str = "Include: eqplus.txt";

#[derive(Default)]
struct AppState {
    config_dir: Mutex<String>,
    mapping: Mutex<DeviceFilterMapping>,
}

struct ErrorState {
    error: AppError
}

fn check_config_dir(state: &AppState) -> Result<(), AppError> {
    info!("checking config dir...");
    let dir_from_registry = get_equalizer_apo_config_dir().map_err(|e| {
        warn!("Invalid config directory: {}", e);
        match e.err_type {
            ErrorType::RegistryError => AppError { err_type: e.err_type, message: "Could not read config directory from registry. Is EqualizerAPO installed?".to_string() },
            _ => e
        }
    })?;
    debug!("config dir: {}", dir_from_registry);
    let path_to_config = Path::new(dir_from_registry.as_str()).join(EQPLUS_CONFIG);
    if !path_to_config.exists() {
        return Err(AppError { err_type: ErrorType::InvalidConfigDirectory, message: "Config directory was read from registry, but no config.txt file was found in it!".to_string() });
    }
    *state.config_dir.lock().unwrap() = dir_from_registry;
    info!("...config dir is ok");
    Ok(())
}

fn init_eqplus_config(state: &AppState) -> Result<(), AppError> {
    info!("initializing {}...", EQPLUS_CONFIG);
    let mut mapping: DeviceFilterMapping = FilterBank::default();
    let config_dir = state.config_dir.lock().unwrap();
    let path = Path::new(config_dir.as_str()).join(EQPLUS_CONFIG);
    if path.exists() {
        let raw = fs::read_to_string(path)?;
        mapping = FilterBank::from_apo_raw(raw.as_str())?;
        info!("...{} file loaded successfully", EQPLUS_CONFIG);
    } else {
        fs::write(path, filters::mapping_to_apo(&mapping))?;
        info!("...{} file written successfully", EQPLUS_CONFIG);
    }
    *state.mapping.lock().unwrap() = mapping.clone();
    Ok(())
}

fn check_config_file(state: &AppState) -> Result<(), AppError> {
    info!("checking config file for include line...");
    let config_dir = state.config_dir.lock().unwrap();
    let path = Path::new(config_dir.as_str()).join(E_APO_CONFIG);
    let apo_config = fs::read_to_string(path.clone())?; // TODO: handle this better?
    if !apo_config.contains(INCLUDE_LINE) {
        let augmented = format!("{}\n{}", apo_config, INCLUDE_LINE);
        fs::write(path, augmented)?;
    }
    info!("...config file is ok");
    Ok(())
}

#[tauri::command]
fn get_error(err_state: tauri::State<'_, ErrorState>) -> AppError {
    return err_state.error.clone();
}

#[tauri::command]
async fn show_main<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::Window<R>) {
    let main = tauri::WindowBuilder::new(
        &app, 
        "main",
        tauri::WindowUrl::App("index.html".into())
    )
    .center()
    .title("eq+")
    .build()
    .unwrap();

    main.show().unwrap();
    window.close().unwrap();
}

#[tauri::command]
async fn get_state(state: tauri::State<'_, AppState>) -> Result<DeviceFilterMapping, AppError> {
    Ok(state.mapping.lock().unwrap().clone())
}

#[tauri::command]
async fn modify_filter(device: String, filter: filters::FilterParams, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    debug!("modifying filter {} for device {}", filter.id, device);
    let mappings = &mut state.mapping.lock().unwrap();
    let device_mapping = mappings.get_mut(&device).ok_or(AppError{ err_type: ErrorType::BadArguments, message: format!("Could not find device with name {}", device) })?;
    let new_filters: Vec<filters::FilterParams> = device_mapping.eq.filters
        .iter()
        .map(|f| {
            if f.id == filter.id {
                filter.clone()
            } else {
                f.clone()
            }
        })
        .collect();

    device_mapping.eq.filters = new_filters;

    let path = state.config_dir.lock().unwrap();
    update_config_file(&path, mappings)?;
    Ok(())
}

#[tauri::command]
async fn add_filter(device: String, filter: filters::FilterParams, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mappings = &mut state.mapping.lock().unwrap();
    let device_mapping = mappings.get_mut(&device).ok_or(AppError{ err_type: ErrorType::BadArguments, message: format!("Could not find device with name {}", device)})?;
    device_mapping.eq.filters.push(filter);
    let path = state.config_dir.lock().unwrap();
    update_config_file(&path, mappings)?;
    Ok(())
}

#[tauri::command]
async fn remove_filter(device: String, id: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mappings = &mut state.mapping.lock().unwrap();
    let device_mapping = mappings.get_mut(&device).ok_or(AppError{ err_type: ErrorType::BadArguments, message: format!("Could not find device with name {}", device)})?;
    let new_filters = device_mapping.eq.filters
        .clone()
        .into_iter()
        .filter(|x| x.id == id)
        .collect();
    device_mapping.eq.filters = new_filters;
    let path = state.config_dir.lock().unwrap();
    update_config_file(&path, mappings)?;
    Ok(())
}

#[tauri::command]
async fn modify_preamp(device: String, preamp: f64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mappings = &mut state.mapping.lock().unwrap();
    let device_mapping = mappings.get_mut(&device).ok_or(AppError{ err_type: ErrorType::BadArguments, message: format!("Could not find device with name {}", device)})?;
    device_mapping.eq.preamp = preamp;
    let path = state.config_dir.lock().unwrap();
    update_config_file(&path, mappings)?;
    Ok(())
}

#[tauri::command]
async fn query_devices() -> Result<Vec<DeviceInfo>, AppError> {
    DeviceInfo::enumerate()
}

#[tauri::command]
fn log_bridge(level: String, message: String) {
    let log_level = match level.as_str() {
        "debug" => log::Level::Debug,
        "info" => log::Level::Info,
        "warn" => log::Level::Warn,
        "error" => log::Level::Error,
        _ => log::Level::Info,
    };
    log::log!(target: "bridge", log_level, "{}", message);
}

#[tauri::command]
fn quit(reason: String, app_handle: tauri::AppHandle) {
    println!("Quitting with reason: {}", reason);
    app_handle.exit(0);
}

fn update_config_file(path: &str, mappings: &DeviceFilterMapping) -> Result<(), AppError> {
    fs::write(Path::new(path).join(EQPLUS_CONFIG), mapping_to_apo(mappings))?;
    Ok(())
}

fn initialize(state: &AppState) -> Result<(), AppError> {
    println!("Initializing...");
    // return Err(AppError{ err_type: ErrorType::InvalidConfigDirectory, message: "Invalid config directory!".into() });
    check_config_dir(state)?;
    init_eqplus_config(state)?;
    check_config_file(state)?;
    Ok(())
}

fn show_error_page(e: AppError) {
    let err_state = ErrorState{ error: e };
    let app = tauri::Builder::default()
        .manage(err_state)
        .invoke_handler(generate_handler![get_error])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    tauri::WindowBuilder::new(
        &app,
        "Error",
        tauri::WindowUrl::App("error.html".into())
    )
        .center()
        .inner_size(400f64, 200f64)
        .title("eq+ error")
        .build()
        .expect("failed to build window")
        .show()
        .expect("failed to show error");
    app.run(|_, _| {});
}

fn show_main_page(state: AppState) {
    let app = tauri::Builder::default()
        .manage(state)
        .invoke_handler(generate_handler![
            show_main,
            get_state,
            modify_filter,
            add_filter,
            remove_filter,
            modify_preamp,
            query_devices,
            log_bridge,
            quit,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    tauri::WindowBuilder::new(
        &app,
        "main",
        tauri::WindowUrl::App("index.html".into())
    )
        .center()
        .title("eq+")
        .build()
        .expect("failed to build window")
        .show()
        .expect("failed to show window");
    app.run(|_, _| {});
}

fn main() {
    SimpleLogger::new().with_level(LevelFilter::Debug).init().unwrap();

    let state = AppState::default();

    match initialize(&state) {
        Err(e) => show_error_page(e),
        Ok(_) => show_main_page(state)
    };
}
