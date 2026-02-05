/**
 * useDisplayMode.ts
 *
 * Hook React pour accéder au displayModeService
 * Wrapper léger autour du service singleton headless
 *
 * Usage:
 * const { mode, setMode } = useDisplayMode();
 *
 * Re-renders lors de changement du mode via displayModeService.setMode()
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { displayModeService, type DisplayMode } from "./displayModeService";

interface UseDisplayModeReturn {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
}

export function useDisplayMode(): UseDisplayModeReturn {
  const [mode, setModeState] = useState<DisplayMode>(
    displayModeService.getMode()
  );

  useEffect(() => {
    // Subscribe à tous les changements du service
    const unsubscribe = displayModeService.subscribe((newMode) => {
      setModeState(newMode);
    });

    // Cleanup: désabonner lors de l'unmount
    return unsubscribe;
  }, []);

  const setMode = useCallback((newMode: DisplayMode) => {
    displayModeService.setMode(newMode);
  }, []);

  return {
    mode,
    setMode,
  };
}
