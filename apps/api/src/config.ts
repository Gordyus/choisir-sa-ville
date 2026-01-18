import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  OSRM_BASE_URL: z.string().default("https://router.project-osrm.org"),
  GEOCODE_BASE_URL: z.string().default("https://photon.komoot.io")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // keep this readable on purpose
    console.error("Invalid environment variables:");
    console.error(parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}
