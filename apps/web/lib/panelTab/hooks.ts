"use client";

/**
 * usePanelTab — React hook for the panel tab service.
 *
 * Uses useSyncExternalStore for tear-free reads
 * from the panelTabService singleton.
 */

import { useCallback, useSyncExternalStore } from "react";

import { panelTabService, type PanelTab } from "./panelTabService";

function subscribe(onStoreChange: () => void): () => void {
    return panelTabService.subscribe(onStoreChange);
}

function getSnapshot(): PanelTab {
    return panelTabService.getTab();
}

function getServerSnapshot(): PanelTab {
    return "explorer";
}

export function usePanelTab(): [PanelTab, (tab: PanelTab) => void] {
    const tab = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setTab = useCallback((newTab: PanelTab) => {
        panelTabService.setTab(newTab);
    }, []);

    return [tab, setTab];
}
