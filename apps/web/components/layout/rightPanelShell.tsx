"use client";

/**
 * RightPanelShell
 *
 * Wraps the right panel with a tab system (Explorer / Recherche).
 * Tab state is driven by panelTabService so external components
 * (e.g. header) can switch tabs programmatically.
 */

import type { HTMLAttributes } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RightPanelDetailsCard } from "@/features/entity-details";
import { SearchPanel } from "@/features/guided-search";
import { usePanelTab, type PanelTab } from "@/lib/panelTab";
import { cn } from "@/lib/utils";

type RightPanelShellProps = HTMLAttributes<HTMLDivElement>;

export default function RightPanelShell({ className, ...props }: RightPanelShellProps): JSX.Element {
    const [tab, setTab] = usePanelTab();

    return (
        <section
            className={cn(
                "flex h-full w-full flex-col overflow-hidden rounded-3xl border border-brand/15 bg-white/80 shadow-lg backdrop-blur",
                className
            )}
            {...props}
        >
            <Tabs
                value={tab}
                onValueChange={(value) => { setTab(value as PanelTab); }}
                className="flex h-full flex-col"
            >
                <TabsList className="mx-3 mt-3 shrink-0 bg-brand/5">
                    <TabsTrigger
                        value="explorer"
                        className="flex-1 data-[state=active]:bg-white data-[state=active]:text-brand"
                    >
                        Explorer
                    </TabsTrigger>
                    <TabsTrigger
                        value="search"
                        className="flex-1 data-[state=active]:bg-white data-[state=active]:text-brand"
                    >
                        Recherche
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="explorer" className="mt-0 flex-1 overflow-y-auto">
                    <RightPanelDetailsCard className="h-full w-full" />
                </TabsContent>

                <TabsContent value="search" className="mt-0 flex-1 overflow-y-auto">
                    <SearchPanel />
                </TabsContent>
            </Tabs>
        </section>
    );
}
