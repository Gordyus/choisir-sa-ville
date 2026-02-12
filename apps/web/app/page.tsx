"use client";

/**
 * Home Page
 *
 * Main application layout with map and right panel.
 * NO local selection state - uses centralized SelectionService.
 */

import RightPanel from "@/features/entity-details/components/right-panel";
import VectorMap from "@/features/map-viewer/components/vector-map";

export default function HomePage(): JSX.Element {
    return (
        <section className="flex min-h-0 w-full flex-1 flex-col gap-2 px-1 py-1 lg:flex-row">
            <div className="flex min-h-0 w-full flex-1 flex-col lg:w-[60%]">
                <div className="relative min-h-[320px] flex-1 rounded-3xl border border-brand/15 bg-white shadow-xl shadow-brand/5">
                    <VectorMap className="min-h-[320px] rounded-3xl" />
                </div>
            </div>
            <div className="min-h-0 w-full lg:w-[40%]">
                <RightPanel className="h-full" />
            </div>
        </section>
    );
}
