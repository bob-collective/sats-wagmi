import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [nodePolyfills(), react()],
  build: {
    target: 'esnext',
    sourcemap: true, // Source map generation must be turned on,
    rollupOptions: {
      external: ['vite-plugin-node-polyfills/shims/buffer']
    }
  }
});
