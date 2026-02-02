import type {
    ExpressionSpecification,
    FillLayerSpecification,
    LegacyFilterSpecification,
    LineLayerSpecification,
    StyleSpecification,
    SymbolLayerSpecification,
    VectorSourceSpecification
} from "maplibre-gl";

import type { CityLabelStyleConfig, MapTilesConfig, PolygonSourceConfig, PolygonSourcesConfig, TileJsonSourceMap } from "@/lib/config/mapTilesConfig";
import {
    ADMIN_POLYGON_LAYER_SPECS,
    ARR_MUNICIPAL_SOURCE_ID,
    BASE_COMMUNE_LABEL_LAYER_IDS,
    buildManagedCityLabelLayerId,
    buildPlaceClassExcludeFilter,
    buildPlaceClassFilter,
    CITY_ID_FIELD,
    COMMUNE_LABEL_LAYERS,
    COMMUNE_POLYGON_SOURCE_ID,
    MANAGED_CITY_LABEL_METADATA_BASE_ID,
    MANAGED_CITY_LABEL_METADATA_FLAG,
    setPlaceClassList
} from "@/lib/map/interactiveLayers";

type LoadVectorMapStyleOptions = {
    enableManagedCityLabels?: boolean;
};

type VectorLayerAvailability = Map<string, Set<string>>;

export async function loadVectorMapStyle(
    config: MapTilesConfig,
    signal?: AbortSignal,
    options?: LoadVectorMapStyleOptions
): Promise<StyleSpecification> {
    const [style, availableLayers, auxiliaryAvailability] = await Promise.all([
        fetchJson<StyleSpecification>(config.styleUrl, signal),
        loadVectorLayerNames(config.tilesMetadataUrl, signal).catch(() => null),
        loadTileJsonAvailability(config.tileJsonSources, signal)
    ]);

    if (!Array.isArray(style.layers)) {
        return style;
    }

    const availableLayerSet = availableLayers ? new Set(availableLayers) : null;
    const excludedLayerSet = buildStringSet(config.excludeLayers);
    const optionalSourceLayerSet = buildStringSet(config.optionalSourceLayers);

    const sanitizedLayers = style.layers.filter((layer) => {
        const sourceLayer = (layer as { "source-layer"?: unknown })["source-layer"];
        if (shouldHideLayer(layer, sourceLayer, excludedLayerSet)) {
            console.info(`[map-style] Removing layer ${layer.id} via excludeLayers setting.`);
            return false;
        }

        if (shouldHideOptionalSourceLayer(layer, sourceLayer, optionalSourceLayerSet, availableLayerSet)) {
            return false;
        }

        if (availableLayerSet && typeof sourceLayer === "string" && !availableLayerSet.has(sourceLayer)) {
            console.warn(`[map-style] Removing layer ${layer.id} referencing missing source-layer ${sourceLayer}`);
            return false;
        }

        return true;
    });

    setPlaceClassList(config.cityClasses);
    const placeIncludeFilter = buildPlaceClassFilter();
    const placeExcludeFilter = buildPlaceClassExcludeFilter();

    const managedEnabled = options?.enableManagedCityLabels ?? true;
    const finalLayers =
        managedEnabled && !hasManagedCityLayers(sanitizedLayers)
            ? splitCityLabelLayers(
                sanitizedLayers,
                new Set(config.cityLabelLayerIds ?? Array.from(BASE_COMMUNE_LABEL_LAYER_IDS)),
                config.cityLabelStyle,
                placeIncludeFilter,
                placeExcludeFilter
            )
            : sanitizedLayers;

    const nextStyle: StyleSpecification = {
        ...style,
        layers: finalLayers,
        sources: { ...(style.sources ?? {}) }
    };

    injectAdministrativeSourcesAndLayers(nextStyle, config, auxiliaryAvailability);

    return nextStyle;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[map-style] Failed to fetch ${url} (${response.status})`);
    }
    return (await response.json()) as T;
}

async function loadVectorLayerNames(url: string | undefined, signal?: AbortSignal): Promise<string[]> {
    if (!url) {
        return [];
    }
    const metadata = await fetchJson<{
        vector_layers?: Array<{ id?: string; name?: string }>;
    }>(url, signal);
    const layers = metadata.vector_layers ?? [];
    return layers
        .map((layer) => layer.name || layer.id)
        .filter((name): name is string => typeof name === "string" && name.length > 0);
}

function buildStringSet(layers?: string[]): Set<string> | null {
    if (!layers || layers.length === 0) {
        return null;
    }
    return new Set(layers);
}

function shouldHideLayer(
    layer: { id?: string | number },
    sourceLayer: unknown,
    excludedLayerSet: Set<string> | null
): boolean {
    if (!excludedLayerSet || excludedLayerSet.size === 0) {
        return false;
    }

    const sourceLayerName = typeof sourceLayer === "string" ? sourceLayer : null;
    if (typeof layer.id === "string" && excludedLayerSet.has(layer.id)) {
        return true;
    }
    if (sourceLayerName && excludedLayerSet.has(sourceLayerName)) {
        return true;
    }
    return false;
}

function shouldHideOptionalSourceLayer(
    layer: { id?: string | number },
    sourceLayer: unknown,
    optionalSet: Set<string> | null,
    availableLayerSet: Set<string> | null
): boolean {
    if (!optionalSet || optionalSet.size === 0) {
        return false;
    }
    const sourceLayerName = typeof sourceLayer === "string" ? sourceLayer : null;
    if (!sourceLayerName || !optionalSet.has(sourceLayerName)) {
        return false;
    }
    if (availableLayerSet && availableLayerSet.has(sourceLayerName)) {
        return false;
    }
    console.info(`[map-style] Removing optional layer ${layer.id ?? "<unknown>"} referencing ${sourceLayerName}.`);
    return true;
}

function hasManagedCityLayers(layers: StyleSpecification["layers"]): boolean {
    return layers.some((layer) => Boolean(readManagedMetadataFlag(layer)));
}

function splitCityLabelLayers(
    layers: StyleSpecification["layers"],
    targetIds: Set<string>,
    styleOverrides: CityLabelStyleConfig | undefined,
    includeFilter: LegacyFilterSpecification,
    excludeFilter: LegacyFilterSpecification
): StyleSpecification["layers"] {
    if (!targetIds.size) {
        return layers;
    }

    let applied = false;
    const result: typeof layers = [];
    for (const layer of layers) {
        if (shouldSplitLayer(layer, targetIds)) {
            // We duplicate the original OMT label so only city/town/village classes move into
            // our managed layer while the base layer keeps every other settlement label untouched.
            const { baseLayer, managedLayer } = buildManagedLayerPair(
                layer as SymbolLayerSpecification,
                styleOverrides,
                includeFilter,
                excludeFilter
            );
            result.push(managedLayer, baseLayer);
            applied = true;
        } else {
            result.push(layer);
        }
    }

    return applied ? result : layers;
}

function shouldSplitLayer(layer: StyleSpecification["layers"][number], targetIds: Set<string>): boolean {
    if (!targetIds.size) {
        return false;
    }
    if (layer.type !== "symbol" || typeof layer.id !== "string") {
        return false;
    }
    if (!targetIds.has(layer.id)) {
        return false;
    }
    return true;
}

function buildManagedLayerPair(
    layer: SymbolLayerSpecification,
    styleOverrides: CityLabelStyleConfig | undefined,
    includeFilter: LegacyFilterSpecification,
    excludeFilter: LegacyFilterSpecification
): {
    baseLayer: SymbolLayerSpecification;
    managedLayer: SymbolLayerSpecification;
} {
    const baseLayer = cloneLayer(layer);
    const managedLayer = cloneLayer(layer);
    const originalFilter = layer.filter as LegacyFilterSpecification | undefined;

    baseLayer.filter = combineFilters(originalFilter, cloneFilter(excludeFilter));
    managedLayer.filter = combineFilters(originalFilter, cloneFilter(includeFilter));
    managedLayer.id = buildManagedCityLabelLayerId(String(layer.id));
    managedLayer.paint = buildManagedPaint(layer.paint, styleOverrides);
    managedLayer.metadata = buildManagedMetadata(layer);
    applyLayoutOverrides(managedLayer, styleOverrides);
    applyHoverResponsiveTextSize(managedLayer);

    return { baseLayer, managedLayer };
}

type SymbolPaint = Exclude<SymbolLayerSpecification["paint"], undefined>;

const DEFAULT_TEXT_COLOR = "#1f2933";
const HOVER_TEXT_COLOR = "#1130ff";
const SELECTED_TEXT_COLOR = "#0f172a";
const DEFAULT_HALO_COLOR = "#f7f4ef";
const HOVER_HALO_COLOR = "#ffffff";
const SELECTED_HALO_COLOR = "#ffe28f";
const DEFAULT_HALO_WIDTH = 1.5;
const HOVER_HALO_WIDTH = 2.2;
const SELECTED_HALO_WIDTH = 2.8;

const COMMUNE_LAYER_ZOOM_RANGE: [number, number] = [9, 14];
const ARRONDISSEMENT_LAYER_ZOOM_RANGE: [number, number] = [11, 14];
const COMMUNE_FILL_BASE_COLOR = "#0f172a";
const COMMUNE_FILL_HOVER_COLOR = "#2d5bff";
const COMMUNE_FILL_SELECTED_COLOR = "#f59e0b";
const COMMUNE_FILL_BASE_OPACITY = 0;
const COMMUNE_FILL_HOVER_OPACITY = 0.16;
const COMMUNE_FILL_SELECTED_OPACITY = 0.24;
const COMMUNE_LINE_BASE_COLOR = "#0f172a";
const COMMUNE_LINE_HOVER_COLOR = "#2d5bff";
const COMMUNE_LINE_SELECTED_COLOR = "#f59e0b";
const COMMUNE_LINE_BASE_OPACITY = 0;
const COMMUNE_LINE_HOVER_OPACITY = 0.85;
const COMMUNE_LINE_SELECTED_OPACITY = 1;
const COMMUNE_LINE_HOVER_STOPS: Array<[number, number]> = [
    [9, 0.8],
    [12, 1.4],
    [14, 2]
];
const COMMUNE_LINE_SELECTED_STOPS: Array<[number, number]> = [
    [9, 1],
    [12, 1.8],
    [14, 2.4]
];

const ARR_FILL_BASE_COLOR = "#082032";
const ARR_FILL_HOVER_COLOR = "#38bdf8";
const ARR_FILL_SELECTED_COLOR = "#f59e0b";
const ARR_FILL_BASE_OPACITY = 0;
const ARR_FILL_HOVER_OPACITY = 0.12;
const ARR_FILL_SELECTED_OPACITY = 0.2;
const ARR_LINE_BASE_COLOR = "#0f172a";
const ARR_LINE_HOVER_COLOR = "#38bdf8";
const ARR_LINE_SELECTED_COLOR = "#f59e0b";
const ARR_LINE_BASE_OPACITY = 0;
const ARR_LINE_HOVER_OPACITY = 0.85;
const ARR_LINE_SELECTED_OPACITY = 1;
const ARR_LINE_HOVER_STOPS: Array<[number, number]> = [
    [11, 0.6],
    [13, 1.1],
    [14, 1.6]
];
const ARR_LINE_SELECTED_STOPS: Array<[number, number]> = [
    [11, 0.8],
    [13, 1.4],
    [14, 2]
];

function buildManagedPaint(
    paint: SymbolLayerSpecification["paint"],
    overrides?: CityLabelStyleConfig
): SymbolPaint {
    const base: SymbolPaint = paint ? ({ ...(paint as Record<string, unknown>) } as SymbolPaint) : {};

    const baseTextColor = overrides?.textColor ?? getPaintValue(base, "text-color", DEFAULT_TEXT_COLOR);
    const hoverTextColor = overrides?.hoverTextColor ?? HOVER_TEXT_COLOR;
    const selectedTextColor = overrides?.selectedTextColor ?? SELECTED_TEXT_COLOR;
    base["text-color"] = buildStatefulPaintValue(baseTextColor, hoverTextColor, selectedTextColor);

    const baseHaloColor = overrides?.textHaloColor ?? getPaintValue(base, "text-halo-color", DEFAULT_HALO_COLOR);
    const hoverHaloColor = overrides?.hoverTextHaloColor ?? HOVER_HALO_COLOR;
    const selectedHaloColor = overrides?.selectedTextHaloColor ?? SELECTED_HALO_COLOR;
    base["text-halo-color"] = buildStatefulPaintValue(baseHaloColor, hoverHaloColor, selectedHaloColor);

    const baseHaloWidth = overrides?.textHaloWidth ?? getPaintValue(base, "text-halo-width", DEFAULT_HALO_WIDTH);
    const hoverHaloWidth = overrides?.hoverTextHaloWidth ?? HOVER_HALO_WIDTH;
    const selectedHaloWidth = overrides?.selectedTextHaloWidth ?? SELECTED_HALO_WIDTH;
    base["text-halo-width"] = buildStatefulPaintValue(baseHaloWidth, hoverHaloWidth, selectedHaloWidth);

    return base;
}

function applyLayoutOverrides(layer: SymbolLayerSpecification, overrides?: CityLabelStyleConfig): void {
    if (!overrides) {
        return;
    }
    const layout = (layer.layout = { ...(layer.layout ?? {}) });
    if (overrides.textFont?.length) {
        layout["text-font"] = overrides.textFont;
    }
    if (typeof overrides.textSize !== "undefined") {
        layout["text-size"] = overrides.textSize as SymbolLayerSpecification["layout"]["text-size"];
    }
}

function applyHoverResponsiveTextSize(layer: SymbolLayerSpecification): void {
    const layout = (layer.layout = { ...(layer.layout ?? {}) });
    const baseValue = layout["text-size"];
    if (typeof baseValue === "undefined") {
        return;
    }
    if (typeof baseValue === "number" || Array.isArray(baseValue)) {
        layout["text-size"] = buildStatefulNumericExpression(baseValue as number | ExpressionSpecification, 1.5, 2);
    }
}

function buildStatefulPaintValue(
    baseValue: unknown,
    hoverValue: unknown,
    selectedValue: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        selectedValue,
        ["boolean", ["feature-state", "hover"], false],
        hoverValue,
        baseValue
    ] as ExpressionSpecification;
}

function getPaintValue(paint: SymbolPaint, key: keyof SymbolPaint, fallback: unknown): unknown {
    const value = paint[key];
    return typeof value === "undefined" ? fallback : value;
}

function buildStatefulNumericExpression(
    baseValue: number | ExpressionSpecification,
    hoverDelta: number,
    selectedDelta: number
): ExpressionSpecification {
    const hoverFlag: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
    const selectedFlag: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];

    if (Array.isArray(baseValue) && isZoomInterpolateExpression(baseValue)) {
        return buildStatefulZoomInterpolateExpression(
            baseValue as ExpressionSpecification,
            hoverDelta,
            selectedDelta,
            hoverFlag,
            selectedFlag
        );
    }

    const baseExpr = cloneExpression(baseValue);
    const hoverExpr = addDeltaExpression(baseValue, hoverDelta);
    const selectedExpr = addDeltaExpression(baseValue, selectedDelta);
    return [
        "case",
        selectedFlag,
        selectedExpr,
        hoverFlag,
        hoverExpr,
        baseExpr
    ] as ExpressionSpecification;
}

function cloneExpression<T>(value: T): T {
    return typeof value === "number" ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function addDeltaExpression(value: number | ExpressionSpecification, delta: number): ExpressionSpecification | number {
    if (typeof value === "number") {
        return value + delta;
    }
    if (delta === 0) {
        return cloneExpression(value);
    }
    return ["+", cloneExpression(value), delta] as ExpressionSpecification;
}

function isZoomInterpolateExpression(value: unknown): boolean {
    if (!Array.isArray(value) || value.length < 4) {
        return false;
    }
    if (value[0] !== "interpolate") {
        return false;
    }
    const zoomInput = value[2];
    return Array.isArray(zoomInput) && zoomInput[0] === "zoom";
}

function buildStatefulZoomInterpolateExpression(
    expression: ExpressionSpecification,
    hoverDelta: number,
    selectedDelta: number,
    hoverFlag: ExpressionSpecification,
    selectedFlag: ExpressionSpecification
): ExpressionSpecification {
    const [operator, interpolation, zoomInput, ...stops] = expression;
    const result: ExpressionSpecification = [
        operator,
        cloneExpression(interpolation),
        cloneExpression(zoomInput)
    ];

    for (let i = 0; i < stops.length; i += 2) {
        const zoomValue = stops[i];
        const stopValue = stops[i + 1] as number | ExpressionSpecification;
        result.push(
            zoomValue,
            buildStatefulStopValue(stopValue, hoverDelta, selectedDelta, hoverFlag, selectedFlag)
        );
    }

    return result;
}

function buildStatefulStopValue(
    value: number | ExpressionSpecification,
    hoverDelta: number,
    selectedDelta: number,
    hoverFlag: ExpressionSpecification,
    selectedFlag: ExpressionSpecification
): ExpressionSpecification {
    const baseExpr = cloneExpression(value);
    const hoverExpr = addDeltaExpression(value, hoverDelta);
    const selectedExpr = addDeltaExpression(value, selectedDelta);
    return [
        "case",
        selectedFlag,
        selectedExpr,
        hoverFlag,
        hoverExpr,
        baseExpr
    ] as ExpressionSpecification;
}

function buildManagedMetadata(layer: SymbolLayerSpecification): Record<string, unknown> {
    const metadata = (layer as { metadata?: Record<string, unknown> }).metadata ?? {};
    return {
        ...metadata,
        [MANAGED_CITY_LABEL_METADATA_FLAG]: true,
        [MANAGED_CITY_LABEL_METADATA_BASE_ID]: layer.id
    };
}

function combineFilters(
    baseFilter: LegacyFilterSpecification | undefined,
    extra: LegacyFilterSpecification
): LegacyFilterSpecification {
    if (!baseFilter) {
        return extra;
    }
    return ["all", baseFilter, extra] as unknown as LegacyFilterSpecification;
}

function readManagedMetadataFlag(layer: StyleSpecification["layers"][number]): boolean {
    const metadata = (layer as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") {
        return false;
    }
    return Boolean((metadata as Record<string, unknown>)[MANAGED_CITY_LABEL_METADATA_FLAG]);
}

function cloneLayer<T>(layer: T): T {
    return JSON.parse(JSON.stringify(layer)) as T;
}

async function loadTileJsonAvailability(
    sources: TileJsonSourceMap,
    signal?: AbortSignal
): Promise<VectorLayerAvailability> {
    const entries = await Promise.all(
        Object.entries(sources).map(async ([sourceId, url]) => {
            try {
                const layers = await loadVectorLayerNames(url, signal);
                return [sourceId, new Set(layers)] as const;
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn(`[map-style] Unable to inspect ${sourceId} tile JSON`, error);
                }
                return null;
            }
        })
    );
    const availability: VectorLayerAvailability = new Map();
    for (const entry of entries) {
        if (!entry) {
            continue;
        }
        availability.set(entry[0], entry[1]);
    }
    return availability;
}

function injectAdministrativeSourcesAndLayers(
    style: StyleSpecification,
    config: MapTilesConfig,
    availability: VectorLayerAvailability
): void {
    if (!style.sources) {
        style.sources = {};
    }
    const sources = style.sources as Record<string, VectorSourceSpecification>;
    const newLayers: Array<FillLayerSpecification | LineLayerSpecification> = [];

    for (const spec of Object.values(ADMIN_POLYGON_LAYER_SPECS)) {
        const polygonConfig = resolvePolygonSourceConfig(spec, config.polygonSources);
        if (!polygonConfig) {
            continue;
        }
        ensureVectorSource(sources, spec.sourceId, polygonConfig.tileJsonUrl, polygonConfig.sourceLayer);
        if (!isSourceLayerAvailable(availability, spec.sourceId, polygonConfig.sourceLayer)) {
            continue;
        }
        const resolvedSpec = { ...spec, sourceLayer: polygonConfig.sourceLayer } as AdminLayerSpec;
        if (spec.sourceId === ADMIN_POLYGON_LAYER_SPECS.communes.sourceId) {
            newLayers.push(buildCommuneFillLayer(resolvedSpec), buildCommuneLineLayer(resolvedSpec));
        } else {
            newLayers.push(buildArrMunicipalFillLayer(resolvedSpec), buildArrMunicipalLineLayer(resolvedSpec));
        }
    }

    if (!newLayers.length) {
        return;
    }

    const existingIds = new Set(
        (style.layers ?? [])
            .map((layer) => layer.id)
            .filter((id): id is string => typeof id === "string")
    );
    const filteredLayers = newLayers.filter((layer) => {
        if (typeof layer.id !== "string") {
            return true;
        }
        if (existingIds.has(layer.id)) {
            return false;
        }
        existingIds.add(layer.id);
        return true;
    });

    if (!filteredLayers.length) {
        return;
    }

    style.layers = insertAdministrativeLayers(style.layers ?? [], filteredLayers);
}

function ensureVectorSource(
    sources: Record<string, VectorSourceSpecification>,
    sourceId: string,
    tileJsonUrl: string,
    sourceLayer: string
): void {
    const existing = sources[sourceId];
    if (existing) {
        if (existing.type === "vector" && CITY_ID_FIELD) {
            const promote = existing.promoteId;
            if (!promote) {
                existing.promoteId = { [sourceLayer]: CITY_ID_FIELD };
            } else if (typeof promote === "string") {
                if (promote !== CITY_ID_FIELD) {
                    existing.promoteId = { [sourceLayer]: CITY_ID_FIELD };
                }
            } else if (typeof promote === "object") {
                promote[sourceLayer] = promote[sourceLayer] ?? CITY_ID_FIELD;
            }
        }
        return;
    }
    sources[sourceId] = {
        type: "vector",
        url: tileJsonUrl,
        promoteId: { [sourceLayer]: CITY_ID_FIELD }
    } as VectorSourceSpecification;
}

const missingAdminLayerWarnings = new Set<string>();

function isSourceLayerAvailable(
    availability: VectorLayerAvailability,
    sourceId: string,
    sourceLayer: string
): boolean {
    const layerSet = availability.get(sourceId);
    if (!layerSet) {
        return true;
    }
    if (layerSet.has(sourceLayer)) {
        return true;
    }
    const key = `${sourceId}/${sourceLayer}`;
    if (!missingAdminLayerWarnings.has(key)) {
        console.warn(`[map-style] Skipping admin layer for ${key}; source-layer missing in metadata.`);
        missingAdminLayerWarnings.add(key);
    }
    return false;
}

function insertAdministrativeLayers(
    existingLayers: StyleSpecification["layers"],
    newLayers: StyleSpecification["layers"]
): StyleSpecification["layers"] {
    const targetIndex = findFirstLabelLayerIndex(existingLayers);
    if (targetIndex < 0) {
        return [...existingLayers, ...newLayers];
    }
    return [
        ...existingLayers.slice(0, targetIndex),
        ...newLayers,
        ...existingLayers.slice(targetIndex)
    ];
}

function findFirstLabelLayerIndex(layers: StyleSpecification["layers"]): number {
    return layers.findIndex((layer) => typeof layer.id === "string" && COMMUNE_LABEL_LAYERS.includes(layer.id));
}

type AdminLayerSpec = (typeof ADMIN_POLYGON_LAYER_SPECS)[keyof typeof ADMIN_POLYGON_LAYER_SPECS];

function buildCommuneFillLayer(spec: AdminLayerSpec): FillLayerSpecification {
    return {
        id: spec.fillLayerId,
        type: "fill",
        source: spec.sourceId,
        "source-layer": spec.sourceLayer,
        minzoom: COMMUNE_LAYER_ZOOM_RANGE[0],
        maxzoom: COMMUNE_LAYER_ZOOM_RANGE[1],
        paint: {
            "fill-color": buildFeatureStateExpression(
                COMMUNE_FILL_BASE_COLOR,
                COMMUNE_FILL_HOVER_COLOR,
                COMMUNE_FILL_SELECTED_COLOR
            ),
            "fill-opacity": buildFeatureStateExpression(
                COMMUNE_FILL_BASE_OPACITY,
                COMMUNE_FILL_HOVER_OPACITY,
                COMMUNE_FILL_SELECTED_OPACITY
            )
        }
    };
}

function buildCommuneLineLayer(spec: AdminLayerSpec): LineLayerSpecification {
    return {
        id: spec.lineLayerId,
        type: "line",
        source: spec.sourceId,
        "source-layer": spec.sourceLayer,
        minzoom: COMMUNE_LAYER_ZOOM_RANGE[0],
        maxzoom: COMMUNE_LAYER_ZOOM_RANGE[1],
        paint: {
            "line-color": buildFeatureStateExpression(
                COMMUNE_LINE_BASE_COLOR,
                COMMUNE_LINE_HOVER_COLOR,
                COMMUNE_LINE_SELECTED_COLOR
            ),
            "line-opacity": buildFeatureStateExpression(
                COMMUNE_LINE_BASE_OPACITY,
                COMMUNE_LINE_HOVER_OPACITY,
                COMMUNE_LINE_SELECTED_OPACITY
            ),
            "line-width": buildPolygonLineWidthExpression(
                COMMUNE_LINE_HOVER_STOPS,
                COMMUNE_LINE_SELECTED_STOPS
            )
        }
    };
}

function buildArrMunicipalFillLayer(spec: AdminLayerSpec): FillLayerSpecification {
    return {
        id: spec.fillLayerId,
        type: "fill",
        source: spec.sourceId,
        "source-layer": spec.sourceLayer,
        minzoom: ARRONDISSEMENT_LAYER_ZOOM_RANGE[0],
        maxzoom: ARRONDISSEMENT_LAYER_ZOOM_RANGE[1],
        paint: {
            "fill-color": buildFeatureStateExpression(
                ARR_FILL_BASE_COLOR,
                ARR_FILL_HOVER_COLOR,
                ARR_FILL_SELECTED_COLOR
            ),
            "fill-opacity": buildFeatureStateExpression(
                ARR_FILL_BASE_OPACITY,
                ARR_FILL_HOVER_OPACITY,
                ARR_FILL_SELECTED_OPACITY
            )
        }
    };
}

function buildArrMunicipalLineLayer(spec: AdminLayerSpec): LineLayerSpecification {
    return {
        id: spec.lineLayerId,
        type: "line",
        source: spec.sourceId,
        "source-layer": spec.sourceLayer,
        minzoom: ARRONDISSEMENT_LAYER_ZOOM_RANGE[0],
        maxzoom: ARRONDISSEMENT_LAYER_ZOOM_RANGE[1],
        paint: {
            "line-color": buildFeatureStateExpression(
                ARR_LINE_BASE_COLOR,
                ARR_LINE_HOVER_COLOR,
                ARR_LINE_SELECTED_COLOR
            ),
            "line-opacity": buildFeatureStateExpression(
                ARR_LINE_BASE_OPACITY,
                ARR_LINE_HOVER_OPACITY,
                ARR_LINE_SELECTED_OPACITY
            ),
            "line-width": buildPolygonLineWidthExpression(ARR_LINE_HOVER_STOPS, ARR_LINE_SELECTED_STOPS)
        }
    };
}

function buildFeatureStateExpression(
    baseValue: unknown,
    hoverValue: unknown,
    selectedValue: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        cloneExpression(selectedValue),
        ["boolean", ["feature-state", "hover"], false],
        cloneExpression(hoverValue),
        cloneExpression(baseValue)
    ] as ExpressionSpecification;
}

function buildPolygonLineWidthExpression(
    hoverStops: Array<[number, number]>,
    selectedStops: Array<[number, number]>
): ExpressionSpecification {
    const hoverByZoom = new Map<number, number>(hoverStops);
    const selectedByZoom = new Map<number, number>(selectedStops);

    // union des zooms, triés
    const zooms = Array.from(
        new Set<number>([...hoverByZoom.keys(), ...selectedByZoom.keys()])
    ).sort((a, b) => a - b);

    const hoverFlag: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
    const selectedFlag: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];

    // Si tu veux une largeur "base" non-hover (optionnel)
    // Ici on met 0.6 à z min, sinon on retombe sur 0.
    let lastBase = 0;

    const expr: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"]];

    for (const z of zooms) {
        const hover = hoverByZoom.get(z);
        const selected = selectedByZoom.get(z);

        // fallback si jamais un stop manque
        const hoverVal = typeof hover === "number" ? hover : lastBase;
        const selectedVal = typeof selected === "number" ? selected : hoverVal;

        // base = 0 (invisible) ou hoverVal * 0.6 par exemple.
        // Comme ton line-opacity est 0 hors hover/selected, base peut rester 0.
        const baseVal = 0;

        expr.push(
            z,
            [
                "case",
                selectedFlag,
                selectedVal,
                hoverFlag,
                hoverVal,
                baseVal
            ] as ExpressionSpecification
        );

        // si tu veux un fallback plus intelligent
        lastBase = hoverVal;
    }

    return expr;
}


function cloneFilter(filter: LegacyFilterSpecification): LegacyFilterSpecification {
    return JSON.parse(JSON.stringify(filter)) as LegacyFilterSpecification;
}

function resolvePolygonSourceConfig(
    spec: AdminLayerSpec,
    polygonSources: PolygonSourcesConfig
): PolygonSourceConfig | null {
    if (spec.sourceId === COMMUNE_POLYGON_SOURCE_ID) {
        return polygonSources.communes;
    }
    if (spec.sourceId === ARR_MUNICIPAL_SOURCE_ID) {
        return polygonSources.arr_municipal;
    }
    return null;
}
