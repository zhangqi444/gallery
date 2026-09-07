/* The multi-tenant half: an author's data in their own Google Drive, and a
 * stranger reading what they published.
 *
 * Google is stubbed, as in zhangqi444/volunteer: the sandbox cannot reach
 * accounts.google.com and an OAuth popup cannot be automated anyway. The fake
 * Drive is deliberately strict about the two things that matter here — a file
 * is private until a permission is created on it, and a read without a token
 * only succeeds on a file that has been shared.
 *
 * Run:  npm run build && node test_drive.cjs */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(DIST, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return new Promise((r) => srv.listen(port, () => r({ srv, base: `http://localhost:${port}/` })));
}
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

let failures = 0;
function check(name, ok, extra) { console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) failures++; }

/* The build embeds these; the stub only has to agree with them. */
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const API_KEY = 'test-api-key';

/* The committed google.json is empty, so a clone of this repo builds with no
 * sign-in at all. The config is injected here instead, before any page script
 * runs, which is exactly when store.js reads it. */
const FAKE_GIS = `
  window.__ENABLE_DRIVE__ = true;
  window.__OAUTH_CLIENT_ID__ = ${JSON.stringify(CLIENT_ID)};
  window.__GOOGLE_API_KEY__ = ${JSON.stringify(API_KEY)};
  window.__gisCalls = JSON.parse(sessionStorage.getItem('gisCalls') || '[]');
  window.google = { accounts: { oauth2: {
    initTokenClient: (cfg) => ({ requestAccessToken: (o) => {
      window.__gisCalls.push(o.prompt); sessionStorage.setItem('gisCalls', JSON.stringify(window.__gisCalls));
      setTimeout(() => cfg.callback({ access_token: 'tok-' + Date.now(), expires_in: 3599,
        scope: 'https://www.googleapis.com/auth/drive.file openid email profile' }), 20);
    } }),
    hasGrantedAllScopes: (resp, scope) => resp.scope.includes(scope),
    revoke: (t, cb) => { window.__revoked = t; cb && cb(); }
  } } };`;

/* One in-memory Drive shared by every page in a run, so what the author
 * publishes is what the visitor's browser later asks for. */
function makeDrive() {
  return { files: new Map(), seq: 0, calls: [] };   // id -> { name, body, appProperties, shared }
}

async function fakeGoogle(ctx, drive) {
  await ctx.route(/accounts\.google\.com|fonts\.g|lh3\.googleusercontent\.com/, (r) => {
    if (/lh3\./.test(r.request().url())) {
      return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#8fb4f0"/></svg>' });
    }
    return r.abort();
  });
  await ctx.route(/googleapis\.com/, async (r) => {
    const req = r.request(), url = req.url(), m = req.method();
    drive.calls.push(m + ' ' + url.replace(/\?.*/, ''));
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    const authed = (req.headers()['authorization'] || '').startsWith('Bearer tok-');
    const key = new URL(url).searchParams.get('key');

    // an anonymous media read: only allowed with the API key, and only on a shared file
    const media = /\/drive\/v3\/files\/([^/?]+)\?.*alt=media/.exec(url);
    if (media && m === 'GET' && !authed) {
      const f = drive.files.get(media[1]);
      if (key !== API_KEY) return json({ error: { message: 'API key not valid' } }, 400);
      if (!f) return json({ error: { message: 'File not found' } }, 404);
      if (!f.shared) return json({ error: { message: 'File not found' } }, 404);
      return r.fulfill({ status: 200, contentType: 'application/json', body: f.body });
    }
    if (!authed) return json({ error: { message: 'unauthorized' } }, 401);

    if (/userinfo/.test(url)) return json({ name: 'Test Author', email: 'author@example.com', picture: '' });

    // a query: the app folder, a module's subfolder, or a module's data file
    if (/\/drive\/v3\/files\?/.test(url) && !/\/upload\//.test(url) && m === 'GET') {
      const q = new URL(url).searchParams.get('q') || '';
      const want = (key) => (q.match(new RegExp(`key='${key}' and value='([^']+)'`)) || [])[1];
      const kind = want('kind'), module = want('module'), folderQ = q.includes('mimeType=');
      const files = [...drive.files.entries()]
        .filter(([, f]) => {
          const a = f.appProperties || {};
          if (a.app !== 'little-me') return false;
          if (folderQ !== (a.kind === 'root' || a.kind === 'module')) return false;
          if (kind && a.kind !== kind) return false;
          if (module && a.module !== module) return false;
          if (!kind && !folderQ && a.kind) return false;   // data files carry no kind
          return true;
        })
        .map(([id, f]) => ({ id, name: f.name, modifiedTime: f.modifiedTime, webViewLink: 'https://drive.google.com/file/d/' + id + '/view', shared: f.shared }));
      return json({ files });
    }
    // creating a folder: plain JSON on the files endpoint, not the upload one
    if (/\/drive\/v3\/files\?/.test(url) && !/\/upload\//.test(url) && m === 'POST') {
      const meta = JSON.parse(req.postData() || '{}');
      const id = 'folder' + (++drive.seq) + '0000000';
      drive.files.set(id, { name: meta.name, appProperties: meta.appProperties || {}, parents: meta.parents || [], body: '', shared: false, modifiedTime: new Date().toISOString() });
      return json({ id });
    }
    if (media && m === 'GET') {
      const f = drive.files.get(media[1]);
      return f ? r.fulfill({ status: 200, contentType: 'application/json', body: f.body }) : json({ error: { message: 'not found' } }, 404);
    }
    if (/\/upload\/drive\/v3\/files\?/.test(url) && m === 'POST') {
      const raw = req.postData() || '';
      const metaMatch = /\r\n\r\n(\{[\s\S]*?\})\r\n--/.exec(raw);
      const meta = metaMatch ? JSON.parse(metaMatch[1]) : {};
      const parts = raw.split(/--lm_[a-z0-9]+/);
      const body = parts[2] ? parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') : '';
      const id = 'file' + (++drive.seq) + '0000000000';
      drive.files.set(id, { name: meta.name, appProperties: meta.appProperties || {}, body, shared: false, modifiedTime: new Date().toISOString() });
      return json({ id, webViewLink: 'https://drive.google.com/file/d/' + id + '/view', modifiedTime: new Date().toISOString() });
    }
    const patch = /\/upload\/drive\/v3\/files\/([^/?]+)/.exec(url);
    if (patch && m === 'PATCH') {
      const f = drive.files.get(patch[1]);
      if (f) { f.body = req.postData(); f.modifiedTime = new Date().toISOString(); }
      return json({ id: patch[1], webViewLink: 'https://drive.google.com/file/d/' + patch[1] + '/view', modifiedTime: new Date().toISOString() });
    }
    const perm = /\/drive\/v3\/files\/([^/?]+)\/permissions/.exec(url);
    if (perm && m === 'POST') {
      const f = drive.files.get(perm[1]);
      const p = JSON.parse(req.postData() || '{}');
      if (f && p.role === 'reader' && p.type === 'anyone') f.shared = true;
      return json({ id: 'perm1' });
    }
    if (perm && m === 'GET') {
      const f = drive.files.get(perm[1]);
      const owner = { id: 'owner-1', type: 'user', role: 'owner' };
      return json({ permissions: f && f.shared ? [owner, { id: 'anyone', type: 'anyone', role: 'reader' }] : [owner] });
    }
    if (perm && m === 'DELETE') {
      const f = drive.files.get(perm[1]);
      // only the anyone permission can be withdrawn; the owner's stays
      if (!/\/permissions\/anyone$/.test(url.replace(/\?.*/, ''))) return json({ error: { message: 'not found' } }, 404);
      if (f) f.shared = false;
      return r.fulfill({ status: 204, body: '' });
    }
    const del = /\/drive\/v3\/files\/([^/?]+)$/.exec(url.replace(/\?.*/, ''));
    if (del && m === 'DELETE') { drive.files.delete(del[1]); return r.fulfill({ status: 204, body: '' }); }
    return json({ error: { message: 'unhandled ' + m + ' ' + url } }, 404);
  });
  await ctx.addInitScript(FAKE_GIS);
}

(async () => {
  const { srv, base } = await serve(8170);
  const b = await chromium.launch({ executablePath: exe });
  const drive = makeDrive();

  console.log('\n== the author ==');
  const authorCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGoogle(authorCtx, drive);
  const pg = await authorCtx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|sw\.js|ERR_FAILED|ERR_TUNNEL/.test(m.text())) errs.push('CONSOLE ' + m.text()); });

  await pg.goto(base + '#/me', { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-testid=app-signin]');
  check('the app asks for sign-in before anything else', true);
  check('no Google prompt on load', (await pg.evaluate(() => window.__gisCalls.length)) === 0);

  await pg.click('[data-testid=signin-button]:not([disabled])');
  await pg.waitForSelector('[data-testid=app-home]');
  check('signed in, and the home greets by name', (await pg.textContent('[data-testid=app-home]')).includes('Test'));
  check('all three modules are offered', (await pg.$$('[data-testid^=module-card-]')).length === 3);
  check('every module is built', !(await pg.textContent('[data-testid=app-home]')).includes('not moved across yet'));
  check('each module describes its own state on the home screen',
    (await pg.$$('[data-testid^=summary-]')).length === 3);
  check('and says so honestly when there is nothing yet',
    /Nothing practised yet/.test(await pg.textContent('[data-testid=summary-learning]')));

  /* ---- Learning: the content is fetched a topic at a time ---- */
  const fetched = [];
  pg.on('request', (r) => { const m = /content\/learning\/([^?]+)/.exec(r.url()); if (m) fetched.push(m[1]); });

  await pg.click('[data-testid=module-card-learning]');
  await pg.waitForSelector('[data-testid=subject-list]');
  check('opening Learning fetches only the index', fetched.join(',') === 'index.json', fetched.join(','));
  check('the subjects are listed', (await pg.$$('[data-testid=subject-list] li')).length === 4);

  check('the five ways into Learning are offered', (await pg.$$('[data-testid=learning-tabs] button')).length === 5);
  await pg.click('[data-testid=subject-vr]');
  await pg.waitForSelector('[data-testid=practice]');
  check('choosing a subject fetches that subject and nothing else',
    fetched.join(',') === 'index.json,subject-vr.json', fetched.join(','));

  // answer the ten, taking the marked answer each time after the first
  let firstWasMarked = false;
  for (let i = 0; i < 10; i++) {
    const n = await pg.textContent('[data-testid=practice-at]');
    check(i === 0 ? 'practice starts at question 1' : `question ${i + 1}`, n === String(i + 1), n);
    await pg.click('[data-testid=choice] >> nth=0');
    await pg.waitForSelector('[data-testid=marking]');
    if (i === 0) firstWasMarked = /right|answer is/.test(await pg.textContent('[data-testid=marking]'));
    await pg.click('[data-testid=practice-next]');
  }
  check('an answer is marked immediately, with the explanation', firstWasMarked);
  await pg.waitForSelector('[data-testid=result]');
  const score = await pg.textContent('[data-testid=result-score]');
  check('the set ends with a score out of ten', /^\d+ \/ 10$/.test(score.trim()), score.trim());

  await pg.click('[data-testid=practice-again]');
  await pg.waitForSelector('[data-testid=practice]');
  check('another ten needs no second fetch', fetched.filter((f) => f === 'subject-vr.json').length === 1);
  await pg.click('[data-testid=practice-stop]');
  await pg.waitForSelector('[data-testid=session-list]');
  check('a set can be abandoned, and is not recorded', (await pg.$$('[data-testid=session-list] li')).length === 1);

  /* ---- a mock exam section, from the same runner ---- */
  await pg.click('[data-testid=tab-mock]');
  await pg.waitForSelector('[data-testid=mock-list]');
  check('four mock exams are listed', (await pg.$$('[data-testid=mock-list] > li')).length === 4);
  await pg.click('[data-testid=mock-M01]');
  await pg.waitForSelector('[data-testid=mock-sections]');
  check('a mock is split into its four subject sections', (await pg.$$('[data-testid=mock-sections] li')).length === 4);
  await pg.click('[data-testid=mock-start-vr]');
  await pg.waitForSelector('[data-testid=practice]');
  check('starting a section fetches that mock and nothing more',
    fetched.join(',') === 'index.json,subject-vr.json,mock-M01.json', fetched.join(','));
  for (let i = 0; i < 10; i++) {
    await pg.click('[data-testid=choice] >> nth=0');
    await pg.waitForSelector('[data-testid=marking]');
    await pg.click('[data-testid=practice-next]');
  }
  await pg.waitForSelector('[data-testid=result]');
  await pg.click('[data-testid=practice-done]');
  await pg.waitForSelector('[data-testid=mock-sections]');
  check('the section now shows its score instead of its length',
    /\d+ \/ 10/.test(await pg.textContent('[data-testid=mock-sections]')));

  /* ---- a week of words, asked as questions ---- */
  await pg.click('[data-testid=tab-words]');
  await pg.waitForSelector('[data-testid=word-list]');
  check('eight weeks of words are listed', (await pg.$$('[data-testid=word-list] > li')).length === 8);
  await pg.click('[data-testid=words-W1]');
  await pg.waitForSelector('[data-testid=practice]');
  check('the words file is fetched only now',
    fetched.join(',') === 'index.json,subject-vr.json,mock-M01.json,precision.json', fetched.join(','));
  check('a word is asked with four meanings to choose from', (await pg.$$('[data-testid=choice]')).length === 4);
  // the answer must not always be the first choice, or a child learns to pick A
  const keys = [];
  for (let i = 0; i < 10; i++) {
    await pg.click('[data-testid=choice] >> nth=0');
    await pg.waitForSelector('[data-testid=marking]');
    keys.push(/That's right/.test(await pg.textContent('[data-testid=marking]')));
    await pg.click('[data-testid=practice-next]');
  }
  check('the right meaning is not always the first choice', keys.some((k) => !k), keys.filter(Boolean).length + '/10 by picking A');
  await pg.waitForSelector('[data-testid=result]');
  await pg.click('[data-testid=practice-done]');

  await pg.waitForSelector('[data-testid=session-list]');
  check('practice, a mock section and a word set are all in the history',
    (await pg.$$('[data-testid=session-list] li')).length === 3);

  /* ---- the reading log ---- */
  await pg.click('[data-testid=tab-books]');
  await pg.waitForSelector('[data-testid=book-list]');
  const bookCount = (await pg.$$('[data-testid=book]')).length;
  check('the books are listed', bookCount === 13, String(bookCount));
  check('and it starts with nothing marked', /Mark a book/.test(await pg.textContent('[data-testid=book-count]')));
  await pg.click('[data-testid=book] >> nth=0 >> [data-testid=book-finished]');
  await pg.waitForFunction(() => /1 finished/.test(document.querySelector('[data-testid=book-count]').textContent));
  check('marking one as finished counts it', true);
  await pg.click('[data-testid=book] >> nth=1 >> [data-testid=book-reading]');
  await pg.waitForFunction(() => /1 finished, 1 on the go/.test(document.querySelector('[data-testid=book-count]').textContent));
  check('and one on the go is counted separately', true);
  // pressing the state a book is already in clears it, so a slip is one click to undo
  await pg.click('[data-testid=book] >> nth=1 >> [data-testid=book-reading]');
  await pg.waitForFunction(() => /^1 finished\.$/.test(document.querySelector('[data-testid=book-count]').textContent.trim()));
  check('pressing the same state again clears it', true);

  /* ---- writing: the plan, the draft and the week's own checks ---- */
  await pg.click('[data-testid=tab-essay]');
  await pg.waitForSelector('[data-testid=essay-list]');
  check('the essay programme is fetched only when it is opened',
    fetched.join(',') === 'index.json,subject-vr.json,mock-M01.json,precision.json,essay.json', fetched.join(','));
  const prompts = (await pg.$$('[data-testid=essay-list] li')).length;
  check('eight weeks and twelve more prompts are offered', prompts === 20, String(prompts));
  check('and none has been started', /Not started/.test(await pg.textContent('[data-testid=essay-W1]')));

  await pg.click('[data-testid=essay-W1]');
  await pg.waitForSelector('[data-testid=essay-write]');
  check('a prompt opens with something to write about',
    (await pg.textContent('[data-testid=essay-prompt]')).length > 20);
  check('the plan is asked for before the draft', (await pg.$$('[data-testid=essay-plan]')).length === 6);
  check('and the draft is written in its three parts', (await pg.$$('[data-testid=essay-draft]')).length === 3);
  // the prompts came from a printed workbook; its blanks must not reach the screen
  const holes = await pg.$$eval('[data-testid=essay-plan]', (els) => els.map((e) => e.placeholder));
  check('a printed blank is not shown as a row of underscores',
    holes.every((h) => !/_{2,}/.test(h) && !/write here/i.test(h)), holes.join(' | '));

  await pg.fill('[data-testid=essay-draft] >> nth=0', 'The bell rang and I ran');
  await pg.waitForFunction(() => /^6 words$/.test(document.querySelector('[data-testid=essay-words]').textContent.trim()));
  check('what is written is counted as it is written', true);
  await pg.click('[data-testid=essay-check] >> nth=0');
  await pg.waitForFunction(() => /1 of 4 checked/.test(document.querySelector('[data-testid=essay-checked]').textContent));
  check('and the week has its own checks to tick', true);

  await pg.click('[data-testid=essay-back]');
  await pg.waitForSelector('[data-testid=essay-list]');
  check('a started prompt says how much of it there is',
    /6 words/.test(await pg.textContent('[data-testid=essay-W1]')), await pg.textContent('[data-testid=essay-W1]'));

  // the home screen now reflects work done in a module
  await pg.click('[data-testid=app-brand]');
  await pg.waitForSelector('[data-testid=app-home]');
  check('the home screen counts the questions answered',
    /30 questions answered/.test(await pg.textContent('[data-testid=summary-learning]')),
    await pg.textContent('[data-testid=summary-learning]'));
  const learningCard = await pg.textContent('[data-testid=module-card-learning]');
  check('and the reading and writing alongside them',
    /1 book finished/.test(learningCard) && /1 essay started/.test(learningCard), learningCard);


  await pg.waitForFunction(() => {
    const el = document.querySelector('[data-testid=session-status]');
    return el && el.textContent.includes('Saved');
  });
  const learningFile = [...drive.files.entries()].find(([, f]) => f.appProperties && f.appProperties.module === 'learning' && !f.appProperties.kind);
  check('Learning saved a file of its own', Boolean(learningFile));
  const learned = JSON.parse(learningFile[1].body);
  check('every answer was recorded', Object.keys(learned.results).length === 30, String(Object.keys(learned.results).length));
  check('and one session per finished set', learned.sessions.length === 3, String(learned.sessions.length));
  check('the writing was saved with it', learned.essays.W1.draft['Opening and focus'] === 'The bell rang and I ran',
    JSON.stringify(learned.essays.W1 || null));
  check('with the checks that were ticked', (learned.essays.W1.checks || []).length === 1);
  check('and the book that was marked', Object.keys(learned.books).length === 1, JSON.stringify(learned.books));
  check('each kind of session is distinguished',
    [...new Set(learned.sessions.map((r) => r.kind))].sort().join(',') === 'mock,practice,words',
    learned.sessions.map((r) => r.kind).join(','));

  /* ---- Service: a place, a commitment, and hours against it ---- */
  await pg.click('[data-testid=module-link-service]');
  await pg.waitForSelector('[data-testid=service-empty]');
  check('Service starts empty and says what to do', true);

  await pg.click('[data-testid=add-org]');
  await pg.waitForSelector('[data-testid=org-dialog]');
  await pg.fill('[data-testid=org-name]', 'Seattle Humane');
  await pg.fill('[data-testid=org-contact]', 'Maria');
  await pg.click('[data-testid=org-save]');
  await pg.waitForSelector('[data-testid=org-card]');
  check('the organisation was added', (await pg.textContent('[data-testid=org-card]')).includes('Seattle Humane'));

  await pg.click('[data-testid=add-item]');
  await pg.waitForSelector('[data-testid=item-dialog]');
  await pg.fill('[data-testid=item-title]', 'Walking the dogs');
  await pg.click('[data-testid=item-save]');
  await pg.waitForSelector('[data-testid=item-row]');
  check('the commitment was added under it', (await pg.textContent('[data-testid=item-row]')).includes('Walking the dogs'));

  await pg.click('[data-testid=log-button]');
  await pg.waitForSelector('[data-testid=log-dialog]');
  await pg.fill('[data-testid=log-hours]', '0');
  await pg.click('[data-testid=log-save]');
  check('zero hours is refused with a reason', /greater than zero/.test(await pg.textContent('[data-testid=log-error]')));
  await pg.fill('[data-testid=log-hours]', '2.5');
  await pg.selectOption('[data-testid=log-item]', { label: 'Walking the dogs · Seattle Humane' });
  await pg.fill('[data-testid=log-activity]', 'Walked Rosie');
  await pg.click('[data-testid=log-save]');
  await pg.waitForSelector('[data-testid=entry-row]');
  check('the hours were logged', (await pg.textContent('[data-testid=entry-row]')).includes('Walked Rosie'));
  check('the total counts them', (await pg.textContent('[data-testid=stat-hours]')) === '2.5');

  // Service and Gallery are separate documents in Drive, not one file
  await pg.waitForFunction(() => {
    const el = document.querySelector('[data-testid=session-status]');
    return el && el.textContent.includes('Saved');
  });
  const serviceFile = [...drive.files.entries()].find(([, f]) => f.appProperties && f.appProperties.module === 'service' && !f.appProperties.kind);
  check('Service saved a file of its own', Boolean(serviceFile));
  check('its hours are in that file', JSON.parse(serviceFile[1].body).entries[0].hours === 2.5);
  // every module that has saved something has a folder of its own, and exactly one
  const modulesWithData = [...new Set([...drive.files.values()]
    .filter((f) => (f.appProperties || {}).module && !(f.appProperties || {}).kind)
    .map((f) => f.appProperties.module))].sort();
  const moduleFolders = [...drive.files.values()].filter((f) => (f.appProperties || {}).kind === 'module');
  const folderModules = moduleFolders.map((f) => f.appProperties.module).sort();
  check('each module that saved data has one folder of its own',
    folderModules.join(',') === modulesWithData.join(',') && moduleFolders.length === new Set(folderModules).size,
    folderModules.join(','));
  check('and they all sit under one app folder',
    [...drive.files.values()].filter((f) => (f.appProperties || {}).kind === 'root').length === 1);

  // the home screen reflects work done in every module, not just the last one
  await pg.click('[data-testid=app-brand]');
  await pg.waitForSelector('[data-testid=app-home]');
  check('the home screen counts the hours logged',
    /2\.5 hours/.test(await pg.textContent('[data-testid=summary-service]')),
    await pg.textContent('[data-testid=summary-service]'));
  check('and still the questions answered',
    /30 questions answered/.test(await pg.textContent('[data-testid=summary-learning]')));

  await pg.click('[data-testid=module-link-gallery]');
  await pg.waitForSelector('[data-testid=studio]');
  check('a blog starts private', /are <?strong>?private|are private/i.test((await pg.textContent('[data-testid=studio-publish]')).replace(/\s+/g, ' ')));
  check('publishing is refused while there is nothing to publish',
    await pg.isDisabled('[data-testid=studio-publish-button]'));

  // write a post and give it a picture
  await pg.click('[data-testid=studio-add]');
  await pg.waitForSelector('[data-testid=studio-post]');
  // typed rather than filled: the field is redrawn from the store on every
  // keystroke, so a store that trims as it goes would swallow the spaces
  await pg.locator('[data-testid=studio-title]').pressSequentially('My blue cat');
  check('a title can be typed with spaces in it',
    (await pg.inputValue('[data-testid=studio-title]')) === 'My blue cat',
    await pg.inputValue('[data-testid=studio-title]'));
  await pg.setInputFiles('[data-testid=studio-file]', {
    name: 'cat.png', mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  });
  await pg.waitForFunction(() => !document.querySelector('[data-testid=studio]').textContent.includes('Uploading'));
  check('the picture was uploaded to Drive as its own file',
    [...drive.files.values()].some((f) => f.appProperties && f.appProperties.kind === 'image'));
  const pictures = () => [...drive.files.values()].filter((f) => f.appProperties && f.appProperties.kind === 'image');
  check('the picture is NOT shared while the blog is private',
    pictures().every((f) => !f.shared));

  // a picture with no description says so, and saying so opens the field
  check('a picture with no description is flagged', Boolean(await pg.$('[data-testid=studio-needs-alt]')));
  await pg.click('[data-testid=studio-needs-alt]');
  await pg.waitForSelector('[data-testid=studio-details]');
  await pg.fill('[data-testid=studio-alt]', 'A blue cat asleep on a windowsill');
  await pg.fill('[data-testid=studio-caption]', 'She sleeps there every afternoon');
  await pg.fill('[data-testid=studio-tags]', 'cats, paint');
  await pg.click('[data-testid=studio-title]');   // blur, which is when topics are taken
  check('the flag goes once there is a description', (await pg.$('[data-testid=studio-needs-alt]')) === null);

  // the data file is saved but still private
  await pg.waitForFunction(() => {
    const el = document.querySelector('[data-testid=session-status]');
    return el && el.textContent.includes('Saved');
  });
  const dataFile = () => [...drive.files.entries()].find(([, f]) => f.appProperties && f.appProperties.module === 'gallery' && !f.appProperties.kind);
  check('Service data is not in the Gallery file', !JSON.stringify(JSON.parse(dataFile()[1].body)).includes('Seattle Humane'));
  check('the blog file exists in Drive', Boolean(dataFile()));
  check('the blog file is NOT shared until Publish is pressed', dataFile()[1].shared === false);
  const savedPost = () => JSON.parse(dataFile()[1].body).posts[0];
  check('the post is in the saved file', savedPost().title === 'My blue cat');
  check('with its description, caption and topics',
    savedPost().imageAlt === 'A blue cat asleep on a windowsill'
    && savedPost().caption === 'She sleeps there every afternoon'
    && savedPost().tags.join(',') === 'cats,paint',
    JSON.stringify({ alt: savedPost().imageAlt, caption: savedPost().caption, tags: savedPost().tags }));

  // a stranger cannot read it yet
  const strangerCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGoogle(strangerCtx, drive);
  const blogId = dataFile()[0];
  let sp = await strangerCtx.newPage();
  await sp.goto(base + '#/b/' + blogId, { waitUntil: 'networkidle' });
  await sp.waitForSelector('[data-testid=hero]');
  check('an unpublished blog is not readable by a stranger',
    !(await sp.textContent('body')).includes('My blue cat'));
  await sp.close();

  // publish, then a stranger can
  await pg.click('[data-testid=studio-publish-button]');
  await pg.waitForSelector('[data-testid=studio-link]');
  check('publishing shared the blog file', dataFile()[1].shared === true);
  check('and the pictures with it, so the post is not full of holes',
    pictures().length > 0 && pictures().every((f) => f.shared));
  // a picture added to a blog that is already published has to be shared as it
  // arrives, or the post it lands in shows a hole
  await pg.setInputFiles('[data-testid=studio-file]', {
    name: 'cat2.png', mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  });
  await pg.waitForFunction(() => !document.querySelector('[data-testid=studio]').textContent.includes('Uploading'));
  check('a picture added afterwards is shared as it arrives',
    pictures().length === 1 && pictures().every((f) => f.shared), String(pictures().length));

  const link = await pg.inputValue('[data-testid=studio-link]');
  check('the link carries the blog id', link.includes('#/b/' + blogId), link);

  console.log('\n== a stranger ==');
  sp = await strangerCtx.newPage();
  const strangerErrs = [];
  sp.on('pageerror', (e) => strangerErrs.push('PAGEERR ' + e.message));
  await sp.goto(base + '#/b/' + blogId, { waitUntil: 'networkidle' });
  await sp.waitForSelector('[data-testid=post-card]');
  check('the published post is readable with no sign-in',
    (await sp.textContent('[data-testid=post-card]')).includes('My blue cat'));
  check('the stranger was never asked to sign in',
    (await sp.evaluate(() => (window.__gisCalls || []).length)) === 0);
  await sp.click('[data-testid=post-card] h2 a');
  await sp.waitForSelector('[data-testid=post]');
  check('the post page opens for the stranger', (await sp.textContent('[data-testid=post-title]')) === 'My blue cat');
  check('the picture carries the description she wrote',
    (await sp.getAttribute('[data-testid=post-image]', 'alt')) === 'A blue cat asleep on a windowsill',
    await sp.getAttribute('[data-testid=post-image]', 'alt'));
  check('links keep the blog id', (await sp.evaluate(() => location.hash)).startsWith('#/b/' + blogId));
  check('the picture is a public Drive URL', /lh3\.googleusercontent\.com\/d\//.test(await sp.getAttribute('[data-testid=post-image]', 'src')));
  check('no page errors for the stranger', strangerErrs.length === 0, strangerErrs.join(' | '));

  console.log('\n== back to the author ==');
  // the session survives a reload without another Google prompt
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-testid=studio]');
  check('reload keeps the session, no consent prompt',
    (await pg.evaluate(() => window.__gisCalls.filter((p) => p === 'consent').length)) === 1);
  // the title lives in an <input>, whose value textContent never reports
  check('the post survived the reload', (await pg.inputValue('[data-testid=studio-title]')) === 'My blue cat');

  /* ---- and can be taken back off the internet ---- */
  await pg.click('[data-testid=studio-unpublish]');
  await pg.waitForSelector('[data-testid=studio-publish-button]');
  check('unpublishing withdrew the blog file', dataFile()[1].shared === false);
  check('and every picture it pointed at', pictures().every((f) => !f.shared));
  sp = await strangerCtx.newPage();
  await sp.goto(base + '#/b/' + blogId, { waitUntil: 'networkidle' });
  await sp.waitForSelector('[data-testid=hero]');
  check('the stranger can no longer read it',
    !(await sp.textContent('body')).includes('My blue cat'));
  await sp.close();

  // deleting a post takes its picture with it
  const imageIds = () => [...drive.files.entries()].filter(([, f]) => f.appProperties && f.appProperties.kind === 'image').map(([id]) => id);
  const before = imageIds();
  await pg.click('[data-testid=studio-delete]');
  await pg.waitForSelector('[data-testid=studio-post]', { state: 'detached' });
  check('deleting the post removed it', (await pg.$$('[data-testid=studio-post]')).length === 0);
  await pg.waitForFunction(() => true);
  check('its picture was deleted from Drive too', before.length === 1 && imageIds().length === 0,
    `${before.length} -> ${imageIds().length}`);

  // signing out clears the device but not the file in Drive
  await pg.click('[data-testid=app-signout]');
  await pg.waitForSelector('[data-testid=app-signin]');
  check('signing out returns to the gate', true);
  check('the blog file is still in Drive after signing out', Boolean(dataFile()));

  check('no page errors for the author', errs.length === 0, errs.join(' | '));

  await authorCtx.close(); await strangerCtx.close();
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall Drive checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
