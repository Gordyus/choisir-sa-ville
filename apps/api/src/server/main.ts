import { createApp } from "./app.js";
import { getConfig } from "./config.js";

const startServer = async (): Promise<void> => {
    const config = getConfig();
    const app = createApp(config);

    console.log(
        `DATABASE_URL configured: ${config.databaseUrl ? "true" : "false"}`
    );

    try {
        await app.listen({
            host: config.host,
            port: config.port
        });

        console.log(`API listening on http://${config.host}:${config.port}`);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

void startServer();
