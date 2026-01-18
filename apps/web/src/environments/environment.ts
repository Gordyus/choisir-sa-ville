type WebEnv = {
  VITE_API_BASE_URL?: string;
};

const globalEnv = (window as unknown as { __CSV_ENV__?: WebEnv }).__CSV_ENV__ ?? {};

export const environment = {
  apiBaseUrl: globalEnv.VITE_API_BASE_URL ?? "http://localhost:8787"
};
