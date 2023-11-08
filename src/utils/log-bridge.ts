import { invoke } from "@tauri-apps/api/tauri";

type LogLevel = 'debug'|'info'|'warn'|'error';
const sendLogMessage = (level: LogLevel, message: string) => {
  invoke('log_bridge', { level, message });
};

const debug = (message: string) => sendLogMessage('debug', message);
const info = (message: string) => sendLogMessage('info', message);
const warn = (message: string) => sendLogMessage('warn', message);
const error = (message: string) => sendLogMessage('error', message);

export {
  debug,
  info,
  warn,
  error
}
