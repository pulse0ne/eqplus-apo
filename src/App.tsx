import { createRef, useCallback, useEffect, useState } from 'react';
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
import { info } from './utils/log-bridge';
import { HBox, VBox } from './components/FlexBox';
import { Select, SelectOption } from './components/Select';

const THROTTLE_TIMEOUT = 100;

type Dimension = { w: number, h: number };

const sendThrottledModifyFilter: (filter: FilterParams) => void = throttle((filter: FilterParams) => {
  invoke('modify_filter', { device: 'all', filter });
}, THROTTLE_TIMEOUT);

function ResponsiveCanvasWrapper(props: Omit<CanvasPlotProps, 'width'|'height'|'disabled'>) {
  const [ size, setSize ] = useState<Dimension>({ w: 400, h: 400 });
  const responsiveWrapper = createRef<HTMLDivElement>();

  useEffect(() => {
    if (responsiveWrapper.current) {
      const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        if (entries.length) {
          const entry = entries[0];
          setSize(() => {
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
    <div ref={responsiveWrapper} style={{ height: '100%', width: '100%'}}>
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
      info(`GUID: ${device.guid}`);
      info(`APO installed: ${device.apo_installed}`);
      info(`Cleaned up name: ${deviceName(device)}`);
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

  return (
    <ThemeProvider theme={theme}>
      <VBox>
        <ResponsiveCanvasWrapper
          filters={filters.map(f => DisplayFilterNode.fromFilterParams(f))}
          activeNodeIndex={selected}
          onHandleSelected={setSelected}
          onFilterChanged={handleFilterChanged}
        />
        <Select>
          <SelectOption value="Test Option 1">
            <HBox $justifyContent="space-between" $alignItems="center">
              <span>Test Option 1</span>
              <HBox $alignItems="center">
                <span>APO Not Installed</span>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'red' }}></div>
              </HBox>
            </HBox>
          </SelectOption>
          <SelectOption value="Test Option 2">
            <HBox $justifyContent="space-between" $alignItems="center">
              <span>Test Option 2</span>
              <HBox $alignItems="center">
                <span>APO Installed</span>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'green' }}></div>
              </HBox>
            </HBox>
          </SelectOption>
        </Select>
      </VBox>
      <GlobalStyles />
    </ThemeProvider>
  );
}

export default App;
