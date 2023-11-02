import React from 'react';
import ReactDOM from 'react-dom/client';

import * as Settings from './settings';
import { invoke } from '@tauri-apps/api/tauri';
import { AppError } from './types/errors';
import { dialog } from '@tauri-apps/api';
import { EQState } from './types/eqstate';
import { Logo } from './components/Logo';
import { HBox } from './components/FlexBox';

// TODO: move to own file
const COMMANDS = {
  checkConfigDir: 'check_config_dir',
  checkConfigFile: 'check_config_file',
  initEqplusConfig: 'init_eqplus_config',
  showMain: 'show_main',
  getState: 'get_state',
  modifyFilter: 'modify_filter',
  addFilter: 'add_filter',
  remove_filter: 'remove_filter',
  modify_preamp: 'modify_preamp',
  quit: 'quit'
};

function checkConfigDir(dir: string): Promise<unknown> {
  return invoke(COMMANDS.checkConfigDir, { configDir: dir})
    .catch(e => {
      const err = e as AppError;
      console.error(`[${err.err_type}]: ${err.message}`);
      if (err.err_type === 'InvalidConfigDirectory') {
        return dialog.message(`${err.message}. Click 'Ok' to select a new one.`, { title: 'Invalid EqualizerAPO Config', type: 'error' })
          .then(() => dialog.open({ title: 'Select EqualizerAPO Config Directory', directory: true }))
          .then((value) => {
            if (value && value.length) {
              const path = value as string;
              return Settings.update({ configDir: path })
                .then(s => checkConfigDir(s.configDir));
            } else {
              return Promise.reject({ err_type: 'Fatal', message: 'Invalid selection' });
            }
          });
      } else {
        return Promise.reject({ err_type: 'Fatal', message: 'Invalid selection' });
      }
    });
}

function initEqplusConfig(): Promise<EQState> {
  return invoke(COMMANDS.initEqplusConfig);
};

function checkConfigFile(): Promise<void> {
  return invoke(COMMANDS.checkConfigFile);
}

Settings.load().then(settings => {
  checkConfigDir(settings.configDir)
    .then(() => initEqplusConfig())
    .then(() => checkConfigFile())
    .then(() => setTimeout(() => invoke(COMMANDS.showMain), 1000))
    .catch(() => console.error('Irrecoverable error, quitting')); // TODO
});

const App = () => (
  <HBox $alignItems="center" $justifyContent="center" style={{ height: '100%' }}>
    <Logo fill="#ffffff" size={256} />
  </HBox>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);