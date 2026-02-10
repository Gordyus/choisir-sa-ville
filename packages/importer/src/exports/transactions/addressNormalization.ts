import { sha256FromString } from "../shared/hash.js";

/**
 * Normalizes a street name for grouping: uppercase, no accents, normalized whitespace/punctuation.
 */
export function normalizeStreetName(streetName: string): string {
    return streetName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Builds the strict address key for grouping transactions at the same address.
 * Format: "{inseeCode}|{streetNumber}|{streetNameNormalized}"
 */
export function buildAddressKey(inseeCode: string, streetNumber: string, streetName: string): string {
    const normalizedName = normalizeStreetName(streetName);
    return `${inseeCode}|${streetNumber.trim().toUpperCase()}|${normalizedName}`;
}

/**
 * Derives a stable, compact address ID from an address key.
 * Uses first 12 hex chars of SHA-256 for compactness while avoiding collisions.
 */
export function deriveAddressId(addressKey: string): string {
    return sha256FromString(addressKey).slice(0, 12);
}

/**
 * Builds a human-readable label for the address.
 */
export function buildAddressLabel(streetNumber: string, streetName: string, communeName: string): string {
    const num = streetNumber.trim();
    const name = streetName.trim();
    const commune = communeName.trim();
    return `${num} ${name}, ${commune}`;
}
