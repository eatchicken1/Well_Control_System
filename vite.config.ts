import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Dev proxy target is environment-configurable (VITE_API_TARGET in .env
  // or shell). Runtime code always uses relative /api paths, so production
  // only needs a reverse proxy; this only removes the hardcoded localhost
  // from local development.
  // Vite does not automatically expose .env values to the config through
  // process.env. Load the mode-specific files explicitly so local dev and CI
  // use the same API target that the project documents.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || process.env.VITE_API_TARGET || 'http://127.0.0.1:5007'
  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used - do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      // Browser tooling may create a temporary profile inside the workspace.
      // Keep Vite from watching its locked cache files and crashing the dev
      // server when the profile is active.
      watch: {
        ignored: ['**/.edge-temp/**'],
      },
      proxy: {
        '/api/realtime': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

