/**
 * panelTabService.ts
 *
 * Observable service for the active right-panel tab.
 * Same singleton pattern as displayModeService — pure TypeScript,
 * no React or MapLibre dependency.
 *
 * No sessionStorage persistence: tab resets to "explorer" on page load.
 */

export type PanelTab = "explorer" | "search";

interface Subscriber {
    (tab: PanelTab): void;
}

class PanelTabService {
    private tab: PanelTab = "explorer";
    private subscribers: Set<Subscriber> = new Set();

    /** Returns the current active tab. */
    getTab(): PanelTab {
        return this.tab;
    }

    /** Changes the active tab and notifies all subscribers. */
    setTab(tab: PanelTab): void {
        if (this.tab === tab) return;

        this.tab = tab;
        this.notifySubscribers();
    }

    /**
     * Subscribes to tab changes.
     * Returns an unsubscribe function.
     */
    subscribe(callback: Subscriber): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /** Resets to default tab and clears all subscribers. */
    reset(): void {
        this.tab = "explorer";
        this.subscribers.clear();
    }

    private notifySubscribers(): void {
        this.subscribers.forEach((callback) => {
            try {
                callback(this.tab);
            } catch (error) {
                console.error("Error in panelTab subscriber:", error);
            }
        });
    }
}

/** Singleton instance */
export const panelTabService = new PanelTabService();
