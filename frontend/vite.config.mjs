import { defineConfig, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    {
      name: 'tecnotitlan-js-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!/[/\\]src[/\\].*\.js$/.test(id)) return null;
        return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
      },
    },
    react({ include: /\.[jt]sx?$/ }),
  ],
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: { alias: { components: path.resolve(import.meta.dirname, 'src/components'), context: path.resolve(import.meta.dirname, 'src/context') } },
  build: {
    outDir: 'build', sourcemap: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-quill-new') || id.includes('/quill/')) return 'editor';
          if (id.includes('@stripe') || id.includes('@paypal')) return 'payments';
          if (id.includes('socket.io')) return 'realtime';
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
});
