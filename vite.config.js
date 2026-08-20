import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 仓库名，部署到 https://<username>.github.io/personal-info-web/
  base: '/personal-info-web/',
  build: {
    outDir: 'dist'
  }
})
