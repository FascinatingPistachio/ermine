import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Allow env-var overrides at build time
    __ERMINE_API_URL__: JSON.stringify(process.env.VITE_STOAT_API_URL || ''),
    __ERMINE_WS_URL__: JSON.stringify(process.env.VITE_STOAT_WS_URL || ''),
    __ERMINE_CDN_URL__: JSON.stringify(process.env.VITE_STOAT_CDN_URL || ''),
  },
  server: {
    port: 5173,
  },
});
