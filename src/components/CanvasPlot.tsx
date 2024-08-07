import { darken, opacify, transparentize } from 'color2k';
import { Component, Context, ContextType, createRef } from 'react';
import styled, { DefaultTheme, ThemeContext } from 'styled-components';
import { AUDIO_CONTEXT, NYQUIST, FREQ_START } from '../audioConstants';
import { IFilter, FilterChanges } from '../types/filter';
import { Theme } from '../types/theme';
import clamp from '../utils/clamp';

const TWO_PI = 2.0 * Math.PI;
const HANDLE_RADIUS = 4.5;
const SELECTED_HANDLE_RADIUS = 1.25 * HANDLE_RADIUS;
const HANDLE_CIRCUMFERENCE = 2 * HANDLE_RADIUS;
const DB_MAX = 20.0;
const DB_MIN = -30.0;
const DB_SCALE = 20.0;
const DPR = () => window.devicePixelRatio;

const CONTROL_WIDTH = 120;
const CONTROL_HEIGHT = 48;

const FREQ_LINES = {
  '10': 10,
  '100': 100,
  '1k': 1000,
  '10k': 10000
};

const FloatingControls = styled.div`
  position: absolute;
  width: ${CONTROL_WIDTH}px;
  height: ${CONTROL_HEIGHT}px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.75);
  overflow: hidden;
  z-index: 9999;
`;

type CanvasContainerProps = { $w: number, $h: number };

const CanvasContainer = styled.div.attrs<CanvasContainerProps>(props => ({
  style: {
    width: `${props.$w}px`,
    height: `${props.$h}px`
  }
}))<CanvasContainerProps>`
  position: relative;
`;

const CanvasWrapper = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  cursor: none;
  background-color: ${props => props.id === 'grid' ? props.theme.colors.graphBackground : 'transparent'};
`;

type Point2D = { x: number, y: number };

type HandleProperties = { location: Point2D, hovered: boolean }

export type CanvasPlotProps = {
  width: number,
  height: number,
  activeNodeIndex: number|null,
  filters: IFilter[],
  disabled: boolean,
  wheelSensitivity?: number,
  drawCompositeResponse?: boolean,
  onFilterChanged?: (changes: FilterChanges) => void,
  onHandleSelected?: (index: number) => void,
  onFilterAdded?: (atFrequency: number) => void
};

type CanvasPlotState = {
  dragging: boolean
};

/**
 * This is a class component because I couldn't get hooks to work with complex mouse handlers; callback references change,
 * breaking things and complicating dependency mapping. Maybe one day this will be refactored back?
 */
export class CanvasPlot extends Component<CanvasPlotProps, CanvasPlotState> {
  static contextType: Context<DefaultTheme|undefined> = ThemeContext;

  declare context: ContextType<typeof ThemeContext>;

  static defaultProps = {
    width: 750,
    height: 400,
    drawCompositeResponse: true
  };

  state: CanvasPlotState = {
    dragging: false
  };

  gridRef = createRef<HTMLCanvasElement>();
  graphRef = createRef<HTMLCanvasElement>();
  displayRef = createRef<HTMLCanvasElement>();

  filterNodes: BiquadFilterNode[] = [];
  // handleLocations: Record<string, Point2D> = {};
  handles: Record<string, HandleProperties> = {};

  constructor(props: CanvasPlotProps) {
    super(props);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseWheel = this.handleMouseWheel.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.draw = this.draw.bind(this);
    this.drawFrLine = this.drawFrLine.bind(this);
    this.drawGrid = this.drawGrid.bind(this);
    this.drawDisplayLayer = this.drawDisplayLayer.bind(this);
    this.drawHandles = this.drawHandles.bind(this);
  }

  componentDidMount() {
    const grid = this.gridRef.current!;
    const graph = this.graphRef.current!;

    grid.getContext('2d')?.scale(DPR(), DPR());
    graph.getContext('2d')?.scale(DPR(), DPR());

    this.drawAll();
  }

  componentDidUpdate() {
    this.drawAll();
  }

  private syncBiquads(filters: IFilter[]) {
    const nodes: BiquadFilterNode[] = [];
    filters.forEach((f, ix) => {
      const bqf = AUDIO_CONTEXT.createBiquadFilter();
      bqf.frequency.value = f.getFrequency();
      bqf.Q.value = f.getQ();
      bqf.gain.value = f.getGain();
      bqf.type = f.getType();
      if (ix > 0) {
        bqf.connect(nodes[ix - 1]);
      }
      if (ix === filters.length - 1) {
        bqf.connect(AUDIO_CONTEXT.destination);
      }
      nodes.push(bqf);
    });
    this.filterNodes = nodes;
  }

  handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    if (this.props.disabled) return;
    const { onHandleSelected } = this.props;
    const { offsetX, offsetY } = e.nativeEvent;
    const node = Object.entries(this.handles).find(p => {
      const { x, y } = p[1].location;
      const [ xHit, yHit ] = [ x + HANDLE_RADIUS, y + HANDLE_RADIUS ];
      const [ diffX, diffY ] = [ xHit - offsetX, yHit - offsetY ];
      return diffX > 0 && diffY > 0 && diffX < HANDLE_CIRCUMFERENCE && diffY < HANDLE_CIRCUMFERENCE;
    });

    if (node) {
      const nodeIndex = this.props.filters.findIndex(i => i.id === node[0]);
      onHandleSelected?.(nodeIndex);
      // const graph = this.graphRef.current;
      // if (graph) {
      //   // graph.style.cursor = 'grabbing';
      // }
      this.setState(prevState => ({ ...prevState, dragging: true }));
    }
  }

  handleMouseUp() {
    const graph = this.graphRef.current;
    if (graph) {
      graph.style.cursor = '';
    }
    this.setState(prevState => ({ ...prevState, dragging: false }));
  }

  handleMouseMove(e: React.MouseEvent) {
    const { disabled, filters, activeNodeIndex, onFilterChanged, width } = this.props;
    if (disabled) return;
    const { offsetX, offsetY } = e.nativeEvent;
    if (!offsetX && !offsetY) { // when mouse stops, these are 0
      window.requestAnimationFrame(() => this.drawDisplayLayer(-1, -1));
      return;
    }
    window.requestAnimationFrame(() => this.drawDisplayLayer(offsetX, offsetY));

    if (!this.state.dragging) {
      let redrawHandles = false;
      Object.values(this.handles).forEach(handle => {
        const { x, y } = handle.location;
        const [ xHit, yHit ] = [ x + HANDLE_RADIUS, y + HANDLE_RADIUS ];
        const [ diffX, diffY ] = [ xHit - offsetX, yHit - offsetY ];
        const hit = diffX > 0 && diffY > 0 && diffX < HANDLE_CIRCUMFERENCE && diffY < HANDLE_CIRCUMFERENCE;
        if (handle.hovered !== hit) {
          handle.hovered = hit;
          redrawHandles = true;
        }
      });

      if (redrawHandles) {
        console.log('redrawing handles');
        window.requestAnimationFrame(this.draw);
      }
      // this.graphRef.current!.style.cursor = hit ? 'grab' : 'none';
    } else {
      if (activeNodeIndex !== null) {
        const active = filters[activeNodeIndex];
        const m = width / Math.log10(NYQUIST / FREQ_START);
        const adjustedX = offsetX * DPR();
        let adjustedY = offsetY * DPR();
        if (active.getType() === 'lowshelf' || active.getType() === 'highshelf') {
          const zeroY = this.getZeroY();
          const diffFromZero = offsetY - zeroY;
          const y = (diffFromZero * 2) + zeroY;
          adjustedY = y * DPR();
        }
        const frequency = Math.pow(10, adjustedX / m) * FREQ_START;
        if (active.usesGain()) {
          const gain = clamp(20.0 * (((-(1/Math.abs(DB_MAX / (DB_MIN - DB_MAX))) * adjustedY) / this.props.height) + 1), DB_MIN, DB_MAX);
          console.log(adjustedY, gain);
          onFilterChanged?.({ frequency, gain });
        } else {
          onFilterChanged?.({ frequency });
        }
      }
    }
  }

  handleMouseWheel(e: React.WheelEvent) {
    const { disabled, filters, activeNodeIndex, onFilterChanged } = this.props;
    if (disabled) return;
    const active = activeNodeIndex !== null ? filters[activeNodeIndex] : null;
    if (active && active.usesQ()) {
      const dir = e.deltaY > 0 ? -1 : 1;
      const curr = active.getQ();
      const q = Math.max(0.01, Math.min(curr + (curr / 10 * dir), 10));
      onFilterChanged?.({ q });
    }
  }

  handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    const adjustedX = e.nativeEvent.offsetX * DPR();
    const m = this.graphRef.current!.width / Math.log10(NYQUIST / FREQ_START);
    const frequency = Math.pow(10, adjustedX / m) * FREQ_START;
    this.props.onFilterAdded?.(frequency);
  }

  private drawGrid() {
    console.log('drawing grid');
    const grid = this.gridRef.current;
    if (!grid) return;
    const gridCtx = grid.getContext('2d')!;
    const { width, height } = this.props;
    gridCtx.clearRect(0, 0, width, height);

    const colors = this.context!.colors;

    // draw frequency lines
    gridCtx.font = '8px sans-serif';

    const m = width / Math.log10(NYQUIST / FREQ_START);
    for (let i = 0, j = FREQ_START; j < NYQUIST; ++i, j = Math.pow(10, i)) {
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(p => {
        if (i === 0 && p === 1) return;
        const x = Math.floor(m * Math.log10(p * j / FREQ_START)) + 0.5;
        gridCtx.beginPath();
        gridCtx.lineWidth = 1;
        gridCtx.strokeStyle = p === 1 ? colors.graphLineMarker : colors.graphLine;
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
      });
    }

    // draw text for frequency
    Object.entries(FREQ_LINES).forEach(j => {
      const x = m * Math.log10(j[1] / FREQ_START);
      gridCtx.lineWidth = 0.5;
      gridCtx.textAlign = 'center';
      gridCtx.fillStyle = colors.graphText;
      gridCtx.fillText(j[0], Math.floor(x) + 10.5, height - 2.5);
    });

    const zeroY = this.getZeroY();

    // draw decibel lines
    for (let db = DB_MIN + 5; db < DB_MAX; db += 5) {
      const dbToY = zeroY - (zeroY / DB_SCALE) * db;
      const y = Math.floor(dbToY) + 0.5; // adjustment for crisp lines
      gridCtx.strokeStyle = db === 0 ? colors.graphLineMarker : colors.graphLine;
      gridCtx.beginPath();
      gridCtx.moveTo(0, y);
      gridCtx.lineTo(width, y);
      gridCtx.stroke();
      gridCtx.fillStyle = colors.graphText;
      gridCtx.fillText(db.toFixed(0), 10.5, y + 0.5 - 2);
    }
  }

  handleMouseLeave() {
    console.log('here');
    window.requestAnimationFrame(() => this.drawDisplayLayer(-1, -1));
  }

  private drawDisplayLayer(x: number, y: number) {
    const display = this.displayRef.current;
    if (!display) return;
    const { width, height } = this.props;
    const ctx = display.getContext('2d')!;

    ctx.clearRect(0, 0, width, height);

    if (x > -1 && y > -1) {
      const m = width / Math.log10(NYQUIST / FREQ_START);
      const adjustedX = x * DPR();
      const adjustedY = y * DPR();
      const frequency = Math.pow(10, adjustedX / m) * FREQ_START;

      const color = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(`${frequency.toFixed(2)}Hz`, 5.5, height - 5.5);

      ctx.fillStyle = 'transparent';
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(adjustedX + 0.5, 0);
      ctx.lineTo(adjustedX + 0.5, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, adjustedY + 0.5);
      ctx.lineTo(width, adjustedY + 0.5);
      ctx.stroke();
    }
  }

  private drawAll() {
    console.log('drawing all');
    this.syncBiquads(this.props.filters);
    window.requestAnimationFrame(this.drawGrid);
    window.requestAnimationFrame(this.draw);
  }

  private drawFrLine() {
    const graph = this.graphRef.current;
    if (!graph) return [];
    const { width, height } = this.props;
    const graphCtx = graph.getContext('2d')!;

    const { filters, disabled } = this.props;

    const theme = this.context!;

    const mVal = width / Math.log10(NYQUIST / FREQ_START);

    graphCtx.clearRect(0, 0, width, height);

    const freqHz = new Float32Array(width);
    for (let x = 0; x < width; ++x) {
      freqHz[x] = Math.pow(10, (x / mVal)) * FREQ_START;
    }

    const zeroY = this.getZeroY();

    if (this.props.drawCompositeResponse) {
      const magRes = filters.map((f, ix) => {
        const filterNode = this.filterNodes[ix];
        filterNode.frequency.value = f.getFrequency();
        filterNode.gain.value = f.getGain();
        filterNode.Q.value = f.getQ();
        filterNode.type = f.getType();
        const response = new Float32Array(width);
        filterNode.getFrequencyResponse(freqHz, response, new Float32Array(width));
        return response;
      });

      graphCtx.beginPath();
      graphCtx.lineWidth = 2;
      graphCtx.strokeStyle = disabled ? theme.colors.disabled : theme.colors.accentPrimary;

      for (let i = 0; i < width; ++i) {
        const response = magRes.reduce((a, c) => a * c[i], 1);
        const dbResponse = 20.0 * Math.log10(Math.abs(response) || 1);
        const y = zeroY * (1 - dbResponse / DB_SCALE);
        if (i === 0) {
          graphCtx.moveTo(i, y);
        } else {
          graphCtx.lineTo(i, y);
        }
      }
      graphCtx.stroke();
  }

    // draw individual bands
    filters.forEach((f, ix) => {
      const filterNode = this.filterNodes[ix];
      filterNode.frequency.value = f.getFrequency();
      filterNode.gain.value = f.getGain();
      filterNode.Q.value = f.getQ();
      filterNode.type = f.getType();
      const response = new Float32Array(width);
      filterNode.getFrequencyResponse(freqHz, response, new Float32Array(width));

      const colorKey = `graphNodeColor${(ix % 4) + 1}` as keyof Theme['colors'];
      const color = theme.colors[colorKey];

      graphCtx.beginPath();
      graphCtx.lineWidth = 2;
      graphCtx.strokeStyle = transparentize(color, 0.2);
      graphCtx.fillStyle = transparentize(color, 0.3);
      graphCtx.moveTo(0, zeroY);

      for (let i = 0; i < width; ++i) {
        const r = response[i];
        const dbResponse = 20.0 * Math.log10(Math.abs(r) || 1);
        const y = zeroY * (1 - dbResponse / DB_SCALE);
        graphCtx.lineTo(i, y);
      }

      graphCtx.lineTo(width, zeroY);
      graphCtx.stroke();
      graphCtx.fill();
    });
  }

  private getZeroY() {
    return Math.abs(DB_MAX / (DB_MIN - DB_MAX)) * this.props.height;
  }

  private drawHandles() {
    console.log('drawing handles');
    const graph = this.graphRef.current;
    if (!graph) return;
    const { width } = this.props;
    const graphCtx = graph.getContext('2d')!;
    const mVal = width / Math.log10(NYQUIST / FREQ_START);
    const newHandleLocations: Record<string, HandleProperties> = {};
    const { filters, disabled, activeNodeIndex } = this.props;
    const theme = this.context!;

    const zeroY = this.getZeroY();
    filters.forEach((f, ix) => {
      const x = Math.floor(mVal * Math.log10(f.getFrequency() / FREQ_START));
      let y = zeroY;
      if (f.usesGain()) {
        y = zeroY * (1 - f.getGain() / DB_SCALE);
        if (f.getType() === 'lowshelf' || f.getType() === 'highshelf') {
          const diffFromZero = y - zeroY;
          y = (diffFromZero * 0.5) + zeroY;
        }
      }
      const active = ix === activeNodeIndex;

      const colorKey = `graphNodeColor${(ix % 4) + 1}` as keyof Theme['colors'];
      const color = theme.colors[colorKey];

      graphCtx.strokeStyle = disabled ? theme.colors.disabled : (active ? color : darken(color, 0.1));
      graphCtx.lineWidth = 3;
      graphCtx.beginPath();
      const r = active ? SELECTED_HANDLE_RADIUS : HANDLE_RADIUS;
      graphCtx.arc(x, y, r, 0, TWO_PI);
      graphCtx.stroke();

      if (active) {
        graphCtx.fillStyle = disabled ? theme.colors.disabled : opacify(color, 1.0);
        graphCtx.fill();
        graphCtx.beginPath();
        graphCtx.arc(x, y, r, 0, TWO_PI);
        graphCtx.filter = 'blur(16px)';
        graphCtx.fill();
        graphCtx.fillStyle = theme.colors.background;
        graphCtx.filter = 'none';
      } else {
        graphCtx.fillStyle = disabled ? theme.colors.disabled : color;
      }

      newHandleLocations[f.id] = { location: { x, y }, hovered: false };
    });
    this.handles = newHandleLocations;
  }

  private draw() {
    const graph = this.graphRef.current;
    if (!graph) return;
    this.drawFrLine();
    this.drawHandles();
  }

  private getFloatingControlsLocation(): Point2D|null {
    const handle = this.props.activeNodeIndex !== null ? this.handles[this.props.filters[this.props.activeNodeIndex].id] : null;
    return handle ? { x: handle.location.x + HANDLE_RADIUS, y: handle.location.y + HANDLE_RADIUS } : null;
  }

  render() {
    const { width, height } = this.props;
    const controlsLoc = this.getFloatingControlsLocation();
    return (
      <CanvasContainer
        $h={height}
        $w={width}
        className="themed accentPrimary disabled graphBackground graphLine graphLineMarker graphNodeColor1 graphNodeColor2 graphNodeColor3 graphNodeColor4 graphText"
      >
        <CanvasWrapper
          id="grid"
          ref={this.gridRef}
          width={`${DPR() * width}px`}
          height={`${DPR() * height}px`}
        />
        <CanvasWrapper
          id="display"
          ref={this.displayRef}
          width={`${DPR() * width}px`}
          height={`${DPR() * height}px`}
        />
        <CanvasWrapper
          id="graph"
          ref={this.graphRef}
          width={`${DPR() * width}px`}
          height={`${DPR() * height}px`}
          onMouseDown={this.handleMouseDown}
          onMouseUp={this.handleMouseUp}
          onMouseMove={this.handleMouseMove}
          onMouseLeave={this.handleMouseLeave}
          onWheel={this.handleMouseWheel}
          onDoubleClick={this.handleDoubleClick}
        />
        {/*controlsLoc && 
          <FloatingControls
            style={{
              top: controlsLoc.y,
              left: controlsLoc.x
            }}
          />*/
        }
      </CanvasContainer>
    );
  }
}
