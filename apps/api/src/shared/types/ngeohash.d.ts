// Type declarations for ngeohash module
declare module 'ngeohash' {
  export function encode(latitude: number, longitude: number, precision?: number): string;
  export function decode(hashstring: string): { latitude: number; longitude: number };
  export function decode_bbox(hashstring: string): [number, number, number, number];
  export function bboxes(minlat: number, minlon: number, maxlat: number, maxlon: number, precision?: number): string[];
  export function neighbor(hashstring: string, direction: [number, number]): string;
  export const NORTH: [number, number];
  export const SOUTH: [number, number];
  export const EAST: [number, number];
  export const WEST: [number, number];
}
