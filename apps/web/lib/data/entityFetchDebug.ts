import { loadDebugConfigOnce } from "@/lib/config/debugConfig";

let logEntityFetchEnabled: boolean | null = null;

if (process.env.NODE_ENV === "development") {
    void loadDebugConfigOnce()
        .then((cfg) => {
            logEntityFetchEnabled = Boolean(cfg.enabled && cfg.logEntityFetch);
        })
        .catch(() => {
            logEntityFetchEnabled = false;
        });
} else {
    logEntityFetchEnabled = false;
}

export function debugLogEntityFetch(url: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "development") {
        return;
    }
    if (!logEntityFetchEnabled) {
        return;
    }
    if (meta && Object.keys(meta).length) {
        console.debug("[entity-fetch]", { url, ...meta });
    } else {
        console.debug("[entity-fetch]", url);
    }
}

