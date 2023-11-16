import ReactDOM from 'react-dom/client';

import * as Settings from './settings';
import { invoke } from '@tauri-apps/api/tauri';
import { AppError } from './types/errors';
import { dialog } from '@tauri-apps/api';
import { EQState } from './types/eqstate';
import { Logo } from './components/Logo';
import { HBox } from './components/FlexBox';
import { useEffect } from 'react';

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

function checkConfigDir(): Promise<unknown> {
  return invoke(COMMANDS.checkConfigDir)
    .catch(e => {
      const err = e as AppError;
      console.error(`[${err.err_type}]: ${err.message}`);
      return dialog.message(`${err.message}`, { title: 'Invalid EqualizerAPO Config', type: 'error' })
        .then(() => invoke(COMMANDS.quit, { reason: 'Failed to get EqualizerAPO config' }));
    });
}

function initEqplusConfig(): Promise<EQState> {
  return invoke(COMMANDS.initEqplusConfig);
};

function checkConfigFile(): Promise<void> {
  return invoke(COMMANDS.checkConfigFile);
}

const App = () => {
  useEffect(() => {
    setTimeout(() => {
      checkConfigDir()
        .then(() => initEqplusConfig())
        .then(() => checkConfigFile())
        .then(() => setTimeout(() => invoke(COMMANDS.showMain), 1000))
        .catch(() => console.error('Irrecoverable error, quitting')); // TODO
    }, 1000);
  }, []);
  return (
    <HBox $alignItems="center" $justifyContent="center" style={{ height: '100%' }}>
      <Logo fill="#ffffff" size={256} />
    </HBox>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
