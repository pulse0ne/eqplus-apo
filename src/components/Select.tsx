import { FloatingFocusManager, FloatingList, autoUpdate, flip, size, useClick, useDismiss, useFloating, useInteractions, useListItem, useListNavigation, useRole } from '@floating-ui/react';
import { PropsWithChildren, ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

interface SelectContextValue {
  activeIndex: number | null;
  selectedIndex: number | null;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  handleSelect: (index: number | null) => void;
}

const SelectContext = createContext<SelectContextValue>({} as SelectContextValue);

const CurrentSelection = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  padding: 4px 6px;
`;

function Select({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number|null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number|null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string|null>(null);

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom',
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      flip(),
      size({
        apply({ rects, elements}) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`
          })
        }
      })
    ]
  });

  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);

  const handleSelect = useCallback((index: number | null) => {
    setSelectedIndex(index);
    setIsOpen(false);
    if (index !== null) {
      setSelectedLabel(labelsRef.current[index]);
    }
  }, []);

  const listNav = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    selectedIndex,
    onNavigate: setActiveIndex
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "listbox" });

  const {
    getReferenceProps,
    getFloatingProps,
    getItemProps
  } = useInteractions([listNav, click, dismiss, role]);

  const selectContext = useMemo(() => ({
    activeIndex,
    selectedIndex,
    getItemProps,
    handleSelect
  }), [activeIndex, selectedIndex, getItemProps, handleSelect]);

  return (
    <>
      <CurrentSelection ref={refs.setReference} {...getReferenceProps()}>
        {selectedLabel ?? 'Select...'}
      </CurrentSelection>
      <SelectContext.Provider value={selectContext}>
        {isOpen && (
          <FloatingFocusManager context={context} modal={false}>
            <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
              <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
                {children}
              </FloatingList>
            </div>
          </FloatingFocusManager>
        )}
      </SelectContext.Provider>
    </>
  );
}

type OptionWrapperProps = {
  $isActive: boolean,
  $isSelected: boolean
};

const OptionWrapper = styled.div.attrs<OptionWrapperProps>(({ $isActive, $isSelected, theme }) => ({
  style: {
    background: $isActive || $isSelected ? theme.colors.accentPrimary : undefined,
    color: $isActive || $isSelected ? theme.colors.background : undefined
  }
}))<OptionWrapperProps>`
  padding: 4px 6px;
`;

export type SelectOptionProps = {
  value: string
};

function SelectOption({ value, children }: PropsWithChildren<SelectOptionProps>) {
  const {
    activeIndex,
    selectedIndex,
    getItemProps,
    handleSelect
  } = useContext(SelectContext);
  const { ref, index } = useListItem({ label: value });

  const isActive = activeIndex === index;
  const isSelected = selectedIndex === index;

  return (
    <>
      <OptionWrapper
        ref={ref}
        $isActive={isActive}
        $isSelected={isSelected}
        {...getItemProps({ onClick: () => handleSelect(index) })}
      >
        {children}
      </OptionWrapper>
    </>
  );
}

export { Select, SelectOption };
