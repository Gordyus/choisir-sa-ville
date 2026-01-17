import type { FastifyPluginAsync } from "fastify";
import {
  CityByCommuneCodeParams,
  CityBBoxQuery,
  CityByIdParams,
  CitySearchQuery,
  InfraZoneListQuery
} from "@csv/core";
import type { Db } from "@csv/db";
import { notFound } from "../errors/domain-error.js";
import {
  getCityByInseeCode,
  getCityDetailsById,
  listCities,
  listCitiesByBBox
} from "../services/commune.service.js";
import {
  findInfraZoneByCodeOrSlug,
  listInfraZones
} from "../services/infra-zone.service.js";

export function citiesRoute(db: Db): FastifyPluginAsync {
  return async (app) => {
    app.get("/cities", async (req) => {
      const query = CitySearchQuery.parse(req.query);
      const rows = await listCities(db, query);

      return {
        items: rows,
        meta: {
          limit: query.limit,
          offset: query.offset
        }
      };
    });

    app.get("/cities/bbox", async (req) => {
      const query = CityBBoxQuery.parse(req.query);
      const rows = await listCitiesByBBox(db, query);

      return {
        items: rows,
        meta: {
          limit: query.limit,
          offset: query.offset
        }
      };
    });

    app.get("/cities/:id", async (req) => {
      const params = CityByIdParams.parse(req.params);
      const city = await getCityDetailsById(db, params.id);

      if (!city) {
        const infraZone = await findInfraZoneByCodeOrSlug(db, params.id);
        if (infraZone) {
          throw notFound("City not found", {
            kind: "INFRA_ZONE_CODE",
            hint: `Use /cities/${infraZone.parentCommuneCode}/infra-zones?type=${infraZone.type}`
          });
        }
        throw notFound("City not found", { id: params.id });
      }

      return city;
    });

    app.get("/cities/:communeCode/infra-zones", async (req) => {
      const params = CityByCommuneCodeParams.parse(req.params);
      const query = InfraZoneListQuery.parse(req.query);
      const city = await getCityByInseeCode(db, params.communeCode);

      if (!city) {
        const infraZone = await findInfraZoneByCodeOrSlug(db, params.communeCode);
        if (infraZone) {
          throw notFound("City not found", {
            kind: "INFRA_ZONE_CODE",
            hint: `Use /cities/${infraZone.parentCommuneCode}/infra-zones?type=${infraZone.type}`
          });
        }
        throw notFound("City not found", { communeCode: params.communeCode });
      }

      const rows = await listInfraZones(db, {
        parentCommuneCode: params.communeCode,
        type: query.type,
        limit: query.limit,
        offset: query.offset
      });

      return {
        items: rows,
        meta: {
          limit: query.limit,
          offset: query.offset
        }
      };
    });
  };
}
