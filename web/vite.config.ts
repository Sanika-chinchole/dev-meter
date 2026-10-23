import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The backend's CORS and login redirect allow exactly http://localhost:5173.
    // strictPort: fail loudly if 5173 is taken instead of silently moving to 5174.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
})
