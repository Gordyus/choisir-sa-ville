import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./styles.css";

type CityMarker = {
  inseeCode: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  departmentCode: string | null;
  regionCode: string | null;
};

type CityDetails = {
  inseeCode: string;
  name: string;
  slug: string;
  population: number | null;
  departmentCode: string | null;
  departmentName: string | null;
  regionCode: string | null;
  regionName: string | null;
  lat: number | null;
  lon: number | null;
  postalCodes: string[];
};

type ApiListResponse<T> = {
  items: T[];
  meta: { limit: number; offset: number };
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://localhost:8787";

const detailsEl = document.querySelector<HTMLDivElement>("#details");
const statusEl = document.querySelector<HTMLDivElement>("#status");

if (!detailsEl || !statusEl) {
  throw new Error("Missing layout containers.");
}

function setStatus(message: string, state: "ok" | "error" | "idle" = "idle"): void {
  statusEl.textContent = message;
  statusEl.className = "panel-status";
  if (state === "ok") statusEl.classList.add("status-ok");
  if (state === "error") statusEl.classList.add("status-error");
}

function renderPlaceholder(): void {
  detailsEl.innerHTML = `
    <div class="detail-card">
      <h2 class="detail-title">Pick a city</h2>
      <div class="detail-meta">
        <span>Click a marker to view details.</span>
        <span>Markers load as you move across the map.</span>
      </div>
    </div>
  `;
}

function renderLoading(): void {
  detailsEl.innerHTML = `
    <div class="detail-card">
      <h2 class="detail-title">Loading...</h2>
      <div class="detail-meta">
        <span>Fetching city details from the API.</span>
      </div>
    </div>
  `;
}

function renderError(message: string): void {
  detailsEl.innerHTML = `
    <div class="detail-card">
      <h2 class="detail-title">Unable to load details</h2>
      <div class="detail-meta">
        <span>${message}</span>
      </div>
    </div>
  `;
}

function renderDetails(city: CityDetails): void {
  const postalCodes =
    city.postalCodes.length > 0
      ? city.postalCodes.map((code) => `<span class="tag">${code}</span>`).join("")
      : "<span class=\"tag\">No postal codes</span>";

  detailsEl.innerHTML = `
    <div class="detail-card">
      <h2 class="detail-title">${city.name}</h2>
      <div class="detail-meta">
        <span>INSEE: ${city.inseeCode} • ${city.slug}</span>
        <span>Dept: ${city.departmentName ?? "Unknown"} (${city.departmentCode ?? "?"})</span>
        <span>Region: ${city.regionName ?? "Unknown"} (${city.regionCode ?? "?"})</span>
        <span>Coords: ${city.lat ?? "?"}, ${city.lon ?? "?"}</span>
      </div>
    </div>
    <div class="detail-card">
      <h3 class="detail-title">Postal codes</h3>
      <div class="detail-tags">
        ${postalCodes}
      </div>
    </div>
  `;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

const map = L.map("map", {
  zoomControl: true
}).setView([46.6, 2.4], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let markersController: AbortController | null = null;
let detailsController: AbortController | null = null;

function createMarker(item: CityMarker): L.CircleMarker {
  return L.circleMarker([item.lat, item.lon], {
    radius: 6,
    color: "#d04a2e",
    fillColor: "#d04a2e",
    fillOpacity: 0.7,
    weight: 1
  });
}

async function loadMarkers(): Promise<void> {
  const bounds = map.getBounds();
  const params = new URLSearchParams({
    minLat: bounds.getSouth().toString(),
    minLon: bounds.getWest().toString(),
    maxLat: bounds.getNorth().toString(),
    maxLon: bounds.getEast().toString(),
    limit: "200",
    offset: "0"
  });

  markersController?.abort();
  markersController = new AbortController();

  setStatus("Loading markers...", "idle");

  try {
    const data = await fetchJson<ApiListResponse<CityMarker>>(
      `${API_BASE_URL}/cities/bbox?${params.toString()}`,
      markersController.signal
    );

    markerLayer.clearLayers();

    data.items.forEach((item) => {
      const marker = createMarker(item);
      marker.on("click", () => {
        void loadCityDetails(item.slug || item.inseeCode);
      });
      markerLayer.addLayer(marker);
    });

    setStatus(`${data.items.length} markers loaded`, "ok");
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return;
    }
    setStatus("Failed to load markers.", "error");
  }
}

async function loadCityDetails(id: string): Promise<void> {
  detailsController?.abort();
  detailsController = new AbortController();
  renderLoading();
  try {
    const city = await fetchJson<CityDetails>(
      `${API_BASE_URL}/cities/${encodeURIComponent(id)}`,
      detailsController.signal
    );
    renderDetails(city);
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return;
    }
    renderError("The city details could not be loaded.");
  }
}

let debounceHandle: number | null = null;
function scheduleMarkerLoad(): void {
  if (debounceHandle !== null) {
    window.clearTimeout(debounceHandle);
  }
  debounceHandle = window.setTimeout(() => {
    void loadMarkers();
  }, 300);
}

map.on("moveend", scheduleMarkerLoad);
map.on("zoomend", scheduleMarkerLoad);

renderPlaceholder();
void loadMarkers();
