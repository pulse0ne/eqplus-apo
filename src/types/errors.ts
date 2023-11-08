export type AppError = {
  err_type: 'InvalidConfigDirectory'|'InvalidConfig'|'GenericIoError'|'RegistryError'|'Fatal',
  message: string
};
