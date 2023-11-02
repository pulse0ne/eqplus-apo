import styled, { DefaultTheme } from 'styled-components';

export type FlexBoxProps = {
  id?: string,
  $alignContent?: React.CSSProperties['alignContent'],
  $alignItems?: React.CSSProperties['alignItems'],
  $justifyContent?: React.CSSProperties['justifyContent'],
  $justifyItems?: React.CSSProperties['justifyItems'],
  theme?: DefaultTheme,
};

export const FlexBox = styled.div<FlexBoxProps>(({
  $alignContent,
  $alignItems,
  $justifyContent,
  $justifyItems
}) => ({
  display: 'flex',
  alignContent: $alignContent,
  alignItems: $alignItems,
  justifyContent: $justifyContent,
  justifyItems: $justifyItems,
}));

export const HBox = styled(FlexBox)({
  flexDirection: 'row'
});

export type SpacerProps = {
  $size?: number
};

export const HSpacer = styled.div<SpacerProps>(({ $size = 1 }) => `
  width: ${$size * 8}px;
  min-width: ${$size * 8}px;
  max-width: ${$size * 8}px;
`);

export const VBox = styled(FlexBox)({
  flexDirection: 'column'
});

export const VSpacer = styled.div<SpacerProps>(({ $size = 1 }) => `
  height: ${$size * 8}px;
  min-height: ${$size * 8}px;
  max-height: ${$size * 8}px;
`);
