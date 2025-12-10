import type { ReactNode } from "react";

export const useCodeSelection = () => {
  return {
    handleSelection: () => {},
    closeMenu: () => {},
    MenuComponent: null as ReactNode,
  };
};

const CodeSelectionMenu = () => null;

export default CodeSelectionMenu;
