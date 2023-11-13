#[derive(Clone, Serialize)]
pub struct DeviceInfo {
    pub guid: String,
    pub name: String,
    pub apo_installed: bool,
}

impl DeviceInfo {
    pub fn enumerate() -> Result<Vec<DeviceInfo>, AppError> {
        Ok(vec![DeviceInfo{
            guid: "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            name: "Dummy Device",
            apo_installed: true,
        }])
    }
}
