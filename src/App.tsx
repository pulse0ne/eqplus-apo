import { createRef, useEffect, useState } from "react";
import { DefaultTheme, ThemeProvider } from "styled-components";
import { CanvasPlot } from "./components/CanvasPlot";
import { IFilter, DisplayFilterNode } from "./types/filter";
import GlobalStyles from "./GlobalStyles";
import { DEFAULT_THEMES } from "./defaults";

const filters: IFilter[] = [
  DisplayFilterNode.fromFilterParams({ frequency: 10, gain: 10, q: 0.2, type: 'peaking', id: '1' }),
  DisplayFilterNode.fromFilterParams({ frequency: 250, gain: -10, q: 0.5, type: 'peaking', id: '2' }),
  DisplayFilterNode.fromFilterParams({ frequency: 2500, gain: 5, q: 1.2, type: 'peaking', id: '3' }),
  DisplayFilterNode.fromFilterParams({ frequency: 10000, gain: -5, q: 2.2, type: 'peaking', id: '4' })
];

type Dimension = { w: number, h: number };

function TestContainer() {
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
        filters={filters}
        activeNodeIndex={0}
        disabled={false}
      />
    </div>
  );
}

function App() {
  const [ theme ] = useState<DefaultTheme>(DEFAULT_THEMES[0]);
  return (
    <ThemeProvider theme={theme}>
      <TestContainer />
      <GlobalStyles />
    </ThemeProvider>
  );
}

export default App;
