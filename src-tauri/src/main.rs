// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use errors::{AppError, ErrorType};
use filters::EqState;
use std::{path::Path, fs::{self}, sync::Mutex};
use tauri::generate_handler;

mod errors;
mod filters;

const E_APO_CONFIG: &str = "config.txt";
const EQPLUS_CONFIG: &str = "eqplus.txt";
const INCLUDE_LINE: &str = "Include: eqplus.txt";

#[derive(Default)]
struct AppState {
    config_dir: Mutex<String>,
    eq_state: Mutex<EqState>,
}

#[tauri::command]
fn check_config_dir(config_dir: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let path = Path::new(config_dir.as_str());
    if !path.exists() || !path.join(E_APO_CONFIG).exists() {
        return Err(AppError {
            err_type: ErrorType::InvalidConfigDirectory,
            message: format!("{} is not a valid EqualizerAPO config directory", path.display())
        });
    }
    *state.config_dir.lock().unwrap() = config_dir.into();
    Ok(())
}

#[tauri::command]
fn init_eqplus_config(state: tauri::State<'_, AppState>) -> Result<EqState, AppError> {
    let mut eq_state: EqState = EqState::default();
    let config_dir = state.config_dir.lock().unwrap();
    let path = Path::new(config_dir.as_str()).join(EQPLUS_CONFIG);
    if path.exists() {
        let raw = fs::read_to_string(path)?;
        eq_state = EqState::from_apo_raw(raw)?;
    } else {
        fs::write(path, eq_state.to_apo())?;
    }
    *state.eq_state.lock().unwrap() = eq_state.clone();
    Ok(eq_state)
}

#[tauri::command]
fn check_config_file(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let config_dir = state.config_dir.lock().unwrap();
    let path = Path::new(config_dir.as_str()).join(E_APO_CONFIG);
    let apo_config = fs::read_to_string(path.clone())?;
    if !apo_config.contains(INCLUDE_LINE) {
        let augmented = format!("{}\n{}", apo_config, INCLUDE_LINE);
        fs::write(path, augmented)?;
    }
    Ok(())
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
fn get_state(state: tauri::State<'_, AppState>) -> EqState {
    state.eq_state.lock().unwrap().clone()
}

#[tauri::command]
fn modify_filter(filter: filters::FilterParams, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    println!("modifying filter {}", filter.id);
    let eq_state = &mut state.eq_state.lock().unwrap();
    let new_filters: Vec<filters::FilterParams> = eq_state.filters
        .iter()
        .map(|f| {
            if f.id == filter.id {
                filter.clone()
            } else {
                f.clone()
            }
        })
        .collect();

    eq_state.filters = new_filters;

    let path = state.config_dir.lock().unwrap();
    fs::write(Path::new(path.as_str()).join(EQPLUS_CONFIG), eq_state.to_apo())?;
    Ok(())
}

#[tauri::command]
fn add_filter(filter: filters::FilterParams, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let eq_state = &mut state.eq_state.lock().unwrap();
    eq_state.filters.push(filter);
    let path = state.config_dir.lock().unwrap();
    fs::write(Path::new(path.as_str()).join(EQPLUS_CONFIG), eq_state.to_apo())?;
    Ok(())
}

#[tauri::command]
fn remove_filter(id: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let eq_state = &mut state.eq_state.lock().unwrap();
    let new_filters = eq_state.filters
        .clone()
        .into_iter()
        .filter(|x| x.id == id)
        .collect();
    eq_state.filters = new_filters;
    let path = state.config_dir.lock().unwrap();
    fs::write(Path::new(path.as_str()).join(EQPLUS_CONFIG), eq_state.to_apo())?;
    Ok(())
}

#[tauri::command]
fn modify_preamp(preamp: f64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let eq_state = &mut state.eq_state.lock().unwrap();
    eq_state.preamp = preamp;
    let path = state.config_dir.lock().unwrap();
    fs::write(Path::new(path.as_str()).join(EQPLUS_CONFIG), eq_state.to_apo())?;
    Ok(())
}

#[tauri::command]
fn quit(reason: String, app_handle: tauri::AppHandle) {
    println!("Quitting with reason: {}", reason);
    app_handle.exit(0);
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(generate_handler![
            check_config_dir,
            check_config_file,
            init_eqplus_config,
            show_main,
            get_state,
            modify_filter,
            add_filter,
            remove_filter,
            modify_preamp,
            quit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
