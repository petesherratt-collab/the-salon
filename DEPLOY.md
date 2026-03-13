# Deploying The Salon to Vercel

This guide gets The Salon live on the web in about 15 minutes.
No coding required beyond copying and pasting.

---

## What you'll need
- A free GitHub account → https://github.com
- A free Vercel account → https://vercel.com
- Your Anthropic API key → https://console.anthropic.com

---

## Step 1 — Create a GitHub repository

1. Go to https://github.com/new
2. Name it: `the-salon`
3. Set it to **Private** (recommended)
4. Click **Create repository**
5. You'll see an empty repo page — leave it open

---

## Step 2 — Upload your files

In your new GitHub repo, click **uploading an existing file** (or "Add file → Upload files")

Upload these files in this exact folder structure:

```
the-salon/
├── vercel.json
├── api/
│   └── chat.js
└── public/
    └── index.html
```

To create the folders on GitHub:
- Click "Add file → Upload files"
- Drag the files in, but type their paths manually:
  - `api/chat.js`
  - `public/index.html`
  - `vercel.json` (root level)

Then click **Commit changes**.

---

## Step 3 — Deploy to Vercel

1. Go to https://vercel.com and sign in
2. Click **Add New → Project**
3. Click **Import** next to your `the-salon` repo
   (You may need to click "Add GitHub Account" first)
4. On the configuration screen, leave everything as default
5. Click **Deploy**

Vercel will build and deploy in about 60 seconds.

---

## Step 4 — Add your API key (IMPORTANT)

Your site is deployed but conversations won't work yet.
You need to add your Anthropic API key as a secret:

1. In Vercel, go to your project dashboard
2. Click **Settings** (top nav)
3. Click **Environment Variables** (left sidebar)
4. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Anthropic API key (starts with `sk-ant-...`)
   - **Environment:** Production (and Preview if you want)
5. Click **Save**
6. Go back to **Deployments** and click **Redeploy** on your latest deployment

---

## Step 5 — Get your URL

After redeployment, Vercel gives you a live URL like:
`https://the-salon-yourname.vercel.app`

You can also set a custom domain in Settings → Domains if you own one.

---

## Costs

- **Vercel hosting:** Free (Hobby plan is generous)
- **Anthropic API:** ~$0.003–0.006 per message exchange
  - 500 conversations/month ≈ $1–3
  - Add a spending limit at https://console.anthropic.com to stay safe

---

## Optional: Add rate limiting

If you're worried about unexpected API costs from heavy use, 
the simplest protection is adding a spending cap in the Anthropic console:
https://console.anthropic.com → Settings → Limits

---

## Troubleshooting

**Conversations don't work / "Server configuration error"**
→ Check that `ANTHROPIC_API_KEY` is set in Vercel environment variables
→ Make sure you redeployed after adding the key

**404 on /api/chat**
→ Check that `api/chat.js` is in the right folder in your GitHub repo
→ Check `vercel.json` is at the root level

**Blank page**
→ Check that `public/index.html` exists and is in the `public/` folder
