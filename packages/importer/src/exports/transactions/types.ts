/**
 * Lot detail within a mutation (for grouped sales).
 */
export type TransactionLot = {
    typeLocal: "Maison" | "Appartement" | "Dépendance" | "Sol";
    surfaceM2: number | null;
    isVefa: boolean;
    roomCount: number | null; // nombre_pieces_principales
    landSurfaceM2: number | null; // surface_terrain
};

/**
 * Mutation summary (single notarial act, possibly multi-lot).
 * Contains only primitive data - UI labels/badges computed at runtime.
 */
export type MutationSummary = {
    mutationId: string;
    date: string; // YYYY-MM-DD
    priceEurTotal: number;
    housingCount: number; // Count of Maison + Appartement
    housingSurfaceM2Total: number | null; // Sum of surfaces for Maison + Appartement only
    dependencyCount: number; // Count of Dépendance lots
    parcelCount: number; // Count of Sol lots (parcels without buildings)
    cadastralParcelCount: number; // Count of unique cadastral parcels from l_codpar
    relatedAddresses?: string[]; // List of all addresses involved in this mutation
    lots?: TransactionLot[]; // Optional detailed breakdown
};

export type TransactionAddressHistory = {
    id: string;
    label: string;
    lat: number;
    lng: number;
    mutations: MutationSummary[];
};

export type DvfRawRow = {
    inseeCode: string;
    streetNumber: string;
    streetName: string;
    date: string;
    priceEur: number;
    typeLocal: "Maison" | "Appartement" | "Dépendance" | "Sol";
    surfaceM2: number | null;
    isVefa: boolean;
    lat: number;
    lng: number;
    idMutation: string | null;
    parcelCodes?: string[]; // Optional cadastral parcel codes from l_codpar
    roomCount: number | null; // nombre_pieces_principales
    landSurfaceM2: number | null; // surface_terrain
};
