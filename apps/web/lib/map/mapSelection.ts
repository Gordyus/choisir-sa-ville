export type CommuneSelection = {
    kind: "commune";
    inseeCode: string;
    name?: string;
};

export type InfraZoneSelection = {
    kind: "infraZone";
    id: string;
    parentCommuneCode: string;
    name?: string;
    infraType?: string;
    code: string;
};

export type MapSelection = CommuneSelection | InfraZoneSelection;
