"use client";

/**
 * MapLayerMenu Component
 *
 * Dropdown UI pour basculer le mode d'affichage de la choroplèthe
 * - Mode "default": Affichage standard (si défini)
 * - Mode "insecurity": Choroplèthe insécurité
 *
 * Propriétés:
 * - Positionnement: Fixed, top-left
 * - Backdrop: Click outside ferme le dropdown
 * - Icons: SVG inline (zéro dépendances)
 * - Styles: Tailwind CSS + shadcn/ui Button
 */

import { Button } from "@/components/ui/button";
import { useDisplayMode } from "@/lib/map/state/useDisplayMode";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

// ============================================================================
// Component
// ============================================================================

export function MapLayerMenu(): JSX.Element {
  const { mode, setMode } = useDisplayMode();
  const [isOpen, setIsOpen] = useState(false);

  const handleModeSelect = useCallback(
    (newMode: "default" | "insecurity") => {
      setMode(newMode);
      setIsOpen(false);
    },
    [setMode]
  );

  return (
    <>
      {/* Backdrop - click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Menu Container */}
      <div className="fixed left-4 top-4 z-50">
        {/* Toggle Button */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="subtle"
          size="sm"
          className={cn(
            "gap-2 rounded-lg shadow-md transition-all hover:shadow-lg",
            isOpen && "shadow-lg"
          )}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          {/* Layers Icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 2 7 2 17 12 22 22 17 22 7 12 2" />
            <polyline points="2 7 12 12 22 7" />
            <polyline points="2 17 12 12 22 17" />
          </svg>

          <span className="text-sm font-medium text-slate-700">Layers</span>

          {/* Chevron Icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute left-0 top-full mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg"
            role="menu"
          >
            {/* Default Mode */}
            <Button
              onClick={() => handleModeSelect("default")}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start gap-3 rounded-none px-4 py-3 text-left",
                mode === "default" && "bg-blue-50 text-blue-700"
              )}
              role="menuitem"
            >
              {/* Checkmark */}
              {mode === "default" && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {mode !== "default" && <div className="w-4" />}

              <span className="text-sm font-medium">Default</span>
            </Button>

            {/* Insecurity Mode */}
            <Button
              onClick={() => handleModeSelect("insecurity")}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start gap-3 rounded-none border-t border-slate-200 px-4 py-3 text-left",
                mode === "insecurity" && "bg-blue-50 text-blue-700"
              )}
              role="menuitem"
            >
              {/* Checkmark */}
              {mode === "insecurity" && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {mode !== "insecurity" && <div className="w-4" />}

              <span className="text-sm font-medium">Insecurity</span>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
