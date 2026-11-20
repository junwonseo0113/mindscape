// Stops `npm run build:ios` before it builds an app that can't reach its
// AI endpoints: .env.ios must point VITE_API_BASE at the deployed site.
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.ios", import.meta.url), "utf8");
const base = env.match(/^VITE_API_BASE=(.*)$/m)?.[1]?.trim() ?? "";
if (!/^https:\/\/[^\s]+$/.test(base) || base.includes("YOUR-PROJECT")) {
  console.error("\n✗ Set VITE_API_BASE in .env.ios to your deployed site, e.g. https://mindscape.vercel.app\n  (see APP-STORE.md, step 2)\n");
  process.exit(1);
}
console.log(`✓ iOS build will call ${base}`);
