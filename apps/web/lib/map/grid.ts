export type Point = { x: number; y: number };

export function pointToCellId(point: Point, cellSize: number): string {
    const x = Math.floor(point.x / cellSize);
    const y = Math.floor(point.y / cellSize);
    return `${x}:${y}`;
}

