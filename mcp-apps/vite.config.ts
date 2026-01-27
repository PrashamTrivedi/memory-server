import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

const apps = ['memory-browser', 'memory-editor', 'triage-dashboard', 'tag-manager'];
const app = process.env.APP;

// Build configuration for a single app (for production single-file builds)
function singleAppConfig(appName: string) {
  return defineConfig({
    plugins: [preact(), viteSingleFile()],
    root: resolve(__dirname, `src/${appName}`),
    build: {
      target: 'esnext',
      outDir: resolve(__dirname, `dist/${appName}`),
      emptyOutDir: true,
    }
  });
}

// Dev configuration with all apps accessible
function devConfig() {
  return defineConfig({
    plugins: [preact()],
    root: resolve(__dirname, 'src'),
    build: {
      target: 'esnext',
      outDir: resolve(__dirname, 'dist'),
      rollupOptions: {
        input: Object.fromEntries(
          apps.map(name => [name, resolve(__dirname, `src/${name}/index.html`)])
        ),
      }
    }
  });
}

export default app && apps.includes(app) ? singleAppConfig(app) : devConfig();
