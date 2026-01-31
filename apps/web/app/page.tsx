"use client";

import { useCallback, useState } from "react";

import DebugOverlay from "@/components/debug-overlay";
import OsmMap from "@/components/osm-map";
import RightPanel from "@/components/right-panel";

interface MapDebugState {
    zoom: number;
    communesCount: number;
    infraCount: number;
}

export default function HomePage(): JSX.Element {
    const [debugState, setDebugState] = useState<MapDebugState | null>(null);
    const showDebug = process.env.NODE_ENV === "development";

    const handleDebugChange = useCallback((next: MapDebugState) => {
        setDebugState((prev) => {
            if (
                prev &&
                prev.zoom === next.zoom &&
                prev.communesCount === next.communesCount &&
                prev.infraCount === next.infraCount
            ) {
                return prev;
            }
            return next;
        });
    }, []);

    return (
        <section className="flex h-full w-full flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
            <div className="flex w-full flex-1 flex-col lg:w-[60%]">
                <div className="relative h-[320px] flex-1 rounded-3xl border border-brand/15 bg-white shadow-xl shadow-brand/5">
                    <OsmMap
                        className="min-h-[320px] rounded-3xl"
                        onDebugChange={showDebug ? handleDebugChange : undefined}
                    />
                    {showDebug && debugState ? (
                        <div className="pointer-events-none absolute bottom-3 left-3 z-[400]">
                            <DebugOverlay
                                zoom={debugState.zoom}
                                communesCount={debugState.communesCount}
                                infraCount={debugState.infraCount}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="w-full lg:w-[40%]">
                <RightPanel className="h-full" />
            </div>
        </section>
    );
}
