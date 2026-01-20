import { registerZoneAggregatePlugin } from "./registry.js";
import { rentV1Plugin } from "./plugins/rent.v1.js";

registerZoneAggregatePlugin(rentV1Plugin);

export * from "./errors.js";
export * from "./params-hash.js";
export * from "./registry.js";
export * from "./service.js";
export * from "./types.js";
export { rentV1Plugin };
