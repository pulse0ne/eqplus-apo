import * as Slider from '@radix-ui/react-slider';
import styled from 'styled-components';

const SliderRoot = styled(Slider.Root)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  width: '20px',
  height: '150px'
});

const SliderTrack = styled(Slider.Track).attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.disabled
  }
}))({
  position: 'relative',
  flexGrow: 1,
  width: '3px'
});

const SliderRange = styled(Slider.Range)({
  position: 'absolute',
  width: '100%'
});

const SliderThumb = styled(Slider.Thumb).attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.dialKnob
  }
}))({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: '2px',
  backgroundColor: 'white'
});

const SliderThumbMarker = styled.div.attrs(({ theme }) => ({
  style: {
    backgroundColor: theme.colors.accentPrimary
  } 
}))(() => ({
  height: '2px'
}));

export function GainSlider() {
  // TODO: tick marks
  return (
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
  );
};
