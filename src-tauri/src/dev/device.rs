use serde::Serialize;

use crate::errors::AppError;

#[derive(Clone, Serialize)]
pub struct DeviceInfo {
    pub guid: String,
    pub name: String,
    pub apo_installed: bool,
}

impl DeviceInfo {
    pub fn enumerate() -> Result<Vec<DeviceInfo>, AppError> {
        Ok(vec![DeviceInfo{
            guid: format!("xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"),
            name: format!("Dummy Device"),
            apo_installed: true,
        }])
    }
}
