/**
 * Environment variables validation
 * 
 * Validates required environment variables at application startup.
 * Throws error if critical configuration is missing or invalid.
 */

export interface EnvConfig {
  // Provider
  ROUTING_PROVIDER: 'tomtom' | 'navitia' | 'mock';
  TOMTOM_API_KEY: string | undefined;
  NAVITIA_API_KEY: string | undefined;

  // Cache
  ENABLE_CACHE: boolean;
  DATABASE_URL: string | undefined;

  // Optimizations
  GEOHASH_PRECISION: number;
  TIME_BUCKET_MINUTES: number;
  CACHE_TTL_DAYS: number;
  TRAVEL_TIME_MARGIN_PERCENT: number;

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_WINDOW: number;
  RATE_LIMIT_WINDOW_MS: number;

  // Server
  PORT: number;
  CORS_ORIGIN: string;
  NODE_ENV: 'development' | 'production' | 'test';

  // Monitoring (optional)
  SENTRY_DSN: string | undefined;
}

export const env: EnvConfig = {
  ROUTING_PROVIDER: (process.env.ROUTING_PROVIDER as 'tomtom' | 'navitia' | 'mock') || 'mock',
  TOMTOM_API_KEY: process.env.TOMTOM_API_KEY,
  NAVITIA_API_KEY: process.env.NAVITIA_API_KEY,

  ENABLE_CACHE: process.env.ENABLE_CACHE === 'true',
  DATABASE_URL: process.env.DATABASE_URL,

  GEOHASH_PRECISION: parseInt(process.env.GEOHASH_PRECISION || '6', 10),
  TIME_BUCKET_MINUTES: parseInt(process.env.TIME_BUCKET_MINUTES || '30', 10),
  CACHE_TTL_DAYS: parseInt(process.env.CACHE_TTL_DAYS || '30', 10),
  TRAVEL_TIME_MARGIN_PERCENT: parseInt(process.env.TRAVEL_TIME_MARGIN_PERCENT || '10', 10),

  RATE_LIMIT_REQUESTS_PER_WINDOW: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_WINDOW || '6', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),

  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',

  SENTRY_DSN: process.env.SENTRY_DSN,
};

export function validateEnv(): void {
  const errors: string[] = [];

  // Required variables
  const required = ['ROUTING_PROVIDER', 'PORT', 'CORS_ORIGIN'];
  for (const key of required) {
    if (!env[key as keyof EnvConfig]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Provider-specific validation
  if (env.ROUTING_PROVIDER === 'tomtom' && !env.TOMTOM_API_KEY) {
    errors.push('TOMTOM_API_KEY is required when ROUTING_PROVIDER=tomtom');
  }

  if (env.ROUTING_PROVIDER === 'navitia' && !env.NAVITIA_API_KEY) {
    errors.push('NAVITIA_API_KEY is required when ROUTING_PROVIDER=navitia');
  }

  // Cache validation
  if (env.ENABLE_CACHE && !env.DATABASE_URL) {
    errors.push('DATABASE_URL is required when ENABLE_CACHE=true');
  }

  // Range validation
  if (env.GEOHASH_PRECISION < 1 || env.GEOHASH_PRECISION > 9) {
    errors.push('GEOHASH_PRECISION must be between 1 and 9');
  }

  if (env.TIME_BUCKET_MINUTES < 1 || env.TIME_BUCKET_MINUTES > 1440) {
    errors.push('TIME_BUCKET_MINUTES must be between 1 and 1440 (24 hours)');
  }

  if (env.CACHE_TTL_DAYS < 1 || env.CACHE_TTL_DAYS > 365) {
    errors.push('CACHE_TTL_DAYS must be between 1 and 365');
  }

  if (env.TRAVEL_TIME_MARGIN_PERCENT < 0 || env.TRAVEL_TIME_MARGIN_PERCENT > 50) {
    errors.push('TRAVEL_TIME_MARGIN_PERCENT must be between 0 and 50');
  }

  if (env.RATE_LIMIT_REQUESTS_PER_WINDOW < 1) {
    errors.push('RATE_LIMIT_REQUESTS_PER_WINDOW must be >= 1');
  }

  if (env.RATE_LIMIT_WINDOW_MS < 1000) {
    errors.push('RATE_LIMIT_WINDOW_MS must be >= 1000 (1 second)');
  }

  // Port validation
  if (env.PORT < 1 || env.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // Throw if errors
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  // Success log
  console.log('✅ Environment validated');
  console.log(`   Provider: ${env.ROUTING_PROVIDER}`);
  console.log(`   Cache: ${env.ENABLE_CACHE ? 'enabled' : 'disabled (memory only)'}`);
  console.log(`   Geohash precision: ${env.GEOHASH_PRECISION}`);
  console.log(`   Time bucket: ${env.TIME_BUCKET_MINUTES} minutes`);
  console.log(`   Travel time margin: +${env.TRAVEL_TIME_MARGIN_PERCENT}%`);
  console.log(`   Port: ${env.PORT}`);
  console.log(`   CORS origin: ${env.CORS_ORIGIN}`);
}
