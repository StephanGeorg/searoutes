/**
 * @fileoverview Data utility functions for loading and processing JSON/GeoJSON files
 * @author Stephan Georg
 * @version 1.0.0
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const loadJsonFile = (filePath = '') => {
  if (!filePath) {
    throw new Error('File path is required');
  }

  try {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Construct absolute path and load JSON data
    const absolutePath = join(__dirname, filePath);
    const jsonContent = readFileSync(absolutePath, 'utf8');
    const json = JSON.parse(jsonContent);

    return json;
  } catch (/** @type {any} */ error) {
    // Enhance error with file path information
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}. ${error.message}`);
    }
    throw new Error(`Failed to load file: ${filePath}. ${error.message}`);
  }
};



