/**
 * API configuration placeholder
 * Environment variables and settings will be added later
 */

export interface AppConfig {
    port: number;
    env: 'development' | 'production' | 'test';
}

export function loadConfig(): AppConfig {
    return {
        port: 3000,
        env: 'development',
    };
}
