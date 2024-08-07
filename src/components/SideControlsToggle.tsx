import { motion, useAnimate } from "framer-motion";
import { useEffect } from "react";
import styled from "styled-components";

const SideControlsToggleWrapper = styled.div(({ theme }) => `
  position: absolute;
  top: 6px;
  left: -20px;
  width: 20px;
  height: 24px;
  background: ${theme.colors.background};
  color: ${theme.colors.textPrimary};
  display: flex;
  justify-content: center;
  align-items: center;
`);

export type SideControlsToggleProps = {
  open: boolean,
  onClick: () => void
};

const SideControlsToggle = ({ open, onClick }: SideControlsToggleProps) => {
  const [ scope, animate ] = useAnimate();

  useEffect(() => {
    animate(scope.current, { rotate: open ? 0 : 180 });
  }, [open]);
  
  return (
    <SideControlsToggleWrapper onClick={onClick}>
      <motion.i
        ref={scope}
        className="icon arrow_right"
        style={{ fontSize: 16 }}
      />
    </SideControlsToggleWrapper>
  );
};

export { SideControlsToggle };
