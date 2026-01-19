import type {
  TravelMatrixOrigin,
  TravelMatrixResult,
  TravelPoint,
  TravelProvider,
  RouteResult
} from "@csv/core";

export class DisabledTravelProvider implements TravelProvider {
  async matrixCar(
    origins: TravelMatrixOrigin[],
    _destination: TravelPoint
  ): Promise<TravelMatrixResult[]> {
    return origins.map((origin) => ({
      zoneId: origin.zoneId,
      status: "ERROR"
    }));
  }

  async matrixTransit(
    origins: TravelMatrixOrigin[],
    _destination: TravelPoint,
    _arriveByIso: string
  ): Promise<TravelMatrixResult[]> {
    return origins.map((origin) => ({
      zoneId: origin.zoneId,
      status: "ERROR"
    }));
  }

  async routeCar(
    _origin: TravelPoint,
    _destination: TravelPoint
  ): Promise<RouteResult> {
    return { status: "ERROR" };
  }

  async routeTransit(
    _origin: TravelPoint,
    _destination: TravelPoint,
    _arriveByIso: string
  ): Promise<RouteResult> {
    return { status: "ERROR" };
  }
}
