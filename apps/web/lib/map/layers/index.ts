/**
 * Map Layers - Re-exports from layer modules
 */

export { injectAdminPolygons } from "./adminPolygons";
export {
    buildPlaceClassExcludeFilter,
    buildPlaceClassIncludeFilter,
    getPlaceClasses,
    isPlaceClass,
    setPlaceClasses
} from "./baseLabels";
export {
    ARR_MUNICIPAL_COLORS,
    ARR_MUNICIPAL_LINE_WIDTH,
    ARR_MUNICIPAL_OPACITY, COMMUNE_COLORS,
    COMMUNE_LINE_WIDTH,
    COMMUNE_OPACITY,
    LABEL_HALO_COLORS,
    LABEL_HALO_WIDTH,
    LABEL_TEXT_COLORS, buildFeatureStateCaseExpr,
    buildFillColorExpr,
    buildFillOpacityExpr,
    buildLineColorExpr,
    buildLineOpacityExpr,
    buildLineWidthExpr,
    buildTextColorExpr,
    buildTextHaloColorExpr,
    buildTextHaloWidthExpr
} from "./highlightState";

