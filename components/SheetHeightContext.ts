import { createContext, useContext } from 'react';
import type { MotionValue } from 'framer-motion';

// The pixel height of the currently-open pull-up SheetShell (0 when none is
// open). Shared so the map's floating controls can anchor to the sheet's top
// edge as it drags/snaps, instead of lifting a fixed amount.
export const SheetHeightContext = createContext<MotionValue<number> | null>(null);

export const useSheetHeight = () => useContext(SheetHeightContext);
