# Push $martDollar to GitHub

Your push to `boahstrike25/smartdollar.git` was rejected as **non-fast-forward**, which means the remote `main` branch has commits that your local copy doesn't (very common when GitHub auto-creates a README/LICENSE during repo creation, or when you've pushed a different version before).

This folder contains the complete, production-ready $martDollar app. Pick **one** of the three methods below depending on what you want to keep on the remote.

---

## Method A — Recommended: fresh clone, drop in our files, push

This is the **safest, most reliable** method. It guarantees no conflicts because you start from whatever the remote currently has and overlay our files on top.

```bash
# 1) Clone the existing remote into a new folder
cd ~/Desktop                   # or wherever you keep projects
git clone https://github.com/boahstrike25/smartdollar.git smartdollar-clean
cd smartdollar-clean

# 2) Wipe everything except .git (keeps history, removes old files)
git ls-files -z | xargs -0 rm -f
find . -type d -empty -not -path './.git*' -delete

# 3) Copy in the contents of THIS folder (the smartdollar/ folder I gave you)
#    Replace the path below with wherever you saved this folder:
cp -R "/path/to/smartdollar/." .

# 4) Stage, commit, push — fast-forward succeeds because we built on top of remote HEAD
git add -A
git commit -m "Release \$martDollar v1.1: rebrand, glassmorphism, 25 lessons, deployment guide"
git push origin main
```

If your default branch is `master` instead of `main`, swap `main` → `master` in the last line.

---

## Method B — Force push (overwrites remote with this folder)

Use this only if the remote contains nothing you want to keep. **It will erase all remote history.**

```bash
cd /path/to/smartdollar          # this folder

# Initialise git if you haven't already
git init
git branch -M main
git remote remove origin 2>/dev/null
git remote add origin https://github.com/boahstrike25/smartdollar.git

# Stage everything
git add -A
git commit -m "Release \$martDollar v1.1"

# Force-push, overwriting remote main
git push -u origin main --force
```

`--force-with-lease` is a slightly safer variant if you want to make sure you're not blowing away someone else's work:

```bash
git push -u origin main --force-with-lease
```

---

## Method C — Pull, merge, then push (preserves both histories)

Use this if you genuinely want to merge what's on the remote with this version.

```bash
cd /path/to/your-existing-local-repo

# Bring remote changes in, allowing unrelated histories
git pull origin main --allow-unrelated-histories

# Resolve any conflicts in the editor that opens, then:
git add -A
git commit -m "Merge remote into \$martDollar v1.1"
git push origin main
```

If the merge is messy, abandon it (`git merge --abort`) and use Method A or B.

---

## After a successful push: enable GitHub Pages

The `.github/workflows/deploy.yml` in this folder auto-deploys on every push.

1. Go to **https://github.com/boahstrike25/smartdollar/settings/pages**
2. Under **Source**, choose **GitHub Actions**
3. The workflow will run automatically on the next push (or trigger it manually under the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**)
4. Your app will be live at **https://boahstrike25.github.io/smartdollar/** within a couple of minutes

---

## What's in this folder

```
smartdollar/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Free GitHub Pages auto-deploy
├── .gitignore                  # Keeps OS / editor cruft out of the repo
├── DEPLOYMENT.md               # Full deployment guide (mobile, desktop, all hosts)
├── LICENSE                     # MIT
├── PUSH_TO_GITHUB.md           # This file
├── README.md                   # Project README
├── app.js                      # All app logic (~117 KB)
├── index.html                  # App shell + design system
├── manifest.webmanifest        # PWA manifest with the new $martDollar logo
└── service-worker.js           # Offline-first cache
```

Total upload size: ~180 KB. No build step, no `node_modules`, nothing to compile.

---

## Troubleshooting

**"fatal: not a git repository"**
You skipped `git init` (Method B). Run it from inside the `smartdollar/` folder.

**"fatal: refusing to merge unrelated histories"** (Method C)
Add the `--allow-unrelated-histories` flag — already shown in the command above.

**"Updates were rejected because the tip of your current branch is behind"**
Same non-fast-forward error you started with. Switch to Method A or B.

**"Permission denied (publickey)"**
You're using SSH but haven't added a key. Either add your SSH key to GitHub (Settings → SSH and GPG keys) **or** swap the URL to HTTPS:

```bash
git remote set-url origin https://github.com/boahstrike25/smartdollar.git
```

GitHub now requires a Personal Access Token instead of your password for HTTPS pushes — generate one at **Settings → Developer settings → Personal access tokens → Tokens (classic)** with `repo` scope.

**Wrong default branch name**
Run `git branch` to see what your local branch is called. If it's `master` and the remote is `main` (or vice versa), rename with:

```bash
git branch -M main
```

---

If anything fails, copy the exact error and I'll get you unstuck.
