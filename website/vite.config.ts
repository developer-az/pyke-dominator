import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: set VITE_BASE=/pyke-dominator/
// Vercel / custom domain: leave unset (defaults to /)
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
