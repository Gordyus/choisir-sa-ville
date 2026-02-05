import * as React from "react";

import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Visual variant of the badge */
    variant?: "default" | "success" | "warning" | "danger" | "info";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-brand/10 text-brand-dark",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800"
};

/**
 * Badge component for displaying short status labels.
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => (
        <span
            ref={ref}
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                variantStyles[variant],
                className
            )}
            {...props}
        />
    )
);
Badge.displayName = "Badge";

export { Badge };
