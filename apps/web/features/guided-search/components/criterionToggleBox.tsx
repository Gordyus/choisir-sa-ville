"use client";

/**
 * Toggle box for a search criterion — Flipboard-style card.
 * Selected state shows brand border + checkmark.
 */

interface CriterionToggleBoxProps {
    id: string;
    label: string;
    icon: string;
    selected: boolean;
    disabled?: boolean | undefined;
    disabledLabel?: string | undefined;
    onToggle: (id: string) => void;
}

export default function CriterionToggleBox({
    id,
    label,
    icon,
    selected,
    disabled = false,
    disabledLabel,
    onToggle,
}: CriterionToggleBoxProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(id)}
            className={
                "relative flex flex-col items-center justify-center gap-1 rounded-lg p-2 h-[5rem] font-medium transition-all " +
                (disabled
                    ? "opacity-50 cursor-not-allowed bg-gray-50 border border-gray-200 text-gray-400"
                    : selected
                      ? "bg-brand/5 border-2 border-brand text-brand"
                      : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100")
            }
        >
            {selected && !disabled && (
                <span className="absolute top-1 right-1 text-brand text-xs">&#10003;</span>
            )}
            <span className="text-xl leading-none">{icon}</span>
            <span className="leading-tight text-center text-xs">{label}</span>
            {disabled && disabledLabel && (
                <span className="inline-flex items-center rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">
                    {disabledLabel}
                </span>
            )}
        </button>
    );
}
