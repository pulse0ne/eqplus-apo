import React, { memo, useEffect, useRef } from "react";
import styled, { useTheme } from "styled-components";
import { useEvent } from "../utils/useEvent";
import clamp from "../utils/clamp";

const DialPath = styled.path`
  stroke-linecap: round !important;
  fill: none;
`;

const radius = 40;
const midX = 50;
const midY = 50;
const minRadians = (5 * Math.PI) / 4;
const maxRadians = -Math.PI / 4;
const start = -Math.PI / 2 - Math.PI / 6;
const tickStartFactor = radius / 1.3;
const tickEndFactor = radius / 1.8;
const defaultSize = 100;

type DialProps = {
  min: number,
  max: number,
  value: number,
  disabled?: boolean,
  onChange?: (v: number) => void,
  step?: number,
  size?: number
};

// TODO: linear vs logarithmic stepping

const Dial = memo(
  function Dial({
    min,
    max,
    value,
    disabled,
    onChange = () => undefined,
    step = 1,
    size = defaultSize
  }: DialProps) {
    const svgRef = useRef<SVGSVGElement|null>(null);

    const theme = useTheme();

    const mapRange = (x: number, inMin: number, inMax: number, outMin: number, outMax: number) => ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    const zeroRadians = () => mapRange(min > 0 && max > 0 ? min : 0, min, max, minRadians, maxRadians);
    const valueRadians = () => mapRange(value, min, max, minRadians, maxRadians);
    const minX = () => midX + Math.cos(minRadians) * radius;
    const minY = () => midY - Math.sin(minRadians) * radius;
    const maxX = () => midX + Math.cos(maxRadians) * radius;
    const maxY = () => midY - Math.sin(maxRadians) * radius;
    const zeroX = () => midX + Math.cos(zeroRadians()) * radius;
    const zeroY = () => midY - Math.sin(zeroRadians()) * radius;
    const valueX = () => midX + Math.cos(valueRadians()) * radius;
    const valueY = () => midY - Math.sin(valueRadians()) * radius;
    const largeArc = () => (Math.abs(zeroRadians() - valueRadians()) < Math.PI ? 0 : 1);
    const sweep = () => (valueRadians() > zeroRadians() ? 0 : 1);
    const rangePath = `M ${minX()} ${minY()} A ${radius} ${radius} 0 1 1 ${maxX()} ${maxY()}`;
    const valuePath = `M ${zeroX()} ${zeroY()} A ${radius} ${radius} 0 ${largeArc()} ${sweep()} ${valueX()} ${valueY()}`;
    const tickPath = `M ${midX + Math.cos(valueRadians()) * tickStartFactor} ${midY - Math.sin(valueRadians()) * tickStartFactor} L ${midX + Math.cos(valueRadians()) * tickEndFactor} ${midY - Math.sin(valueRadians()) * tickEndFactor}`;
    const strokeWidth = 4 / (size / defaultSize);
    const tickStrokeWidth = 3 / (size / defaultSize);

    const listen = () => {
      if (svgRef.current) {
        svgRef.current.addEventListener('mousemove', mouseMove);
        svgRef.current.addEventListener('mouseup', mouseUp);
      }
    };

    const unlisten = () => {
      if (svgRef.current) {
        svgRef.current.removeEventListener('mousemove', mouseMove);
        svgRef.current.removeEventListener('mouseup', mouseUp);
      }
    };

    useEffect(() => {
      return unlisten;
    }, []);

    const mouseDown = useEvent((e: MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      listen();
    });

    const mouseUp = useEvent((e: MouseEvent) => {
      e.preventDefault();
      unlisten();
    });

    const mouseMove = useEvent((e: MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      updateValue(e.offsetX, e.offsetY);
    });

    const scroll = (e: React.WheelEvent) => {
      if (disabled) return;
      const dir = e.deltaY > 0 ? -1 : 1;
      updateModelValue(value + (dir * (max - min) / 20)); // 5%
    };

    const keyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (disabled) return;
      switch (e.code) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          updateModelValue(value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown': {
          e.preventDefault();
          updateModelValue(value - step);
          break;
        }
        case 'Home': {
          e.preventDefault();
          updateModelValue(min);
          break;
        }
        case 'End': {
          e.preventDefault();
          updateModelValue(max);
          break;
        }
        case 'PageUp': {
          e.preventDefault();
          // increase by 10%
          updateModelValue(value + ((max - min) / 10));
          break;
        }
        case 'PageDown': {
          e.preventDefault();
          // decrease by 10%
          updateModelValue(value - ((max - min) / 10));
          break;
        }
      }
    };

    const updateValue = (offsetX: number, offsetY: number) => {
      const halfSz = size * 0.5;
      const dx = offsetX - halfSz;
      const dy = halfSz - offsetY;
      const angle = Math.atan2(dy, dx);
      updateModel(angle);
    };

    const updateModel = (angle: number) => {
      let mappedValue;

      if (angle > maxRadians) {
        mappedValue = mapRange(angle, minRadians, maxRadians, min, max);
      } else if (angle < start) {
        mappedValue = mapRange(angle + 2 * Math.PI, minRadians, maxRadians, min, max);
      } else {
        return;
      }
      onChange(clamp(Math.round((mappedValue - min) / step) * step + min, min, max));
    };

    const updateModelValue = (value: number) => {
      onChange(clamp(value, min, max));
    };

    // TODO: disabled colors
    return (
      <div>
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          width={size}
          height={size}
          onMouseDown={mouseDown}
          onKeyDown={keyDown}
          onWheel={scroll}
          onMouseLeave={unlisten}
          role="slider"
          tabIndex={0}
        >
          <DialPath d={rangePath} strokeWidth={strokeWidth} stroke={theme.colors.controlTrack} />
          <DialPath d={valuePath} strokeWidth={strokeWidth} stroke={theme.colors.accentPrimary} />
          <DialPath d={tickPath} strokeWidth={tickStrokeWidth} stroke={theme.colors.accentPrimary} />
        </svg>
      </div>
    );
  }
);

export { Dial };
