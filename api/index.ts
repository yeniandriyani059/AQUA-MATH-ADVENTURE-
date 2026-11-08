import { createBackendApp } from '../backend/app.js';
import { createVercelApiHandler } from '../backend/vercelAdapter.js';
import { validatePreviewEnvironment } from '../scripts/preview-safety.mjs';

export default createVercelApiHandler(createBackendApp(), () => validatePreviewEnvironment(process.env));
