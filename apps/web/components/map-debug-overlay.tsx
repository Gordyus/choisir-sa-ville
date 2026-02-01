import type { JSX } from "react";

type MapDebugOverlayProps = {
    zoom: number | null;
};

export function MapDebugOverlay({ zoom }: MapDebugOverlayProps): JSX.Element | null {
    if (zoom === null) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[400]">
            <div className="rounded-2xl border border-white/40 bg-white/90 px-4 py-3 text-xs text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Zoom</div>
                <div className="text-lg font-mono font-semibold text-slate-900">{zoom.toFixed(2)}</div>
            </div>
        </div>
    );
}
