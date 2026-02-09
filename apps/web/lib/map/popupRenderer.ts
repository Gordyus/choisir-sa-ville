/**
 * Generic MapLibre Popup renderer
 * Handles positioning, styling, and lifecycle
 * Content is provided externally
 */

import maplibregl from "maplibre-gl";

export type PopupContent = {
    html: string;
    onClose?: () => void;
};

export type PopupOptions = {
    /** Delay before popup appears (ms) */
    openDelay?: number;
    /** Auto-close popup after delay (ms), or null for manual close */
    autoCloseDelay?: number | null;
};

export class GenericPopup {
    private popup: maplibregl.Popup | null = null;
    private map: maplibregl.Map;
    private openTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private options: PopupOptions;

    constructor(map: maplibregl.Map, options: PopupOptions = {}) {
        this.map = map;
        this.options = {
            openDelay: options.openDelay ?? 500,
            autoCloseDelay: options.autoCloseDelay ?? null
        };
    }

    /**
     * Show popup at specific coordinates with content
     * Respects openDelay from options
     */
    show(lngLat: maplibregl.LngLatLike, content: PopupContent): void {
        this.close();

        const openDelay = this.options.openDelay ?? 0;
        if (openDelay > 0) {
            this.openTimeoutId = setTimeout(() => {
                this.showImmediately(lngLat, content);
            }, openDelay);
        } else {
            this.showImmediately(lngLat, content);
        }
    }

    /** Show popup immediately without delay */
    private showImmediately(lngLat: maplibregl.LngLatLike, content: PopupContent): void {
        const container = document.createElement("div");
        container.innerHTML = content.html;

        this.popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor: "bottom-left",
            offset: 10
        })
            .setLngLat(lngLat)
            .setDOMContent(container)
            .addTo(this.map);

        // Auto-close if configured
        if (this.options.autoCloseDelay && this.options.autoCloseDelay > 0) {
            this.closeTimeoutId = setTimeout(() => {
                this.close();
            }, this.options.autoCloseDelay);
        }
    }

    /** Close popup and clear timeouts */
    close(): void {
        if (this.openTimeoutId) {
            clearTimeout(this.openTimeoutId);
            this.openTimeoutId = null;
        }
        if (this.closeTimeoutId) {
            clearTimeout(this.closeTimeoutId);
            this.closeTimeoutId = null;
        }
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
    }

    /** Check if popup is currently visible */
    isOpen(): boolean {
        return this.popup !== null;
    }
}
