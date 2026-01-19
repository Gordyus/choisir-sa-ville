import dotenv from "dotenv";
import path from "node:path";

import { createDb } from "@csv/db";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./config.js";
import { registerErrorHandler } from "./errors/error-handler.js";
import { areaSuggestRoute } from "./routes/area-suggest.js";
import { citiesRoute } from "./routes/cities.js";
import { debugRoute } from "./routes/debug.js";
import { geocodeRoute } from "./routes/geocode.js";
import { healthRoute } from "./routes/health.js";
import { searchRoute } from "./routes/search.js";
import { travelMatrixRoute } from "./routes/travel-matrix.js";
import { travelRoute } from "./routes/travel-route.js";
import { PostgresCacheStore } from "./services/cache-store.js";
import { createAreaSuggestService } from "./services/area-suggest.service.js";
import { createGeocodeService } from "./services/geocode.service.js";
import { OsrmTravelProvider } from "./services/osrm-travel-provider.js";
import { PhotonGeocodeProvider } from "./services/photon-geocode-provider.js";
import { createSearchService } from "./services/search.service.js";
import { DisabledTravelProvider } from "./services/travel-provider.js";
import { createTravelMatrixService } from "./services/travel-matrix.service.js";
import { createTravelRouteService } from "./services/travel-route.service.js";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env")
});

const env = loadEnv();

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug"
  }
});

await app.register(cors, { origin: true });
registerErrorHandler(app);

const db = createDb(env.DATABASE_URL);
const searchService = createSearchService(db);
const areaSuggestService = createAreaSuggestService(db);
const cacheStore = new PostgresCacheStore(db);
const geocodeProvider = new PhotonGeocodeProvider({ baseUrl: env.GEOCODE_BASE_URL });
const geocodeService = createGeocodeService(cacheStore, geocodeProvider);
const travelProvider = env.OSRM_BASE_URL
  ? new OsrmTravelProvider({ baseUrl: env.OSRM_BASE_URL })
  : new DisabledTravelProvider();
const travelMatrixService = createTravelMatrixService(cacheStore, travelProvider);
const travelRouteService = createTravelRouteService(db, cacheStore, travelProvider);

await app.register(healthRoute);
await app.register(citiesRoute(db));
await app.register(searchRoute(searchService));
await app.register(areaSuggestRoute(areaSuggestService));
await app.register(geocodeRoute(geocodeService));
await app.register(travelMatrixRoute(travelMatrixService));
await app.register(travelRoute(travelRouteService));
if (env.NODE_ENV !== "production") {
  await app.register(debugRoute);
}

app.addHook("onClose", async () => {
  await db.destroy();
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
