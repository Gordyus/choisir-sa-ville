import { runInseeImport } from "./insee/run.js";

try {
  await runInseeImport(process.argv.slice(2));
} catch (error) {
  console.error(error);
  process.exit(1);
}
