import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default [
  // ES Module build
  {
    input: 'src/SeaRoutes.js',
    output: {
      file: 'dist/SeaRoutes.js',
      format: 'es',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      terser(),
    ],
  },
  // CommonJS build for older Node.js compatibility
  {
    input: 'src/SeaRoutes.js',
    output: {
      file: 'dist/SeaRoutes.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      terser(),
    ],
  },
];
