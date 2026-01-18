const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function toGeohash6(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, 6);
}

export function encodeGeohash(lat: number, lng: number, precision = 6): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid coordinates.");
  }
  if (precision <= 0) {
    throw new Error("Precision must be >= 1.");
  }

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let evenBit = true;
  let bit = 0;
  let ch = 0;
  let geohash = "";

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        lonMin = mid;
      } else {
        ch = (ch << 1) + 0;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch = (ch << 1) + 0;
        latMax = mid;
      }
    }

    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}
