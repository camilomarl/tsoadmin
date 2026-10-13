import { copyFile } from 'node:fs/promises';
await copyFile('src/generated/swagger.json', 'dist/src/generated/swagger.json');
