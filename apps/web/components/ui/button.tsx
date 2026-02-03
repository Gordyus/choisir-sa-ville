import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
    {
        variants: {
            variant: {
                default: "bg-brand text-white hover:bg-brand-light focus-visible:outline-brand",
                subtle:
                    "bg-white/80 text-brand-dark border border-brand/20 hover:bg-white focus-visible:outline-brand",
                ghost:
                    "bg-transparent text-brand hover:bg-brand/10 focus-visible:outline-brand-dark"
            },
            size: {
                default: "h-10 px-6 py-2",
                sm: "h-9 px-3",
                lg: "h-12 px-8 text-base"
            }
        },
        compoundVariants: [
            {
                variant: "ghost",
                size: "sm",
                className: "px-2"
            }
        ],
        defaultVariants: {
            variant: "default",
            size: "default"
        }
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
