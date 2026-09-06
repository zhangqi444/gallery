import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname)

/** Adds the PWA manifest and the offline service worker to the page. */
function blogTarget() {
  return {
    name: 'blog-target',
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' },
        {
          tag: 'script',
          children: 'if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js")});',
          injectTo: 'body',
        },
      ]
    },
  }
}

export default defineConfig({
  root: ROOT,
  base: './',
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  plugins: [react(), tailwindcss(), blogTarget()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, reportCompressedSize: true },
})
