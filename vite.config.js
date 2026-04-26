import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed at github.com/Katinkabeat/snibble → katinkabeat.github.io/snibble/
export default defineConfig({
  plugins: [react()],
  base: '/snibble/',
  server: {
    port: 5182,
    strictPort: true,
  },
})
