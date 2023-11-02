import { createRef, useCallback, useEffect, useState } from 'react';
import { DefaultTheme, ThemeProvider } from 'styled-components';
import GlobalStyles from './GlobalStyles';
import { CanvasPlot, CanvasPlotProps } from './components/CanvasPlot';
import { DEFAULT_THEMES } from './defaults';
import { DisplayFilterNode, FilterChanges, FilterParams } from './types/filter';
import { invoke } from '@tauri-apps/api';
import { EQState } from './types/eqstate';
import isDefined from './utils/isDefined';
import throttle from './utils/throttle';

const THROTTLE_TIMEOUT = 100;

type Dimension = { w: number, h: number };

const sendThrottledModifyFilter: (filter: FilterParams) => void = throttle((filter: FilterParams) => {
  invoke('modify_filter', { filter });
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

function App() {
  const [ theme ] = useState<DefaultTheme>(DEFAULT_THEMES[0]);
  const [ filters, setFilters ] = useState<FilterParams[]>([]);
  const [ selected, setSelected ] = useState<number|null>(null);

  useEffect(() => {
    invoke('get_state')
      .then(res => {
        const state = res as EQState;
        console.log(state);
        setFilters(state.filters);
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
      <ResponsiveCanvasWrapper
        filters={filters.map(f => DisplayFilterNode.fromFilterParams(f))}
        activeNodeIndex={selected}
        onHandleSelected={setSelected}
        onFilterChanged={handleFilterChanged}
      />
      <GlobalStyles />
    </ThemeProvider>
  );
}

export default App;
