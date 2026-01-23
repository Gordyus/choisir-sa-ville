import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const startServer = async (): Promise<void> => {
    const config = readConfig();
    const app = createApp();

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
