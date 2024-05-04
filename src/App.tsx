import { useCallback, useEffect, useRef, useState } from 'react';
import { DefaultTheme, ThemeProvider } from 'styled-components';
import GlobalStyles from './GlobalStyles';
import { CanvasPlot, CanvasPlotProps } from './components/CanvasPlot';
import { DEFAULT_THEMES } from './defaults';
import { DisplayFilterNode, FilterChanges, FilterParams } from './types/filter';
import { invoke } from '@tauri-apps/api';
import { DeviceFilterMapping } from './types/eqstate';
import isDefined from './utils/isDefined';
import throttle from './utils/throttle';
import { DeviceInfo, deviceName } from './types/device';
import { info } from './utils/logBridge';
import { HBox, VBox } from './components/FlexBox';
import DrawerControls from './components/DrawerControls';
import './assets/fonts.css';

const THROTTLE_TIMEOUT = 100;

type Dimension = { w: number, h: number };

const sendThrottledModifyFilter: (filter: FilterParams) => void = throttle((filter: FilterParams) => {
  invoke('modify_filter', { device: 'all', filter });
}, THROTTLE_TIMEOUT);

function ResponsiveCanvasWrapper(props: Omit<CanvasPlotProps, 'width'|'height'|'disabled'>) {
  const [ size, setSize ] = useState<Dimension>({ w: 400, h: 400 });
  const responsiveWrapper = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    if (responsiveWrapper.current) {
      const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        if (entries.length) {
          const entry = entries[0];
          setSize(() => {
            console.log('setting size');
            const rect = entry.contentRect;
            return { w: rect.width, h: rect.height };
          });
        }
      });

      observer.observe(responsiveWrapper.current);

      return () => observer.disconnect();
    }
  }, [responsiveWrapper]);
  return (
    <div ref={responsiveWrapper} style={{ height: '100%', width: '100%' }}>
      <CanvasPlot
        width={size.w}
        height={size.h}
        disabled={false}
        {...props}
      />
    </div>
  );
}

invoke('query_devices')
  .then(res => {
    const devices = res as DeviceInfo[];
    devices.forEach(device => {
      info(`Name: ${device.name}`);
      info(`  GUID: ${device.guid}`);
      info(`  APO installed: ${device.apo_installed}`);
      info(`  Is default: ${device.is_default}`)
      info(`  Cleaned up name: ${deviceName(device)}`);
    });
  });

function App() {
  const [ theme ] = useState<DefaultTheme>(DEFAULT_THEMES[0]);
  const [ filters, setFilters ] = useState<FilterParams[]>([]);
  const [ selected, setSelected ] = useState<number|null>(null);

  useEffect(() => {
    invoke('get_state')
      .then(res => {
        const state = res as DeviceFilterMapping;
        console.log(state);
        setFilters(state['all']?.eq?.filters ?? []);
      });
  }, []);

  const handleFilterChanged = useCallback(({ frequency, gain, q, type }: FilterChanges) => {
    if (selected === null) return;
    const filter = filters[selected];
    if (isDefined(frequency)) filter.frequency = frequency;
    if (isDefined(gain)) filter.gain = gain;
    if (isDefined(q)) filter.q = q;
    if (isDefined(type)) filter.type = type;
    setFilters([...filters]);
    sendThrottledModifyFilter(filter);
  }, [filters, selected]);

  const handleFilterAdded = useCallback((atFrequency: number) => {
    const ids = filters.map(f => f.id);
    const largestId = ids.reduce((acc, id) => {
      const idNum = parseInt(id);
      return isNaN(idNum) ? acc : Math.max(acc, idNum);
    }, 1);
    const filter: FilterParams = {
      id: `${largestId + 1}`,
      frequency: atFrequency,
      gain: 0.0,
      q: 1.0,
      type: 'peaking'
    };
    setFilters([...filters, filter]);
    invoke('add_filter', { device: 'all', filter });
  }, [filters]);

  return (
    <ThemeProvider theme={theme}>
      <HBox style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <ResponsiveCanvasWrapper
            filters={filters.map(f => DisplayFilterNode.fromFilterParams(f))}
            activeNodeIndex={selected}
            onHandleSelected={setSelected}
            onFilterChanged={handleFilterChanged}
            onFilterAdded={handleFilterAdded}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <VBox
            $justifyContent="center"
            $alignItems="center"
            style={{
              position: 'absolute',
              top: 0,
              left: -24,
              width: 24,
              height: 24,
              background: 'black',
              color: 'white'
              }}
            >
              <i className="icon arrow_right" style={{ fontSize: 16 }} />
            </VBox>
          <DrawerControls />
        </div>
      </HBox>
      <GlobalStyles />
    </ThemeProvider>
  );
}

export default App;
