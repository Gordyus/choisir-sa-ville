import { loadDataset, resolveDatasetFileUrl } from "./dataset";
import { fetchTabularJson, readNumber, readString, requireColumnIndex } from "./tabular";

export type InfraZonesIndexLite = {
    id: string[];
    type: string[];
    code: string[];
    parentCommuneCode: Array<string | null>;
    name: string[];
    lat: Array<number | null>;
    lng: Array<number | null>;
    population: Array<number | null>;
};

const EMPTY_INFRA: InfraZonesIndexLite = {
    id: [],
    type: [],
    code: [],
    parentCommuneCode: [],
    name: [],
    lat: [],
    lng: [],
    population: []
};

let infraPromise: Promise<InfraZonesIndexLite> | null = null;

export async function loadInfraZonesIndexLite(signal?: AbortSignal): Promise<InfraZonesIndexLite> {
    if (!infraPromise) {
        infraPromise = hydrateInfra(signal).catch((error) => {
            infraPromise = null;
            throw error;
        });
    }
    return infraPromise;
}

async function hydrateInfra(signal?: AbortSignal): Promise<InfraZonesIndexLite> {
    const context = await loadDataset(signal);
    if (!context.manifest.files.includes("infraZones/indexLite.json")) {
        return EMPTY_INFRA;
    }

    const url = resolveDatasetFileUrl(context, "infraZones/indexLite.json");
    const tabular = await fetchTabularJson(url, signal);

    const idxId = requireColumnIndex(tabular.columns, "id");
    const idxType = requireColumnIndex(tabular.columns, "type");
    const idxCode = requireColumnIndex(tabular.columns, "code");
    const idxParent = requireColumnIndex(tabular.columns, "parentCommuneCode");
    const idxName = requireColumnIndex(tabular.columns, "name");
    const idxLat = requireColumnIndex(tabular.columns, "lat");
    const idxLng = requireColumnIndex(tabular.columns, "lng");
    const idxPopulation = requireColumnIndex(tabular.columns, "population");

    const total = tabular.rows.length;
    const dataset: InfraZonesIndexLite = {
        id: new Array(total),
        type: new Array(total),
        code: new Array(total),
        parentCommuneCode: new Array(total),
        name: new Array(total),
        lat: new Array(total),
        lng: new Array(total),
        population: new Array(total)
    };

    tabular.rows.forEach((row, index) => {
        dataset.id[index] = readString(row, idxId) ?? "";
        dataset.type[index] = readString(row, idxType) ?? "";
        dataset.code[index] = readString(row, idxCode) ?? "";
        dataset.parentCommuneCode[index] = readString(row, idxParent);
        dataset.name[index] = readString(row, idxName) ?? "";
        dataset.lat[index] = readNumber(row, idxLat);
        dataset.lng[index] = readNumber(row, idxLng);
        dataset.population[index] = readNumber(row, idxPopulation);
    });

    return dataset;
}

