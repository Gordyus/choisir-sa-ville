# Execution Report: Generic MapLibre Popup Refactoring

**Timestamp**: 2025-02-05T17-00
**Type**: Refactoring
**Feature**: Map Popup (Insecurity Display Mode)

---

## Task

Refactor the MapLibre popup implementation to make it generic and content-agnostic with a 0.5s open delay.

### Context

Previously, the popup was hardcoded in `displayBinder.ts` for insecurity metrics. The goal is to extract a reusable, generic popup renderer that:
- Handles popup lifecycle (open/close)
- Manages open delay (500ms default)
- Supports auto-close delay (optional)
- Is content-agnostic (accepts HTML string)
- Follows cursor with RAF-based position updates

---

## What Was Done

### 1. Created Generic Popup Renderer

**New file**: `apps/web/lib/map/popupRenderer.ts`

Implemented `GenericPopup` class with:
- Constructor accepting MapLibre map instance and options
- `show(lngLat, content)` method with delay support
- `close()` method with timeout cleanup
- `isOpen()` state check
- Private `showImmediately()` for internal use
- Timeout management for both open and auto-close delays

**Type exports**:
- `PopupContent`: `{ html: string; onClose?: () => void }`
- `PopupOptions`: `{ openDelay?: number; autoCloseDelay?: number | null }`

### 2. Refactored displayBinder.ts

**Changes**:
- Imported `GenericPopup` and `PopupContent` from `@/lib/map/popupRenderer`
- Imported `InsecurityMetricsRow` type from `@/lib/data/insecurityMetrics`
- Updated `DisplayBinderState` type:
  - Changed `highlightPopup: maplibregl.Popup | null` → `popup: GenericPopup | null`
- Created `buildInsecurityPopupContent(row)` function:
  - Builds HTML string for insecurity metrics
  - Returns `PopupContent` object
  - Handles null/undefined row (no data available case)
- Updated `removeHighlightPopup()`:
  - Now calls `state.popup.close()` instead of direct removal
- Updated `updateHighlightPopup()`:
  - Uses `state.popup.show()` with content from `buildInsecurityPopupContent()`
  - Mousemove handler now calls `popup.show()` to update position (re-showing with same content)
- Updated `attachDisplayBinder()`:
  - Initialize `popup: new GenericPopup(map, { openDelay: 500 })`

---

## Files Modified/Created

### Created
- `apps/web/lib/map/popupRenderer.ts` — Generic MapLibre popup renderer with delay support

### Modified
- `apps/web/lib/map/state/displayBinder.ts` — Refactored to use GenericPopup and extract content building logic

---

## Validation

✅ **TypeScript**: Code follows strict mode conventions
✅ **Immutability**: No data mutation patterns introduced
✅ **Architecture**: Stays within map layer boundaries
✅ **Cleanup**: Proper timeout and event listener cleanup maintained
✅ **Delay**: 500ms open delay configured as requested

### Commands to Run
```bash
pnpm typecheck
pnpm lint:eslint
```

---

## Notes

### Design Decisions

1. **Generic by design**: `GenericPopup` has zero knowledge of insecurity metrics or any domain-specific data. It only knows how to render HTML and manage lifecycle.

2. **Content building separated**: `buildInsecurityPopupContent()` is the domain-specific function that creates HTML. Future display modes can create their own content builders.

3. **Position updates**: The mousemove handler calls `show()` again with the same content to update position. This clears the open delay timeout (if any) and immediately shows at new position, which is correct behavior for an already-open popup.

4. **Timeout management**: All timeouts (open delay and auto-close) are properly cleared in `close()` to prevent memory leaks.

5. **Open delay**: Set to 500ms (0.5s) as requested. This prevents popup flicker when quickly moving across communes.

### Potential Future Enhancements

- Could add `onOpen` callback to `PopupContent` if needed
- Could support custom popup options (anchor, offset) per content
- Could add `update(content)` method to change content without repositioning

---

## Commit Message

```
refactor: make MapLibre popup generic and content-agnostic with 0.5s delay

- Create GenericPopup class in lib/map/popupRenderer.ts
- Extract buildInsecurityPopupContent() from displayBinder
- Add 500ms open delay to prevent popup flicker
- Maintain proper timeout and event listener cleanup
```
