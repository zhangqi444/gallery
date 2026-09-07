# The Little Me

One app for a child's practice, service and pictures, built inside this
repository. Three existing sites each keep their own copy of the same machinery;
this is how they become one, without a single record being rewritten.

The published version of this plan, with the measurements behind it, is at
<https://claude.ai/code/artifact/27c71b45-1f29-4bea-83a2-dc6c75c520b5>.

## The shape

A child signs in with Google once. The app creates a folder in **their own**
Drive with a subfolder per module, and keeps that module's document — and
whatever else it needs — inside it. Every family is its own tenant; there is no
server, no database and nothing shared between them.

```
Drive/
└── The Little Me/
    ├── Learning/   learning.json
    ├── Service/    service.json
    └── Gallery/    gallery.json + one file per picture
```

A subfolder per module rather than three files in one folder, because a module
holds more than one file — Gallery's pictures today — and because a person
opening their own Drive should be able to see what belongs to what.

One file per module, never one combined document: a module can be added or
rewritten without migrating anyone's other data, and a bad write can only cost
one module.

## Where a page's content comes from

| Address | Chrome | Source |
|---|---|---|
| `#/me`, `#/me/<module>` | the app | the signed-in child's own Drive |
| `#/b/<driveFileId>/…` | the reader | that published blog, read with an API key and no sign-in |
| everything else | the reader | this deployment's own blog: `blogId` in `content/site.json`, else the committed bundle |

Two chromes on purpose. A stranger following a link to a child's drawings should
never see their practice or their hours in a sidebar. `appHome` in
`content/site.json` decides which of the last two answers `#/`; it is `false`
here, so this build still opens on the blog.

## The constraint that shapes the migration

Both existing apps use the `drive.file` scope, which grants access only to files
created by **that OAuth client**. `isee` and `volunteer` use different client ids
in different Google Cloud projects, so The Little Me — with a client id of its
own — can read neither app's existing data. No code fixes this; it is what makes
the scope safe.

So the data is carried across by an export the person downloads and imports,
once, by hand. `volunteer` already has export and import in its settings.
`isee` has neither, but its `progress.json` can be downloaded from Drive
directly, so **neither old repository has to be modified**.

- Nothing is deleted. Both old files stay in Drive, and both old apps keep
  working, until the merged app has been used for real.
- Nothing is rewritten. Import preserves every `id`, `createdAt` and `at`, so the
  merge logic behaves identically afterwards.
- Import reports what it read, and the counts are checked against the old app
  before that app is retired.

## Order of work

1. ~~The shared core, tested on its own~~ — `lib/google.js`, `lib/session.js`, `lib/module-store.js`, with `test_drive.cjs` over them.
2. ~~The shell~~ — one sign-in, the module bar, a home in the first person.
3. ~~Gallery~~ — moved into `src/modules/gallery/`, the first module on the shared store.
4. **Service**, from volunteer: catalog, plans, work items, hours, organisations, reports.
5. **Learning**, from isee: four subjects, 36 passages, essays, mocks, precision, books, rewards. Its content bundle is 580 kB and must stay behind the module's dynamic import.
6. **Import**, reading volunteer's export and isee's `progress.json` as downloaded from Drive.
7. **Cut over** — run both old apps and the new one side by side for a week, check the counts, then point the domains.

## Rules this work must not break

- `isee` and `volunteer` are read-only references. Nothing in this plan modifies them.
- A module's content is loaded only when that module is opened. `registry.js`
  uses dynamic imports for this, and the build must keep producing a chunk per
  module — check the build output, not the intention.
- Nothing is public until the child publishes it, and `test_drive.cjs` holds that
  line with a fake Drive that refuses anonymous reads of unshared files.
