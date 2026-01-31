"use client";

interface DebugOverlayProps {
    zoom: number;
    communesCount: number;
    infraCount?: number;
}

export default function DebugOverlay({ zoom, communesCount, infraCount }: DebugOverlayProps): JSX.Element {
    const hasInfra = typeof infraCount === "number";
    const total = hasInfra ? communesCount + (infraCount ?? 0) : communesCount;

    return (
        <div className="pointer-events-none select-none space-y-1 rounded-xl border border-white/30 bg-black/70 px-4 py-2 text-xs font-mono text-white shadow-lg backdrop-blur">
            <p>zoom {zoom.toFixed(2)}</p>
            <p>communes {communesCount}</p>
            {hasInfra ? <p>total {total}</p> : null}
        </div>
    );
}
