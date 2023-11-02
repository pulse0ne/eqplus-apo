import { BaseDirectory, exists, readTextFile, writeTextFile, createDir } from '@tauri-apps/api/fs';

export type UserSettings = {
  drawCompositeResponse: boolean,
  configDir: string
};

const DEFAULT_EQUALIZERAPO_CONFIG_DIR = 'C:\\Program Files\\EqualizerAPO\\config';

const DEFAULT_SETTINGS: UserSettings = {
  drawCompositeResponse: true,
  configDir: DEFAULT_EQUALIZERAPO_CONFIG_DIR
};

const FILENAME = 'settings.json';

const write = async (settings: UserSettings) => {
  return writeTextFile(FILENAME, JSON.stringify(settings, null, 2), { dir: BaseDirectory.AppData }).then(() => settings);
};

const load = async () => {
  const appdirExists = await exists('', { dir: BaseDirectory.AppData });
  if (!appdirExists) {
    await createDir('', { dir: BaseDirectory.AppData, recursive: true });
  }
  const settingsExists = await exists(FILENAME, { dir: BaseDirectory.AppData })
  if (!settingsExists) {
    await writeTextFile(FILENAME, JSON.stringify(DEFAULT_SETTINGS), { dir: BaseDirectory.AppData });
  }
  const rawFile = await readTextFile(FILENAME, { dir: BaseDirectory.AppData });
  return JSON.parse(rawFile) as UserSettings;
};

const update = async (newValues: Partial<UserSettings>) => {
  return load().then(storedSettings => {
    const newSettings = {
      ...storedSettings,
      ...newValues
    }
    return write(newSettings);
  });
};

export {
  write,
  load,
  update
};