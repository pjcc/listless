# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Listless is a link-collection app shipped as **one self-contained `index.html`** (~2400 lines: CSP meta, CSS, markup, then a single IIFE of vanilla JS). There is no build step, no bundler, no package.json, no tests, and no framework. The only other runtime files are `worker.js` (a Cloudflare Worker) and `firestore.rules`.

Consequence: edits are made directly in `index.html` at the right line range. Keep the existing section-comment structure (`/* ---- Storage ---- */`, `/* ---- Metadata fetching ---- */`, and so on) - it is the only navigation aid in the file.

## Running and deploying

```bash
npx serve .        # must be HTTP, not file:// - Firebase Auth rejects file://
```

Then open `http://localhost:3000`. Note the Worker allowlist in `worker.js` covers `http://localhost:8000` and `http://127.0.0.1:8000`, so metadata proxying only works locally if you serve on port 8000 (`python3 -m http.server 8000`) or add your port to `ALLOWED_ORIGINS`.

- Deploy: push to `main`; GitHub Pages serves the repo root. Live at `https://piers.qa/listless/` (a path under a separate static site; `https://pjcc.github.io/listless/` 301s there). Pages has Enforce HTTPS off, so plain `http://piers.qa` still serves - hence the `http` entry in the Worker allowlist
- Worker: deployed separately via the Cloudflare dashboard, from `worker.js`
- Rules: `firestore.rules` is committed for visibility; changes must be pasted into Firebase Console > Firestore > Rules to take effect
- Verification is manual - see the checklist at the end of `SETUP.md`

## Architecture

### State and the three-layer sync

A single mutable `state = { lists: [...], activeListId }` object is the source of truth in memory. Rendering is full re-render (`renderItems()`, `renderListMenu()`) from that object, not diffing.

Persistence layers, in order:

1. `localStorage['listless']` - written synchronously by `saveLocal()` on every change, and read on boot so the app paints before auth resolves
2. Firestore `lists/{id}` - one document per list, written by `saveListToFirestore()` behind a 500ms per-list debounce timer in `_saveTimers`
3. `onSnapshot` listener in `startSnapshot()` - applies remote changes back into `state`

The write/echo collision is handled by a deliberate check in `startSnapshot()`: if `_saveTimers[id]` is still pending, the incoming snapshot for that list is **ignored**, so a local edit is not clobbered by its own round trip. Preserve that guard when touching the sync path.

`state.activeListId` is stored separately in `users/{uid}` so the choice follows the user across devices without being part of the list documents.

### Membership is denormalised on purpose

Each list document carries `members[]` (objects with `uid`, `email`, `displayName`, `role`, optional `pending`) plus two flattened arrays, `memberUids[]` and `memberEmails[]`. The flattened arrays exist because Firestore can only `array-contains` on scalars, and both the security rules and the two membership queries in `loadFromFirestore()` depend on them.

Any code that changes `members` must call `rebuildMemberArrays(list)` before saving, or the member silently loses access.

Invited-but-not-yet-signed-in members sit in `members[]` with `pending: true` and an empty `uid`, matched by email. They are resolved to a real uid in two places - `loadFromFirestore()` and `resolvePendingInvites()` - because the email-matched list may be reachable before the `invites` document is processed.

### Invite and email flow (security-sensitive)

Adding a member does, in order:

1. Push a `pending` member and save the list
2. **Await** a write to `invites/{inviteId}` with a client-generated known id
3. Only then write to `mail/{id}` with `{ to, template, inviteId, createdBy }`

The ordering is not incidental. The `mail` rule in `firestore.rules` authorises the send by `get()`-ing that invite and checking it was created by the same user and addressed to the same recipient - so a fire-and-forget invite write would race and fail. The rule also uses `hasOnly([...])` to keep `message` out of the permitted keys: the email body comes from the server-side `templates/invite` document, and the client only supplies named values (`inviterName`, `listName`) that Handlebars escapes. **Never reintroduce a client-supplied `message` field** - that turns the Trigger Email extension into an open relay from a verified sender.

### Metadata fetching is a three-stage fallback chain

`fetchMeta()` in `index.html` tries, in order:

1. **Microlink** (`api.microlink.io`) - 50 requests/day free
2. **Noembed** - only if `isBadTitle()` says stage 1 produced a URL fragment or bare domain
3. **The Cloudflare Worker** - only if the title is still bad, or there is neither image nor description

`isBadTitle()` is the gate for the whole chain, and the final fallback is `titleFromSlug()`, deriving a title from the URL path. The Worker (`worker.js`) fetches the page with a browser User-Agent and scrapes OG tags, Twitter cards and JSON-LD (both meta-attribute orders, hence the paired regexes), and is the only source of `price`.

The Worker's origin check and SSRF guard are both load-bearing and were both previously broken: the origin check must stay **unconditional and exact-match** (skipping it on a missing `Origin` header opened it to every non-browser client; substring matching let `localhost.example.com` through), and the private-address block must keep rejecting bare-numeric and `0x`-prefixed hosts, which are still valid IPv4 literals to most resolvers.

### Share links vs collaboration

Two distinct mechanisms, easily confused:

- **Collaboration** - `lists/{id}` with members, real-time, read/write, requires sign-in
- **Share links** - a point-in-time copy written to `shared/{shareId}`, read-only, readable signed out. `?s=<id>` puts the app in `shared-view` mode at boot, before auth, and replaces `state` with the fetched snapshot. Re-sharing overwrites the same `shareId`, so a share link does not track the list live

`firestore.rules` deliberately splits `get: if true` from `list: if false` on `shared` rather than using `read` - public `read` would let anyone page the collection and harvest every shared list. Do not collapse those two back into `read`.

### UI conventions

- All interaction goes through **one delegated `click` listener** matching `[data-action]` on `document`. New buttons get a `data-action` and a `case`, not their own listener
- Any user string interpolated into a template literal must go through `esc()`, including inside `data-` attributes
- Confirmations use the in-page modal (`openModal` / `openConfirmModal`), never `confirm()` or `alert()`
- Destructive actions route through `showUndo(msg, fn)` rather than a confirmation prompt
- Drag reorder is SortableJS, re-initialised by `initSortable()` after every render
- Custom card images are stored as base64 data URIs inside the list document, so they count against Firestore's 1MB document limit

## Configuration points

Lines needing per-deployment values are flagged with `/* UPDATE: */` comments. Currently: Firebase config (~line 1091), reCAPTCHA v3 site key (~line 1100), Worker URL (~line 1519). Grep for `UPDATE:` rather than trusting those line numbers.

If you add an outbound host, it must be added to **both** the CSP `connect-src` in the `<meta>` tag at `index.html:6` and, where relevant, the Firebase Auth authorised-domains list. A missing CSP entry fails silently as a blocked request.

Do not confuse the Firebase Auth **authorised domains** list (Firebase Console > Authentication > Settings) with the OAuth client's **Authorized JavaScript origins** (Google Cloud > Google Auth Platform > Clients). App origins such as `piers.qa` and `pjcc.github.io` belong in the first only. The second correctly contains just the `authDomain` (`listless-70dd1.firebaseapp.com`), because Firebase runs the OAuth handshake on that handler rather than on the page's own origin - adding app domains there achieves nothing.

`.gitignore` excludes `LINKS.md` (admin console URLs) and `.claude/`.
