export type ApiConfig = {
    host: string;
    port: number;
    nodeEnv: string;
    databaseUrl: string | undefined;
};

const defaultPort = 3000;
const defaultHost = "0.0.0.0";
const defaultNodeEnv = "development";

const parsePort = (value: string | undefined): number => {
    if (!value) {
        return defaultPort;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultPort;
};

export const getConfig = (): ApiConfig => {
    return {
        host: process.env.HOST ?? defaultHost,
        port: parsePort(process.env.PORT),
        nodeEnv: process.env.NODE_ENV ?? defaultNodeEnv,
        databaseUrl: process.env.DATABASE_URL
    };
};
