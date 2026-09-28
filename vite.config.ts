import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any static host sub-path
  // (GitHub Pages, itch.io, a plain folder, ...).
  base: './',
});
