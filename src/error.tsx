import ReactDOM from 'react-dom/client';

import { invoke } from '@tauri-apps/api/tauri';
import { AppError } from './types/errors';
import { HBox } from './components/FlexBox';
import { useEffect, useState } from 'react';

const App = () => {
  const [ err, setErr ] = useState<AppError|undefined>();
  useEffect(() => {
    invoke('get_error').then(e => setErr(e as AppError));
  }, []);
  return (
    <HBox $alignItems="center" $justifyContent="center" style={{ height: '100%' }}>
      <span style={{ color: 'red' }}>{err?.message}</span>
    </HBox>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
