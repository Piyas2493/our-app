# Deploying JeevanLink

Stack: **Vercel** (Next.js app -- frontend + API routes together, its
native strength -- plus **Vercel Blob** for medical document storage)
+ **Render** (jeeva + ocr-service -- persistent Python servers, which
Vercel's serverless model doesn't support) + **MongoDB Atlas**
(database).

No Cloudflare -- it was considered for document storage and as a
DNS/firewall front, but Vercel Blob solves the storage problem natively
(one less account/platform), and Vercel/Render's own `.vercel.app` /
`.onrender.com` URLs work fine for judging without a custom domain. If
you want a custom domain later, Vercel supports that directly (Project
-> Settings -> Domains) -- no Cloudflare needed for that either.

Everything below marked **[YOU]** needs your own account/login on that
platform -- there's no way to script account creation or click through
someone else's dashboard. Everything else is already done in the repo.

## 1. MongoDB Atlas (database)

**[YOU]**
1. Sign up / log in at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a free **M0** cluster (no card needed).
3. Database Access -> add a database user (username/password).
4. Network Access -> Add IP Address -> **Allow access from anywhere** (`0.0.0.0/0`) -- simplest for Vercel's dynamic IPs; tighten later if you want.
5. Database -> Connect -> Drivers -> copy the connection string (`mongodb+srv://...`).

Put it in `apps/web/.env`:
```
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/jeevanlink?retryWrites=true&w=majority
```

Then, from `apps/web`, create the collections on your new cluster:
```bash
npx prisma db push
```

## 2. Vercel Blob (document storage)

**[YOU]** -- easiest done once you've started the Vercel project (step 5), since Blob attaches to it directly:
1. In your Vercel project dashboard -> **Storage** tab -> Create Database -> **Blob**.
2. Vercel automatically injects `BLOB_READ_WRITE_TOKEN` into your deployed app's environment once attached -- nothing to copy for the deployed app itself.
3. For **local dev**, copy that same token from the Storage tab into `apps/web/.env`:
```
BLOB_READ_WRITE_TOKEN=...
```

## 3. Migrate your existing data

Your current SQLite data (demo users, seeded records) needs copying
over once. From `apps/web`, with `DATABASE_URL` above already set in
`.env`:

```bash
SQLITE_LEGACY_URL="file:D:/JeevanLink_working/apps/web/prisma/dev.db" npx tsx scripts/mongo-migration/migrate.ts
```

(Adjust the drive/path if your checkout lives somewhere else -- see
the comment at the top of `migrate.ts` for why it needs to be absolute.)

Note: this migrates database rows only. Any *existing* uploaded
document files (on local disk, pre-migration) aren't copied to Vercel
Blob by this script -- those particular old records will show
"Original unavailable" afterward (the app already handles that state
gracefully; several seeded test records already show it today for
other reasons). Anything uploaded after the cutover works normally.

**Test locally against the real Atlas + Blob setup now**, before
touching any hosting platform -- `npm run dev` from `apps/web`, log in,
click around. This is much easier to debug here than after deploying.

## 4. Render (jeeva + ocr-service)

**[YOU]**
1. Sign up / log in at [dashboard.render.com](https://dashboard.render.com), connect your GitHub account.
2. New -> Blueprint -> select this repo. Render reads `render.yaml` at the repo root and creates both services automatically.
3. For `jeevanlink-jeeva`, fill in the env vars it asks for (marked `sync: false` in the blueprint): `BHASHINI_ULCA_API_KEY` (your real key) and `JEEVA_FRONTEND_ORIGIN` (leave as `http://localhost:3000` for now -- you'll update this in step 6).
4. For `jeevanlink-ocr-service`, same for `OCR_FRONTEND_ORIGIN`.
5. Deploy. Once live, note both services' `.onrender.com` URLs.

Note: `ocr-service` needs Render's paid **Standard** plan (already set
in `render.yaml`) -- the free tier's 512MB RAM isn't enough to load the
TrOCR model. `jeeva` runs fine on the free tier.

## 5. Vercel (the Next.js app)

**[YOU]**
1. Sign up / log in at [vercel.com](https://vercel.com), connect GitHub.
2. New Project -> import this repo -> set the **Root Directory** to `apps/web` (this is a monorepo; jeeva/ocr-service aren't part of this deployment).
3. Add every env var from `apps/web/.env.example` in Project Settings -> Environment Variables, using your real values -- including `NEXT_PUBLIC_JEEVA_SERVICE_URL` and `HANDWRITING_OCR_URL` set to the real Render URLs from step 4. (`BLOB_READ_WRITE_TOKEN` gets set automatically once you attach Blob storage per step 2 -- no need to add it manually here.)
4. Deploy. Note the `.vercel.app` URL it gives you.

## 6. Close the loop: update CORS with the real Vercel URL

Now that you know the real Vercel URL, go back to Render and update:
- `jeevanlink-jeeva`'s `JEEVA_FRONTEND_ORIGIN` -> your Vercel URL
- `jeevanlink-ocr-service`'s `OCR_FRONTEND_ORIGIN` -> same

Both services will redeploy automatically when you save an env var change.

## What's already done in the codebase

- Prisma schema migrated from SQLite to MongoDB (`apps/web/prisma/schema.prisma`) -- validated against Prisma's MongoDB rules.
- Medical document storage moved from local disk to Vercel Blob (`apps/web/src/app/lib/documentStorage.ts`) -- Vercel's filesystem doesn't persist, so this was a hard blocker, not optional polish. Only ever fetches URLs on Vercel Blob's own domain (an SSRF guard, since Blob URLs are external rather than an internal key we fully control).
- `apps/web/scripts/mongo-migration/` -- the one-time data migration tooling (delete this folder once you've migrated).
- `render.yaml` at the repo root -- Render Blueprint for jeeva + ocr-service.
- `apps/web/.env.example` -- every env var the deployed app needs.
