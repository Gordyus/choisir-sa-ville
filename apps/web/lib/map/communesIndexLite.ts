import { loadDataset, resolveDatasetFileUrl } from "./dataset";
import { fetchTabularJson, readNumber, readString, requireColumnIndex } from "./tabular";

export type CommunesIndexLite = {
    insee: string[];
    name: string[];
    departmentCode: Array<string | null>;
    regionCode: Array<string | null>;
    lat: Array<number | null>;
    lng: Array<number | null>;
    population: Array<number | null>;
};

let communesPromise: Promise<CommunesIndexLite> | null = null;

export async function loadCommunesIndexLite(signal?: AbortSignal): Promise<CommunesIndexLite> {
    if (!communesPromise) {
        communesPromise = hydrateCommunes(signal).catch((error) => {
            communesPromise = null;
            throw error;
        });
    }
    return communesPromise;
}

async function hydrateCommunes(signal?: AbortSignal): Promise<CommunesIndexLite> {
    const context = await loadDataset(signal);
    if (!context.manifest.files.includes("communes/indexLite.json")) {
        throw new Error("[dataset] Manifest missing communes/indexLite.json");
    }

    const url = resolveDatasetFileUrl(context, "communes/indexLite.json");
    const tabular = await fetchTabularJson(url, signal);
    const idxInsee = requireColumnIndex(tabular.columns, "insee");
    const idxName = requireColumnIndex(tabular.columns, "name");
    const idxDept = requireColumnIndex(tabular.columns, "departmentCode");
    const idxRegion = requireColumnIndex(tabular.columns, "regionCode");
    const idxLat = requireColumnIndex(tabular.columns, "lat");
    const idxLng = requireColumnIndex(tabular.columns, "lng");
    const idxPopulation = requireColumnIndex(tabular.columns, "population");

    const total = tabular.rows.length;
    const dataset: CommunesIndexLite = {
        insee: new Array(total),
        name: new Array(total),
        departmentCode: new Array(total),
        regionCode: new Array(total),
        lat: new Array(total),
        lng: new Array(total),
        population: new Array(total)
    };

    tabular.rows.forEach((row, index) => {
        dataset.insee[index] = readString(row, idxInsee) ?? "";
        dataset.name[index] = readString(row, idxName) ?? "";
        dataset.departmentCode[index] = readString(row, idxDept);
        dataset.regionCode[index] = readString(row, idxRegion);
        dataset.lat[index] = readNumber(row, idxLat);
        dataset.lng[index] = readNumber(row, idxLng);
        dataset.population[index] = readNumber(row, idxPopulation);
    });

    return dataset;
}

