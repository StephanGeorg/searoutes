#!/usr/bin/env node

// Simple wrapper to handle ES6 imports for CLI
import('./generate-graph-es6.js').then(({ main }) => {
  main();
}).catch(console.error);
