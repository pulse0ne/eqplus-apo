import styled from "styled-components";
import { Dial } from "./Dial";
import { VBox } from "./FlexBox";
import { useEffect } from "react";
import { motion, useAnimate } from "framer-motion";
import { FilterChanges, FilterParams } from "../types/filter";
import { NYQUIST } from "../audioConstants";

const Wrapper = styled(motion.div)`
  height: 100%;
  overflow: hidden;
`;

export type DrawerControls = {
  open: boolean,
  filter?: FilterParams,
  onFilterChanged?: (changes: FilterChanges) => void
};

export default function DrawerControls({ open, filter, onFilterChanged }: DrawerControls) {
  const [ wrapperScope, animateWrapper ] = useAnimate();
  
  useEffect(() => {
    animateWrapper(wrapperScope.current, { width: open ? 100 : 0 }, { ease: 'easeInOut', duration: 0.4 });
  }, [open]);

  const gainValue = filter?.gain ?? 0.0;
  const qValue = filter?.q ?? 1.0;
  const freqValue = filter?.frequency ?? 1;

  // TODO: handle changes

  return (
    <Wrapper ref={wrapperScope}>
      <motion.div>
        <VBox $alignItems="center" $justifyContent="center">
          <Dial size={75} min={1} max={NYQUIST} step={0.5} value={freqValue} />
          <Dial size={100} min={-40} max={20} step={0.5} value={gainValue} />
          <Dial size={75} min={0.01} max={10} step={0.01} value={qValue} />
        </VBox>
      </motion.div>
    </Wrapper>
  );
}
