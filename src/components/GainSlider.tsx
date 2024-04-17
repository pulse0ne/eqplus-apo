import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import styled from 'styled-components';

const THUMB_WIDTH = 24;
const THUMB_HEIGHT = 30;
const TICK_GAP = 10;
const TRACK_HEIGHT = 200;

const tickPositions = Array.from(Array(41), (_, ix) => {
  return (ix / 40) * 100.0;
});

type TickProps = {
  $index: number,
  $alignment: 'left'|'right'
};

const Tick = styled.div.attrs<TickProps>(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.disabled
  }
}))<TickProps>(({ $index, $alignment }) => ({
  position: 'absolute',
  height: '1px',
  width: $index % 20 === 0 ? `${(THUMB_WIDTH / 2) + 4}px` : $index % 5 === 0 ? `${(THUMB_WIDTH / 2) - (TICK_GAP / 8)}px` : `${(THUMB_WIDTH / 2) - (TICK_GAP / 2)}px`,
  top: `${tickPositions[$index]}%`,
  left: $alignment === 'left' ? 0 : undefined,
  right: $alignment === 'right' ? 0 : undefined
}));

const TickContainer = styled.div({
  display: 'flex',
  flexDirection: 'row',
  gap: `${TICK_GAP}px`,
  position: 'absolute',
  top: THUMB_HEIGHT / 2,
  bottom: THUMB_HEIGHT / 2,
  left: 0,
  right: 0
});

const Ticks = React.memo(() => {
  return (
    <TickContainer>
      <div style={{ position: 'relative', flex: 1 }}>
        {tickPositions.map((tick, ix) => (
          <Tick key={tick} $index={ix} $alignment="right" />
        ))}
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        {tickPositions.map((tick, ix) => (
          <Tick key={tick} $index={ix} $alignment="left" />
        ))}
      </div>
    </TickContainer>
  );
});

const GainSliderContainer = styled.div({
  position: 'relative',
  width: '50px'
});

const SliderRoot = styled(Slider.Root)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  height: `${TRACK_HEIGHT}px`
});

const SliderTrack = styled(Slider.Track).attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.disabled
  }
}))({
  position: 'relative',
  flexGrow: 1,
  width: '2px'
});

const SliderRange = styled(Slider.Range)({
  position: 'absolute',
  width: '100%'
});

const SliderThumb = styled(Slider.Thumb).attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.dialKnob,
    border: `1px solid ${theme.colors.border}`
  }
}))(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  width: `${THUMB_WIDTH}px`,
  height: `${THUMB_HEIGHT}px`,
  borderRadius: '4px',
  backgroundColor: 'white',
  '&:focus-visible': {
    outline: `1px solid ${theme.colors.accentPrimary}` // TODO: not great with theme changes
  }
}));

const SliderThumbMarker = styled.div.attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.accentPrimary
  } 
}))(() => ({
  height: '2px'
}));

export function GainSlider() {
  return (
    <GainSliderContainer>
      <Ticks />
      <SliderRoot
        defaultValue={[50]}
        orientation="vertical"
        >
        <SliderTrack>
          <SliderRange />
        </SliderTrack>
        <SliderThumb>
          <SliderThumbMarker />
        </SliderThumb>
      </SliderRoot>
    </GainSliderContainer>
  );
};
