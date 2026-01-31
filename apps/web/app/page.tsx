"use client";

import { useState } from "react";

import RightPanel from "@/components/right-panel";
import VectorMap from "@/components/vector-map";
import type { CityIdentity } from "@/lib/map/interactiveLayers";

export default function HomePage(): JSX.Element {
    const [selectedCity, setSelectedCity] = useState<CityIdentity | null>(null);

    return (
        <section className="flex h-full w-full flex-1 flex-col gap-2 px-1 py-1 lg:flex-row">
            <div className="flex w-full flex-1 flex-col lg:w-[60%]">
                <div className="relative h-[320px] flex-1 rounded-3xl border border-brand/15 bg-white shadow-xl shadow-brand/5">
                    <VectorMap className="min-h-[320px] rounded-3xl" onCityClick={setSelectedCity} />
                </div>
            </div>
            <div className="h-full w-full lg:w-[40%]">
                <RightPanel className="h-full" selectedCity={selectedCity} />
            </div>
        </section>
    );
}
