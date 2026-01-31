export type TabularValue = string | number | null;
export type RowForColumns<Columns extends readonly string[]> = {
    [Index in keyof Columns]: TabularValue;
};

export type TabularData<Columns extends readonly string[]> = {
    columns: Columns;
    rows: Array<RowForColumns<Columns>>;
};

export type ExportContext = {
    datasetVersion: string;
    datasetDir: string;
};

export type ExportCommune = {
    insee: string;
    name: string;
    departmentCode: string | null;
    regionCode: string | null;
};

export type ExportInfraZone = {
    id: string;
    type: "ARM" | "COMD" | "COMA";
    code: string;
    parentCommuneCode: string;
    name: string;
};

export type PostalRecord = {
    insee: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
};

export type SourceMeta = {
    url: string;
    filePath: string;
    retrievedAtUtc: string;
    checksumSha256: string;
};
