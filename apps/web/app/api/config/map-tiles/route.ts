import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TileJsonSources = {
    france: string;
    communes: string;
    arr_municipal: string;
    commune_labels: string;
};

type PolygonSource = {
    tileJsonUrl: string;
    sourceLayer: string;
};

type PolygonSources = {
    communes: PolygonSource;
    arr_municipal: PolygonSource;
};

type CityLabelStyle = {
    textColor: string;
    highlightTextColor: string;
    activeTextColor: string;
    textHaloColor: string;
    highlightTextHaloColor: string;
    activeTextHaloColor: string;
    textHaloWidth: number;
    highlightTextHaloWidth: number;
    activeTextHaloWidth: number;
};

type MapTilesConfigResponse = {
    styleUrl: string;
    tileJsonSources: TileJsonSources;
    cityClasses: string[];
    polygonSources: PolygonSources;
    interactableLabelLayerId: string;
    cityLabelStyle: CityLabelStyle;
};

function validateTileserverUrl(url: string | undefined): string | null {
    if (!url || typeof url !== "string") {
        return null;
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return null;
    }
    return trimmed;
}

function resolveTileserverBaseUrl(): string | null {
    // Prefer explicit server-side var, then public var.
    const explicit = validateTileserverUrl(process.env.TILESERVER_BASE_URL);
    if (explicit) return explicit;

    const publicUrl = validateTileserverUrl(process.env.NEXT_PUBLIC_TILESERVER_BASE_URL);
    if (publicUrl) return publicUrl;

    // Safe local default in development to avoid hard failure.
    if (process.env.NODE_ENV !== "production") {
        return "http://localhost:8080";
    }

    return null;
}

export async function GET(): Promise<NextResponse> {
    const baseUrl = resolveTileserverBaseUrl();

    if (!baseUrl) {
        console.error(
            "[api/config/map-tiles] TILESERVER_BASE_URL/NEXT_PUBLIC_TILESERVER_BASE_URL is missing or invalid. " +
            "Expected a valid URL starting with http:// or https://. " +
            `Received TILESERVER_BASE_URL=${process.env.TILESERVER_BASE_URL ?? "^(undefined^)"} ` +
            `NEXT_PUBLIC_TILESERVER_BASE_URL=${process.env.NEXT_PUBLIC_TILESERVER_BASE_URL ?? "^(undefined^)"}`
        );
        return NextResponse.json(
            { error: "Tileserver configuration is missing or invalid" },
            { status: 500 }
        );
    }

    // polygonSources is the source of truth
    const polygonSources: PolygonSources = {
        communes: {
            tileJsonUrl: `${baseUrl}/data/communes.json`,
            sourceLayer: "communes"
        },
        arr_municipal: {
            tileJsonUrl: `${baseUrl}/data/arr_municipal.json`,
            sourceLayer: "arr_municipal"
        }
    };

    // Derive tileJsonSources from polygonSources to eliminate duplication
    const tileJsonSources: TileJsonSources = {
        france: `${baseUrl}/data/france.json`,
        communes: polygonSources.communes.tileJsonUrl,
        arr_municipal: polygonSources.arr_municipal.tileJsonUrl,
        commune_labels: `${baseUrl}/data/commune_labels.json`
    };

    const config: MapTilesConfigResponse = {
        styleUrl: `${baseUrl}/styles/basic/style.json`,
        tileJsonSources,
        cityClasses: ["city", "town", "village", "suburb"],
        polygonSources,
        interactableLabelLayerId: "place_label_interractable",
        cityLabelStyle: {
            textColor: "#111827",
            highlightTextColor: "#2563eb",
            activeTextColor: "#f59e0b",
            textHaloColor: "#ffffff",
            highlightTextHaloColor: "#ffffff",
            activeTextHaloColor: "#ffffff",
            textHaloWidth: 2.8,
            highlightTextHaloWidth: 3.6,
            activeTextHaloWidth: 4.2
        }
    };

    const cacheControl =
        process.env.NODE_ENV === "production"
            ? "public, max-age=3600, s-maxage=3600"
            : "no-store";

    return NextResponse.json(config, {
        headers: {
            "Cache-Control": cacheControl
        }
    });
}
