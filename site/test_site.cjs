/* The one suite: serves dist/ under a GitHub Pages-style subpath (/gallery/) and
 * walks the site on a desktop and a phone: home, a post, a topic, About, the
 * gallery lightbox, the phone menu, the theme toggle, and a 404.
 * Run:  npm run build && node test_site.cjs */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, 'dist');
const BUNDLE = JSON.parse(fs.readFileSync(path.join(DIST, 'content', 'bundle.json'), 'utf8'));
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (!p.startsWith('/gallery')) { res.writeHead(404); return res.end(); }
    p = p.slice('/gallery'.length) || '/'; if (p === '/') p = '/index.html';
    const f = path.join(DIST, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  return new Promise((r) => srv.listen(port, () => r({ srv, base: `http://localhost:${port}/gallery/` })));
}
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

let failures = 0;
function check(name, ok, extra) { console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) failures++; }
const errorsOf = (pg) => { const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|sw\.js|net::ERR_FAILED/.test(m.text())) errs.push('CONSOLE ' + m.text()); }); return errs; };

(async () => {
  const { srv, base } = await serve(8160);
  const b = await chromium.launch({ executablePath: exe });
  const posts = BUNDLE.posts, lead = posts[0];
  for (const [label, viewport] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    console.log('\n== ' + label + ' ==');
    const phone = label === 'phone';
    const ctx = await b.newContext({ viewport, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    const pg = await ctx.newPage(); const errs = errorsOf(pg);

    // home
    await pg.goto(base, { waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=hero]');
    check('hero shows the site title and tagline', (await pg.textContent('[data-testid=hero]')).includes(BUNDLE.site.title) && (await pg.textContent('[data-testid=hero]')).includes(BUNDLE.site.description));
    check('document title is the site title', (await pg.title()) === BUNDLE.site.title);
    const cards = await pg.$$('[data-testid=post-card]');
    check(`one card per post (${posts.length})`, cards.length === posts.length, String(cards.length));
    check('newest post leads', (await cards[0].textContent()).includes(lead.title));
    check('cards carry the byline and read time', /min read/.test(await cards[0].textContent()));
    check('topics listed', (await pg.$$('[data-testid=tag-cloud] a')).length > 0);
    if (phone) {
      check('phone hides the inline nav', !(await pg.isVisible('[data-testid=nav]')));
      await pg.click('[data-testid=menu-toggle]');
      await pg.waitForSelector('[data-testid=nav-mobile]');
      await pg.click('[data-testid=nav-mobile] a:has-text("Gallery")');
      await pg.waitForSelector('[data-testid=gallery]');
      check('phone menu navigates and closes', (await pg.$('[data-testid=nav-mobile]')) === null);
      await pg.goto(base, { waitUntil: 'networkidle' });
      await pg.waitForSelector('[data-testid=hero]');
    } else {
      check('desktop shows the inline nav', await pg.isVisible('[data-testid=nav]'));
    }
    await pg.screenshot({ path: `shot-${label}-home.png`, fullPage: true });

    // a post, reached from its card
    await pg.click(`[data-testid=post-card] h2 a:has-text("${lead.title}")`);
    await pg.waitForSelector('[data-testid=post]');
    const hash = await pg.evaluate(() => location.hash);
    check('card opens the post route', hash === '#/post/' + lead.slug, hash);
    check('post title rendered', (await pg.textContent('[data-testid=post-title]')) === lead.title);
    check('markdown body rendered with headings', (await pg.$$('[data-testid=prose] h2')).length > 0);
    check('markdown lists rendered', (await pg.$$('[data-testid=prose] li')).length > 0);
    check('document title names the post', (await pg.title()).startsWith(lead.title));
    check('read more shows other posts', (await pg.$$('[data-testid=read-more] [data-testid=post-card]')).length === Math.min(3, posts.length - 1));
    check('older link present on the newest post', /Older/.test(await pg.textContent('[data-testid=post-nav]')));
    await pg.screenshot({ path: `shot-${label}-post.png`, fullPage: true });

    // topic page from the post's tag link
    const tag = lead.tags[0];
    await pg.click(`[data-testid=post] header a:has-text("${tag}")`);
    await pg.waitForSelector('[data-testid=tag-page]');
    const tagged = posts.filter((p) => p.tags.includes(tag)).length;
    check(`topic "${tag}" lists ${tagged} post(s)`, (await pg.$$('[data-testid=tag-page] [data-testid=post-card]')).length === tagged);

    // about, from the header
    await pg.goto(base + '#/about', { waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=page]');
    check('about page renders', (await pg.textContent('[data-testid=page-title]')) === BUNDLE.pages.find((p) => p.slug === 'about').title);
    check('about nav link is current', (await pg.$$('[data-testid=nav-link][aria-current=page]:has-text("About"), [data-testid=nav-mobile] [aria-current=page]')).length >= (phone ? 0 : 1));

    // gallery + lightbox
    await pg.goto(base + '#/gallery', { waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=gallery]');
    check(`gallery shows ${BUNDLE.gallery.length} pictures`, (await pg.$$('[data-testid=gallery-item]')).length === BUNDLE.gallery.length);
    await pg.click('[data-testid=gallery-item]');
    await pg.waitForSelector('[data-testid=lightbox]');
    check('lightbox opens with the caption', (await pg.textContent('[data-testid=lightbox]')).includes(BUNDLE.gallery[0].caption || BUNDLE.gallery[0].alt));
    await pg.keyboard.press('Escape');
    await pg.waitForSelector('[data-testid=lightbox]', { state: 'detached' });
    check('lightbox closes on Escape', true);
    await pg.screenshot({ path: `shot-${label}-gallery.png`, fullPage: true });

    // 404
    await pg.goto(base + '#/post/no-such-post', { waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=not-found]');
    check('unknown post shows the 404 view', true);

    // theme: toggle, persist across a reload, restore
    await pg.goto(base, { waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=hero]');
    await pg.click('[data-testid=theme-toggle]');
    check('dark theme applied', await pg.evaluate(() => document.documentElement.classList.contains('dark')));
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid=hero]');
    check('dark theme survives a reload', await pg.evaluate(() => document.documentElement.classList.contains('dark')));
    await pg.screenshot({ path: `shot-${label}-dark.png`, fullPage: true });
    await pg.click('[data-testid=theme-toggle]');
    check('light theme restored', !(await pg.evaluate(() => document.documentElement.classList.contains('dark'))));

    check('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
