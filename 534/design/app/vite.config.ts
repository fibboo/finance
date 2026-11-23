import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
 plugins:[react()],
 base:'./',
 css:{transformer:'lightningcss',lightningcss:{drafts:{customMedia:true}}},
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 build:{outDir:'../dist',emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./app.html',import.meta.url))}}
});
