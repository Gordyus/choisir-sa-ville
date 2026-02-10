export type TransactionLine = {
    date: string;
    priceEur: number;
    typeLocal: "Maison" | "Appartement";
    surfaceM2: number | null;
    isVefa: boolean;
};

export type TransactionAddressHistory = {
    id: string;
    label: string;
    lat: number;
    lng: number;
    transactions: TransactionLine[];
};

export type DvfRawRow = {
    inseeCode: string;
    streetNumber: string;
    streetName: string;
    date: string;
    priceEur: number;
    typeLocal: "Maison" | "Appartement";
    surfaceM2: number | null;
    isVefa: boolean;
    lat: number;
    lng: number;
};
