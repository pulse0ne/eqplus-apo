use core::fmt;
use std::io;

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub enum ErrorType {
    RegistryError,
    GenericIoError,
    InvalidConfigDirectory,
    InvalidConfig,
    BadArguments
}

#[derive(Debug, Serialize, Clone)]
pub struct AppError {
    pub err_type: ErrorType,
    pub message: String
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}]: {}", self.err_type, self.message)
    }
}

impl From<io::Error> for AppError {
    fn from(value: io::Error) -> Self {
        AppError {
            err_type: ErrorType::GenericIoError,
            message: value.to_string()
        }
    }
}
