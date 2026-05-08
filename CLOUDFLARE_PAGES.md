# Deploying $martDollar to Cloudflare Pages

This guide covers two things:

1. **First-time setup** — connecting the GitHub repo to Cloudflare Pages.
2. **Troubleshooting** — what to do when a push lands on GitHub Pages but
   Cloudflare Pages stays on an old version (the issue you just hit).

$martDollar is a static, single-folder PWA — no build step is required.
Cloudflare just needs to publish the folder as-is.

---

## 1. First-time setup

1. Sign in at <https://dash.cloudflare.com> and pick the **Workers & Pages**
   section in the left sidebar.
2. Click **Create** → **Pages** → **Connect to Git**.
3. Authorize Cloudflare against your GitHub account and pick the
   `smartdollar` repository.
4. On the **Set up builds and deployments** screen:
   - **Production branch**: `main` (must match the branch your `push.sh`
     pushes to — the script defaults to `main`).
   - **Framework preset**: *None*.
   - **Build command**: leave **empty**.
   - **Build output directory**: `/` (just the slash — the site lives at
     the repo root).
   - **Root directory**: leave as `/`.
   - **Environment variables**: none required.
5. Click **Save and Deploy**. The first build takes ~30–60 seconds.

Your site is then live at `https://<project>.pages.dev` and at any custom
domain you attach in **Custom domains**.

---

## 2. Why your last push didn't redeploy on Cloudflare

When a `git push` updates GitHub Pages but Cloudflare Pages stays stale,
it's almost always one of these five causes. Walk through them in order —
the first one that matches is usually the culprit.

### A. Production branch mismatch (most common)

Cloudflare Pages only auto-deploys commits on the *Production branch*
configured in the project. If `push.sh` pushed to `main` but Cloudflare
is watching `master` (or vice versa), nothing happens.

**Fix**

1. Cloudflare dashboard → **Workers & Pages** → your `smartdollar` project.
2. **Settings** → **Builds & deployments** → **Production branch**.
3. Confirm it matches the branch `push.sh` pushed to (default: `main`).
4. If you change it, trigger a fresh deploy (see section C below).

To check what branch your local script pushed:

```bash
cd /path/to/your/clone
git branch --show-current
git log -1 --format="%h %s"
```

### B. The GitHub → Cloudflare webhook is missing or revoked

Cloudflare deploys via a GitHub webhook + an installed GitHub App. If the
GitHub App was uninstalled or its access to the repo was revoked, pushes
silently stop triggering builds.

**Fix**

1. <https://github.com/settings/installations> → click **Configure** next
   to **Cloudflare Pages**.
2. Under **Repository access**, make sure either *All repositories* is
   selected or `smartdollar` is in the explicit allowlist.
3. Save. The next push should fire a deploy. (You can also re-trigger the
   last commit using section C.)

You can also confirm the webhook is firing on the GitHub side:
**Repository → Settings → Webhooks** — there should be a Cloudflare entry
with green checkmarks on recent deliveries.

### C. Manually retrigger the latest commit

Even if the webhook didn't fire, you can deploy any commit on demand:

1. Cloudflare dashboard → your project → **Deployments** tab.
2. Find the most recent deployment row → **⋯** menu → **Retry deployment**,
   or click **Create deployment** at the top right and pick the branch.

This is the fastest way to get unstuck right now without diagnosing the
webhook.

### D. Browser is showing a cached old service worker

This is the second-most-common reason "my deploy didn't take effect" —
the deploy *did* happen, but your browser is still serving the previous
shell from the $martDollar service worker cache.

`$martDollar`'s service worker cache key is bumped to `smartdollar-v3` in
this release, which forces eviction on most browsers automatically. If you
still see the old UI:

1. Open the deployed page.
2. DevTools → **Application** → **Service Workers** → **Unregister**.
3. **Application** → **Storage** → **Clear site data**.
4. Hard reload (Cmd-Shift-R / Ctrl-Shift-R).

Or, simpler: open the site in an incognito / private window and confirm
the new version is there. If incognito shows the new build, it was a
cache issue, not a deploy issue.

### E. Cloudflare's own edge cache (rare)

Cloudflare Pages caches the static HTML at the edge. After a successful
deploy this normally invalidates within a minute, but you can force it:

1. Cloudflare dashboard → your domain → **Caching** → **Configuration** →
   **Purge Everything**.
2. Or, on the project page, **⋯** next to the new deployment → **Promote
   to production** if you see it (forces a re-bind).

---

## 3. Quick checklist for "deploy didn't take effect"

Run through these in order — most cases are resolved by step 2 or 4:

1. Confirm `git log -1` on the deployed branch matches what you expected.
2. Cloudflare dashboard → **Deployments** — is there a row for the new
   commit? If yes → it's a cache issue, jump to step 4.
3. If no row exists → it's a webhook/branch issue, see sections A & B.
4. Hard-reload in incognito (no extensions, no service worker). If the
   new version is there, it was just local caching.
5. Still stale? Purge the Cloudflare cache (section E) and unregister
   the service worker on your device (section D).

---

## 4. Configuration recap

For your records, the canonical Cloudflare Pages settings for $martDollar:

| Setting | Value |
| --- | --- |
| Framework preset | *None* |
| Build command | *(empty)* |
| Build output directory | `/` |
| Root directory | `/` |
| Production branch | `main` |
| Node version | not used |
| Environment variables | none |

That's it. Push to `main`, Cloudflare publishes the folder. No build
pipeline to debug.
