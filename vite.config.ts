import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const alias = { '@shared': resolve(__dirname, 'src/shared'), '@backend': resolve(__dirname, 'src/backend') };

/** Builds the UI (src/renderer + src/backend) that Tauri loads into the system webview. */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias },
  plugins: [react()],
  // Tauri's CLI prints its own output; keep Rust errors visible.
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  css: {
    modules: { localsConvention: 'camelCaseOnly', generateScopedName: '[name]__[local]__[hash:base64:5]' },
  },
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true,
    // WebView2 (Windows) is evergreen Chromium; WebKitGTK and WKWebView lag behind it.
    target: ['chrome110', 'safari15'],
  },
});
