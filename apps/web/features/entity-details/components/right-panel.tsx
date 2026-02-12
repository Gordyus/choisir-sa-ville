/**
 * Right Panel Component
 *
 * Displays analysis and details about the current selection.
 * Uses SelectionService - NO dependency on map components.
 */

import type { HTMLAttributes } from "react";

import { RightPanelDetailsCard } from "@/features/entity-details";
import { cn } from "@/lib/utils";

type RightPanelProps = HTMLAttributes<HTMLDivElement>;

export default function RightPanel({ className, ...props }: RightPanelProps): JSX.Element {
    return (
        <section
            className={cn(
                "flex h-full w-full flex-col overflow-hidden rounded-3xl border border-brand/15 bg-white/80 shadow-lg backdrop-blur",
                className
            )}
            {...props}
        >
            <RightPanelDetailsCard className="h-full w-full" />
        </section>
    );
}
