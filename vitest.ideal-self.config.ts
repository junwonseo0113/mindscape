import { defineConfig } from "vitest/config";

export default defineConfig({test:{environment:"node",include:["src/app/idealSelf/*.test.ts","src/server/idealSelf/*.test.ts"],clearMocks:true}});
