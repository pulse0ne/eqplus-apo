import styled from "styled-components";
import { Dial } from "./Dial";
import { VBox } from "./FlexBox";
import { useState } from "react";

const Wrapper = styled(VBox)`
  height: 100%;
  padding: 8px;
`;

export default function DrawerControls() {
  const [ val, setVal ] = useState(0);
  return (
    <Wrapper $justifyContent="center" $alignItems="center">
      <Dial size={75} min={0} max={20} step={0.5} value={0} />
      <Dial size={100} min={0.01} max={10} step={0.1} value={val} onChange={setVal} />
      <Dial size={75} min={0} max={20} step={0.5} value={0} />
    </Wrapper>
  );
}
