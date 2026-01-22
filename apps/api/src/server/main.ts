/**
 * API entry point placeholder
 * Server startup logic will be added later
 */

import { createApp } from './app.js';

export function main() {
    const app = createApp();
    console.log(`${app.name} v${app.version} - ready for implementation`);
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
