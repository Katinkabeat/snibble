# Snibble 🌿

A cozy daily word pet, part of [Rae's Side Quest](https://katinkabeat.github.io/games/).

Feed a critter words matching its daily craving. Raise it over ~30 sessions.
When it graduates, it joins your sanctuary and a new pet adopts you.

- **Live:** `katinkabeat.github.io/snibble/`
- **Repo:** `github.com/Katinkabeat/snibble`
- **Auth:** Side Quest hub is the only sign-in surface. Unauthed visitors are bounced to `/games/`.
- **Supabase:** shares the project (`yyhewndblruwxsrqzart`) with Wordy and Rungles. Snibble's tables are prefixed `sn_*`.

## Local dev

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Snibble runs on **http://localhost:5182**.

For the unified local dev environment (all SQ apps under one origin), run
`npm run dev:all` from `rae-side-quest/` instead.

## Deploy

GitHub Actions auto-deploys on push to `main`. See `.github/workflows/deploy.yml`.
The build step reads two secrets from GitHub Settings → Secrets → Actions:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Design notes

The full plan (rules, pets, craving generator, etc.) lives in user memory at
`project_sq_snibble.md`. The 30-craving JSON in `docs/cravings-test-seed.json`
is QA seed data — proves the rule families produce solvable puzzles. The actual
v1 craving content comes from an algorithmic generator with a solvability check.
