import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['src/app/literaryPassages.test.ts']}});
