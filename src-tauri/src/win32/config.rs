use crate::errors::AppError;

use super::registry;

const EQUALIZER_APO_REGISTRY_PATH: &str = "HKEY_LOCAL_MACHINE\\SOFTWARE\\EqualizerAPO\\";
const EQUALIZER_APO_CONFIG_KEY: &str = "ConfigPath";

pub fn get_equalizer_apo_config_dir() -> Result<String, AppError> {
    registry::read_value(EQUALIZER_APO_REGISTRY_PATH, EQUALIZER_APO_CONFIG_KEY)
}
