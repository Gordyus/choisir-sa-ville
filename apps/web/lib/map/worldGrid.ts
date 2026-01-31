type TileCoord = { x: number; y: number; z: number };

const MAX_MERCATOR_LAT = 85.05112878;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function resolveTileZoom(
    mapZoom: number,
    tileZoomOffset: number,
    minTileZoom: number,
    maxTileZoom: number
): number {
    const raw = Math.round(mapZoom) + tileZoomOffset;
    return clamp(raw, minTileZoom, maxTileZoom);
}

export function latLngToTile(lat: number, lng: number, z: number): TileCoord {
    const clampedLat = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
    const n = 2 ** z;

    const x = Math.floor(((lng + 180) / 360) * n);

    const latRad = (clampedLat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );

    const wrappedX = ((x % n) + n) % n;
    const clampedY = clamp(y, 0, n - 1);
    return { x: wrappedX, y: clampedY, z };
}

export function tileCellId(tile: TileCoord): string {
    return `${tile.z}:${tile.x}:${tile.y}`;
}

