use std::env;

pub fn get_equalizer_apo_config_dir() -> Result<String, AppError> {
    let dir = env::current_dir()?;
    Ok(dir.to_string_lossy().to_string())
}
