export type AppError = {
  err_type: 'InvalidConfigDirectory'|'InvalidConfig'|'GenericIoError'|'Fatal',
  message: string
};
