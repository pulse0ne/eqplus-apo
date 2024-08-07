export type DeviceInfo = {
  name: string,
  guid: string,
  apo_installed: boolean,
  is_default: boolean
};

export function deviceName(info: DeviceInfo) {
  if (info.name === 'all') return info.name;
  return `${info.name.replace(/[()]/g, '')} ${info.guid}`;
}
