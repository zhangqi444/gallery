import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'content', 'site.json'), 'utf8'))

/* The Google client id and browser API key. Both are public values meant to
 * ship in a page: the client id identifies the OAuth app, and the API key only
 * reads files their owners have already shared. Neither is a secret, and the
 * key should be restricted to this site by HTTP referrer in the Cloud console.
 * With the file empty the app simply has no sign-in and reads the built-in
 * content, so the site still builds and runs for anyone cloning it. */
const GOOGLE = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'google.json'), 'utf8')) }
  catch { return { client_id: '', api_key: '' } }
})()

/** Adds the PWA manifest and the offline service worker to the page. */
function blogTarget() {
  return {
    name: 'blog-target',
    transformIndexHtml() {
      // Nothing is written when there is no client id, so the page simply has
      // no sign-in — and a test can supply its own config before the app loads
      // rather than fighting a script that has already set these to empty.
      const google = []
      if (GOOGLE.client_id) {
        google.push({
          tag: 'script',
          children:
            'window.__ENABLE_DRIVE__=true;' +
            'window.__OAUTH_CLIENT_ID__=' + JSON.stringify(GOOGLE.client_id) + ';' +
            'window.__GOOGLE_API_KEY__=' + JSON.stringify(GOOGLE.api_key || '') + ';',
          injectTo: 'head',
        })
        google.push({ tag: 'script', attrs: { src: 'https://accounts.google.com/gsi/client', async: true, defer: true }, injectTo: 'head' })
      }
      return [
        ...google,
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

/** The site's public address, from content/site.json: the canonical link and
 * the social tags in the head, the Google Search Console verification tag when
 * a token is set, and CNAME, robots.txt and sitemap.xml in the build. The build
 * itself stays relative, so the same output still works under /gallery/. */
function siteAddress() {
  const url = SITE.url ? new URL(SITE.url) : null
  const verification = (SITE.google && SITE.google.siteVerification) || ''
  return {
    name: 'site-address',
    transformIndexHtml() {
      const tags = [
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: SITE.title }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: SITE.description }, injectTo: 'head' },
      ]
      if (url) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url.href }, injectTo: 'head' })
        tags.push({ tag: 'meta', attrs: { property: 'og:url', content: url.href }, injectTo: 'head' })
      }
      if (verification) tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: verification }, injectTo: 'head' })
      return tags
    },
    generateBundle() {
      if (!url) return
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      emit('CNAME', url.hostname + '\n')
      emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${url.href}sitemap.xml\n`)
      emit(
        'sitemap.xml',
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${url.href}</loc></url>\n</urlset>\n`,
      )
    },
  }
}

export default defineConfig({
  root: ROOT,
  base: './',
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  plugins: [react(), tailwindcss(), blogTarget(), siteAddress()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, reportCompressedSize: true },
})
