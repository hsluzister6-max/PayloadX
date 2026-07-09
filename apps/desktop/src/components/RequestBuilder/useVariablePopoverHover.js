import { useEffect, useRef, useState } from 'react';

// Moved out of VariableEditPopover.jsx: a file exporting both a component and a
// plain hook breaks React Fast Refresh (Vite falls back to a full reload on every
// edit instead of HMR), so this hook gets its own module.
const CLOSE_DELAY_MS = 180;

export function useVariablePopoverHover() {
  const [popover, setPopover] = useState(null);
  const closeTimer = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPopover = (payload) => {
    clearCloseTimer();
    setPopover(payload);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setPopover(null);
    }, CLOSE_DELAY_MS);
  };

  const closePopover = () => {
    clearCloseTimer();
    setPopover(null);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return { popover, openPopover, scheduleClose, closePopover, clearCloseTimer };
}
