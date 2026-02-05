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
 * - Styles: Tailwind CSS
 */

import { useDisplayMode } from "@/lib/map/state/useDisplayMode";
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
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md transition-all hover:shadow-lg"
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
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute left-0 top-full mt-2 w-40 rounded-lg border border-slate-200 bg-white shadow-lg"
            role="menu"
          >
            {/* Default Mode */}
            <button
              onClick={() => handleModeSelect("default")}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                mode === "default"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
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
            </button>

            {/* Insecurity Mode */}
            <button
              onClick={() => handleModeSelect("insecurity")}
              className={`flex w-full items-center gap-3 border-t border-slate-200 px-4 py-3 text-left transition-colors ${
                mode === "insecurity"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
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
            </button>
          </div>
        )}
      </div>
    </>
  );
}
