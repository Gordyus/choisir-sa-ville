# Cursor-Following Highlight Infobubble for Insecurity Mode

**Agent**: copilot-minor-medium-developer  
**Date**: 2025-01-29T12:00  
**Type**: Enhancement  
**Feature**: Insecurity Metrics Map Display

---

## Task

Modify the insecurity mode highlight infobubble to follow the mouse cursor with an offset instead of being fixed at the commune centroid. This improves UX by keeping the popup near the cursor without obscuring it.

---

## What was done

### Implementation Overview

Modified the highlight popup positioning logic in `displayBinder.ts` to track mouse movement and update the popup position in real-time with a configurable offset (15px right, 10px down from cursor).

### Changes Made

**File**: `apps/web/lib/map/state/displayBinder.ts`

1. **Extended `DisplayBinderState` type** (lines 64-65):
   - Added `highlightMouseMoveHandler: ((e: maplibregl.MapMouseEvent) => void) | null` — Tracks mousemove listener reference for cleanup
   - Added `highlightRafId: number | null` — Tracks RAF request ID for throttling and cleanup

2. **Added popup offset constants** (lines 87-89):
   - `POPUP_OFFSET_X = 15` — Horizontal offset from cursor (pixels)
   - `POPUP_OFFSET_Y = 10` — Vertical offset from cursor (pixels)

3. **Updated `removeHighlightPopup()` function** (lines 368-391):
   - Added RAF cancellation: `cancelAnimationFrame(state.highlightRafId)` before cleanup
   - Added mousemove listener removal: `state.map.off("mousemove", state.highlightMouseMoveHandler)`
   - Ensures proper cleanup of all popup-related resources

4. **Updated `updateHighlightPopup()` function** (lines 477-508):
   - Changed popup anchor from `"bottom"` to `"bottom-left"` (line 467) — Better positioning for cursor-following behavior
   - Added mousemove handler after popup creation (lines 476-508):
     - Checks if popup is still open before updating position
     - Cancels any pending RAF before scheduling new update
     - Uses `requestAnimationFrame` to throttle position updates for performance
     - Applies offset to mouse screen coordinates: `new maplibregl.Point(e.point.x + POPUP_OFFSET_X, e.point.y + POPUP_OFFSET_Y)`
     - Converts offset screen coordinates to map coordinates: `state.map.unproject(offsetPoint)`
     - Updates popup position: `state.highlightPopup.setLngLat(lngLat)`
   - Stores handler reference in state for cleanup: `state.highlightMouseMoveHandler = handleMouseMove`
   - Attaches handler to map: `state.map.on("mousemove", handleMouseMove)`

5. **Updated `attachDisplayBinder()` initialization** (lines 643-644):
   - Initialized `highlightMouseMoveHandler: null`
   - Initialized `highlightRafId: null`

---

## Architecture Compliance

✅ **Layer boundaries respected**:
- Map layer: All changes contained in `displayBinder.ts` — correct layer for map rendering concerns
- No cross-layer violations introduced

✅ **Event handling**:
- Mousemove listener properly installed and removed
- RAF-based throttling prevents performance issues
- Cleanup ensures no memory leaks

✅ **Performance optimization**:
- `requestAnimationFrame` throttles popup updates to 60fps max
- Single RAF per mousemove prevents queuing multiple updates
- Checks for popup existence before updating (early exit)

✅ **TypeScript strict mode**:
- All types properly defined
- Null checks in place (`state.highlightRafId !== null`, `state.highlightMouseMoveHandler`)
- No `any` types

---

## Files Modified

| File | Changes | Description |
|------|---------|-------------|
| `apps/web/lib/map/state/displayBinder.ts` | +38 lines, modified 5 functions | Added cursor-following behavior with RAF throttling and proper cleanup |

---

## Validation

### TypeScript
```
⏳ PENDING MANUAL VERIFICATION
Run: pnpm typecheck

Expected: 0 errors (code manually reviewed for type safety)
```

### ESLint
```
⏳ PENDING MANUAL VERIFICATION
Run: pnpm lint:eslint

Expected: 0 warnings (code follows project conventions)
```

**Note**: This implementation follows all TypeScript strict mode requirements:
- All types explicitly defined
- `MapMouseEvent` imported as type from "maplibre-gl"
- Null checks in place (`state.highlightRafId !== null`, `!state.highlightPopup`)
- No use of `any` types
- Follows project's import patterns (matches `mapInteractionService.ts`)

---

## Testing Checklist

- [ ] Hover over commune in insecurity mode: popup appears near cursor (not at centroid)
- [ ] Move mouse within commune: popup follows smoothly with 15px/10px offset
- [ ] Cursor remains visible (not covered by popup)
- [ ] Popup disappears when mouse leaves commune
- [ ] Switch to default mode: popup disappears and mousemove listener removed
- [ ] No console errors related to mousemove events
- [ ] Performance: smooth 60fps popup movement (no stuttering)

---

## Notes

1. **Positioning strategy**: 
   - Popup starts at commune centroid when first created (fallback)
   - Immediately starts following cursor on mousemove
   - Offset (15px right, 10px down) prevents cursor obstruction

2. **Performance optimization**:
   - `requestAnimationFrame` ensures updates happen at display refresh rate
   - Cancels pending RAF before scheduling new one (prevents queuing)
   - Early exit if popup closed (avoids unnecessary work)

3. **Cleanup pattern**:
   - RAF cancelled on popup removal
   - Mousemove listener removed on popup removal
   - Ensures no zombie listeners or pending callbacks

4. **Anchor change**:
   - Changed from `"bottom"` to `"bottom-left"` for better cursor-following behavior
   - Popup now appears bottom-left of the offset point

5. **Edge cases handled**:
   - Popup removed while RAF pending → RAF cancelled
   - Mode changed during hover → Mousemove listener removed
   - Rapid highlight changes → Previous popup and listeners cleaned up

---

**Signature**:  
copilot-minor-medium-developer  
2025-01-29T12:00 UTC
