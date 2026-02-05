/**
 * displayModeService.ts
 *
 * Service observable SANS DÉPENDANCE React/MapLibre
 * Gère l'état global du mode d'affichage (default | insecurity)
 *
 * Architecture:
 * - Singleton headless (aucune UI, aucune side-effect MapLibre)
 * - EventEmitter-style pour subscription
 * - État persisté dans sessionStorage
 *
 * Utilisateurs:
 * - useDisplayMode hook (React wrapper)
 * - displayBinder (logique MapLibre)
 * - mapInteractionService (si besoin)
 */

export type DisplayMode = "default" | "insecurity";

interface Subscriber {
  (mode: DisplayMode): void;
}

class DisplayModeService {
  private mode: DisplayMode = "default";
  private subscribers: Set<Subscriber> = new Set();
  private storageKey = "displayMode";

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Charge le mode depuis sessionStorage (optionnel)
   * Fallback: default
   */
  private loadFromStorage(): void {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(this.storageKey);
    if (stored === "insecurity" || stored === "default") {
      this.mode = stored;
    }
  }

  /**
   * Persiste le mode dans sessionStorage
   */
  private saveToStorage(): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(this.storageKey, this.mode);
  }

  /**
   * Retourne le mode actuel
   */
  getMode(): DisplayMode {
    return this.mode;
  }

  /**
   * Change le mode et notifie tous les subscribers
   */
  setMode(mode: DisplayMode): void {
    if (this.mode === mode) return; // Idempotence

    this.mode = mode;
    this.saveToStorage();
    this.notifySubscribers();
  }

  /**
   * S'abonne aux changements de mode
   * Retourne fonction de désabonnement
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);

    // Retourner fonction cleanup
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notifie tous les subscribers
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.mode);
      } catch (error) {
        console.error("Error in displayMode subscriber:", error);
      }
    });
  }

  /**
   * Réinitialise à default (utile pour cleanup)
   */
  reset(): void {
    this.setMode("default");
    this.subscribers.clear();
  }
}

// Singleton instance
export const displayModeService = new DisplayModeService();
