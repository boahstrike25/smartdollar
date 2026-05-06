# Deploying $martDollar

A complete, beginner-friendly walkthrough — every option, every platform, every step.

This document covers:

1. [Run it locally on your computer](#1-run-it-locally-on-your-computer)
2. [Deploy free on GitHub Pages (recommended)](#2-deploy-free-on-github-pages-recommended)
3. [Deploy free on Cloudflare Pages](#3-deploy-free-on-cloudflare-pages)
4. [Deploy free on Netlify](#4-deploy-free-on-netlify)
5. [Self-host on any static server](#5-self-host-on-any-static-server)
6. [Install it on your phone — iOS](#6-install-it-on-your-phone--ios-iphoneipad)
7. [Install it on your phone — Android](#7-install-it-on-your-phone--android)
8. [Install it on your computer](#8-install-it-on-your-computer-desktop-pwa)
9. [Updating your deployment](#9-updating-your-deployment)
10. [Troubleshooting](#10-troubleshooting)

> **The big idea.** $martDollar is just static files (HTML, CSS, JS). It needs zero servers, zero databases, zero accounts. Anywhere you can host a web page for free — you can run $martDollar.

---

## 1. Run it locally on your computer

This is the fastest way to try $martDollar. No accounts needed.

### Option A — Easiest (no terminal)

1. Make sure you have all the project files in one folder (`index.html`, `app.js`, `manifest.webmanifest`, `service-worker.js`).
2. Double-click `index.html`.
3. It opens in your default browser. Done.

> ⚠️ When opened directly via `file://` the service worker (offline mode) does not register, but every other feature — including data storage — works.

### Option B — Local web server (recommended for full PWA features)

You need either Python or Node.js installed.

**Using Python (already on most Macs and Linux systems):**

```bash
cd path/to/your/$martdollar/folder
python3 -m http.server 8080
```

**Using Node.js:**

```bash
cd path/to/your/$martdollar/folder
npx http-server . -p 8080
```

Then open http://localhost:8080 in any modern browser (Chrome, Edge, Firefox, Safari, Brave).

---

## 2. Deploy free on GitHub Pages (recommended)

GitHub Pages gives you a free, HTTPS-enabled URL like `https://your-username.github.io/smartdollar/`. Two methods — pick one.

### Prerequisites

- A free [GitHub](https://github.com) account.
- The $martDollar files in a folder on your computer.

### Method A — Branch-based (simplest, no Actions)

1. **Create a new repository** on GitHub.
   - Click **+ → New repository**.
   - Name it whatever you like (e.g. `smartdollar` or `my-budget-app`).
   - Set it to **Public** (Pages requires public on free accounts; private requires GitHub Pro).
   - **Don't** initialize with a README. Click **Create repository**.

2. **Push your local files to the new repo.** From your $martDollar folder:

   ```bash
   git init
   git add .
   git commit -m "Initial commit — $martDollar"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

3. **Enable Pages.**
   - In your repo on GitHub, go to **Settings → Pages**.
   - Under **Build and deployment → Source**, choose **Deploy from a branch**.
   - Branch: `main`. Folder: `/ (root)`. Click **Save**.

4. **Wait 1–2 minutes** for the first build. The Pages section will show a green check and your URL:
   `https://your-username.github.io/your-repo/`

5. Open that URL on any device. Bookmark it. You're live.

### Method B — GitHub Actions (auto-deploy on every push)

The repo already includes `.github/workflows/deploy.yml`. To use it:

1. Push the code to GitHub (steps 1–2 above).
2. Go to **Settings → Pages → Source** and choose **GitHub Actions** instead of "Deploy from a branch".
3. Push any change to `main` — the Action will run, and your site updates automatically.

You can watch builds under the **Actions** tab.

---

## 3. Deploy free on Cloudflare Pages

Cloudflare Pages is fast, generous, and gives you a `*.pages.dev` URL.

1. Push your code to GitHub or GitLab (steps 1–2 from the GitHub section).
2. Sign in (or sign up free) at https://pages.cloudflare.com.
3. Click **Create a project → Connect to Git** and authorize Cloudflare to access your repo.
4. Select your $martDollar repo and click **Begin setup**.
5. Configure the build:
   - **Project name:** anything (becomes part of your URL).
   - **Production branch:** `main`.
   - **Framework preset:** None.
   - **Build command:** *leave empty*.
   - **Build output directory:** `/` (or leave default).
6. Click **Save and Deploy**. Done in about 30 seconds.

You get a URL like `https://smartdollar.pages.dev`. To use a custom domain, follow Cloudflare's prompts under **Custom domains**.

---

## 4. Deploy free on Netlify

Drag-and-drop is the fastest path here.

### Drag-and-drop (no Git required)

1. Sign up free at https://app.netlify.com.
2. From your dashboard, click **Add new site → Deploy manually**.
3. Drag your entire $martDollar folder onto the upload area.
4. That's it — Netlify gives you a URL like `https://amazing-rabbit-12345.netlify.app`.

### Git-connected (auto-deploy on push)

1. Push to GitHub.
2. **Add new site → Import an existing project → GitHub**, authorize, pick your repo.
3. **Build command:** leave empty. **Publish directory:** `/`. Click **Deploy**.

To rename the site or add a custom domain: **Site configuration → Site details → Change site name** / **Domain management**.

---

## 5. Self-host on any static server

Since $martDollar is plain static files, **any** web server works.

### Caddy (easiest with automatic HTTPS)

```caddy
smartdollar.example.com {
  root * /var/www/smartdollar
  file_server
  encode gzip
}
```

Restart Caddy. HTTPS is automatic.

### Nginx

```nginx
server {
  listen 80;
  server_name smartdollar.example.com;
  root /var/www/smartdollar;
  index index.html;
  gzip on;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Apache

Drop the files into your DocumentRoot (e.g. `/var/www/html`). Done.

### Raspberry Pi / home server

Any of the above on the Pi works perfectly. $martDollar is well under 1 MB total — even an original Pi can serve it for a household with no strain.

---

## 6. Install it on your phone — iOS (iPhone/iPad)

You need to be running the app from an HTTPS URL (any of the deploy options above) — not a local file.

### Step-by-step

1. Open **Safari** (this only works in Safari on iOS, not Chrome or Firefox).
2. Go to your $martDollar URL (e.g. `https://your-username.github.io/smartdollar/`).
3. Tap the **Share button** ⎘ at the bottom of the screen (or top, on iPad in portrait).
4. Scroll down in the share sheet and tap **Add to Home Screen**.
5. Edit the name if you like (defaults to "$martDollar"), tap **Add** in the top-right.

You now have a $martDollar icon on your home screen. Tap it: it opens full-screen, no Safari chrome, just like a native app.

> 📱 **Tip.** Once installed, you can use the app offline. The first time you open it, give it a few seconds to cache while you have signal — after that, transactions, charts, lessons, everything works on a plane.

### Important iOS notes

- **Storage limits.** iOS sometimes evicts data from "Web Apps" when storage runs low. Use **Settings → Export full backup** every few weeks and save the JSON file somewhere safe (iCloud Drive, Files app, your computer).
- **Each browser is separate.** Safari, Chrome on iOS, and Firefox on iOS each have their own storage. Use the same browser consistently.

---

## 7. Install it on your phone — Android

Works in Chrome, Edge, Brave, Samsung Internet, and most other Chromium-based browsers.

### Step-by-step (Chrome)

1. Open **Chrome** on your Android device.
2. Go to your $martDollar URL.
3. Either:
   - **Tap the "Install" prompt** that appears at the bottom of the screen (it shows up automatically because $martDollar is a valid PWA), **OR**
   - Tap the **⋮ menu** in the top-right → **Install app** (sometimes labeled "Add to Home screen").
4. Confirm by tapping **Install**.

The app appears in your app drawer, on your home screen, and behaves exactly like a native app — including in the recent-apps switcher.

### Tips

- Like iOS, Android can clear PWA data if storage is critically low. Export backups regularly.
- Long-pressing the app icon and choosing "App info" lets you see and clear its storage if you ever need to reset.

---

## 8. Install it on your computer (desktop PWA)

Yes — desktop browsers can install PWAs too.

### Chrome / Edge / Brave (Windows, Mac, Linux)

1. Open your $martDollar URL.
2. Look at the right end of the address bar for an **install icon** (a monitor with a down-arrow, or a "+" inside a square). Click it.
3. Or: **⋮ menu → Install $martDollar…** / **Apps → Install this site as an app**.
4. Confirm. The app gets its own window, taskbar/dock icon, and starts on its own.

### Safari (Mac, macOS Sonoma+ )

1. Open your URL in Safari.
2. **File → Add to Dock…** (or click the Share button → **Add to Dock**).
3. Confirm. The app launches as a standalone window from the Dock.

### Removing the app

Just like any installed app — right-click the icon and choose **Uninstall** (Windows/Linux), drag to Trash (Mac), or remove via the system app launcher.

---

## 9. Updating your deployment

When you change `index.html`, `app.js`, or any other file:

- **GitHub Pages (branch method):** push to `main`. Pages rebuilds in 30–60 seconds.
- **GitHub Pages (Actions method):** push to `main`. The Action redeploys automatically.
- **Cloudflare Pages / Netlify (Git-connected):** push to `main`. Auto-deploys.
- **Netlify (drag-and-drop):** drag the new folder onto **Deploys → Drag and drop**.
- **Self-hosted:** copy the files over (e.g. `scp -r ./* user@server:/var/www/smartdollar/`).

The **service worker has been bumped to `smartdollar-v2`** in this release. After deploying, users will get the new version automatically the next time they open the app — and old caches are cleared.

> ⚠️ **Service worker tip.** If you make further changes after this release and want users to see updates immediately, bump the cache version string in `service-worker.js` (e.g. `smartdollar-v3`). Otherwise, browsers may keep serving the old cached version for a while.

---

## 10. Troubleshooting

### "It works at home but the icon is generic on my phone"

Your icons are SVG data URIs which are excellent — but some launchers prefer PNGs. The current setup works on iOS Safari and Chrome/Edge for Android. If you really need PNG icons, generate them once (from the SVG in `manifest.webmanifest`) at 192×192 and 512×512, save as `icon-192.png` and `icon-512.png` in the project root, and update the `manifest.webmanifest` `icons` paths to point at them.

### "Service worker not registering"

This is normal in two cases:

- You opened `index.html` directly via `file://` — service workers require `http://` or `https://`. Use a local server (Section 1B) or deploy somewhere.
- You're on `http://localhost` — works in Chrome/Edge/Brave, but Safari and Firefox can be stricter. Use HTTPS or test in Chromium.

### "I lost my data after clearing my browser cache"

This is the local-first tradeoff: the data is yours, but it lives in your browser's IndexedDB. **Always export a backup** from **Settings → Export full backup (JSON)** before clearing site data, and back it up regularly anyway. To restore, **Settings → Import backup**.

### "The app shows white text on a white background" (or vice versa)

You're likely on an unusual color-scheme override. $martDollar fully supports `prefers-color-scheme: light` and `prefers-color-scheme: dark`. Try toggling your OS theme. If you spot a specific contrast issue, please open an issue.

### "It looks broken on a really old phone"

$martDollar uses modern features (CSS `backdrop-filter`, Intl.NumberFormat, IndexedDB, `prefers-color-scheme`). It targets browsers from roughly 2020 onward. On older devices, the glass effect falls back to a solid background — everything else still works.

### "I want to use a custom domain"

- **GitHub Pages:** repo **Settings → Pages → Custom domain**, enter `your.domain.com`, and add the matching CNAME record at your DNS provider.
- **Cloudflare Pages:** Project → **Custom domains → Set up a custom domain**.
- **Netlify:** **Domain management → Add domain alias**.

All three give you free HTTPS via Let's Encrypt automatically.

### "How do I make sure no one else can see my data on my phone?"

Your data is in this browser's IndexedDB on this device only. To protect it:

- Use a device passcode or biometrics. Anyone unlocking your phone can open the app.
- Don't install $martDollar on a shared/public device.
- Avoid syncing across browsers — keep using the same one.
- For an extra layer: keep a recent JSON backup in encrypted cloud storage (e.g. Bitwarden's secure notes, an encrypted iCloud Drive folder, etc.).

---

## You're done

Once deployed, your URL is yours forever. Share it with friends and family who want a private way to track their money — they can open it in their own browser and have their own completely separate data. No accounts to manage, no servers to maintain, no monthly fees. That's the point.

If you hit a snag not covered here, double-check the README and architecture documents, and feel free to file an issue against your fork.
