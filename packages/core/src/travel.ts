export type TravelMode = "car" | "transit";
export type TravelStatus = "OK" | "NO_ROUTE" | "ERROR";

export type TravelPoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type TravelMatrixOrigin = {
  zoneId: string;
  lat: number;
  lng: number;
};

export type TravelMatrixResult = {
  zoneId: string;
  duration_s?: number;
  distance_m?: number;
  status: TravelStatus;
};

export type RouteGeometry =
  | string
  | { type: "LineString"; coordinates: Array<[number, number]> };

export type RouteResult = {
  duration_s?: number;
  distance_m?: number;
  status: TravelStatus;
  geometry?: RouteGeometry;
  transitDetails?: {
    transfers?: number;
    walkSeconds?: number;
    waitSeconds?: number;
    segments?: unknown[];
  };
};

export type TravelProvider = {
  matrixCar: (
    origins: TravelMatrixOrigin[],
    destination: TravelPoint
  ) => Promise<TravelMatrixResult[]>;
  matrixTransit: (
    origins: TravelMatrixOrigin[],
    destination: TravelPoint,
    arriveByIso: string
  ) => Promise<TravelMatrixResult[]>;
  routeCar: (origin: TravelPoint, destination: TravelPoint) => Promise<RouteResult>;
  routeTransit: (
    origin: TravelPoint,
    destination: TravelPoint,
    arriveByIso: string
  ) => Promise<RouteResult>;
};
