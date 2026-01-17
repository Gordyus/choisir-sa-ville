import type { FastifyPluginAsync } from "fastify";
import { CityByIdParams, CitySearchQuery, InfraZoneListQuery } from "@csv/core";
import type { Db } from "@csv/db";
import { notFound } from "../errors/domain-error.js";
import { getCityByInseeCode, listCities } from "../services/commune.service.js";
import { listInfraZones } from "../services/infra-zone.service.js";

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

    app.get("/cities/:idOrCode", async (req) => {
      const params = CityByIdParams.parse(req.params);
      const city = await getCityByInseeCode(db, params.idOrCode);

      if (!city) {
        throw notFound("City not found", { idOrCode: params.idOrCode });
      }

      return city;
    });

    app.get("/cities/:idOrCode/infra-zones", async (req) => {
      const params = CityByIdParams.parse(req.params);
      const query = InfraZoneListQuery.parse(req.query);
      const city = await getCityByInseeCode(db, params.idOrCode);

      if (!city) {
        throw notFound("City not found", { idOrCode: params.idOrCode });
      }

      const rows = await listInfraZones(db, {
        parentCommuneCode: params.idOrCode,
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
