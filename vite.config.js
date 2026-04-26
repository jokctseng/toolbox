import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Change base to '/your-repo-name/' when deploying to GitHub Pages subdirectory
// e.g. if repo is github.com/user/kc-toolbox, use base: '/kc-toolbox/'
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
