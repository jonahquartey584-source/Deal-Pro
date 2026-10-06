# Deal Pro

Find UK rent-to-rent and serviced accommodation deals and analyse them with AI.

## Deployment

This project is deployed on Netlify.

- **Netlify project dashboard:** https://app.netlify.com/projects/deal-pro-app/overview
- **Live site:** https://usedealpro.com (also https://deal-pro-app.netlify.app, which redirects)

Deploy from this folder with the Netlify CLI:

```sh
npm install
netlify deploy --prod
```

## Run it on your own computer

`npm run local` runs a copy of the whole site, with the same pages and the same `/api`
functions, on http://localhost:8888. It needs no Netlify account and spends no Netlify credits.

```sh
npm install
cp .env.example .env     # then put your own OpenAI key in OPENAI_API_KEY
npm run local
```

- You're signed in automatically as the admin (`LOCAL_USER_EMAIL` in `.env` changes who).
- Accounts, deals, the Deal Community and saved searches are kept as plain files in
  `.local-data/`, separate from the live site. Delete that folder to start fresh.
- The AI searches and analyses are billed to your OpenAI account, not Netlify.
- Stripe billing, the refunds page and the webhook are the live site's: they need
  `STRIPE_SECRET_KEY` and so on in `.env` if you want them.
- Edit `index.html` or anything under `netlify/` and restart to pick it up.

## Tutorial videos

Two videos are recorded walkthroughs of the site: a headless browser clicks
through each feature in time with an ElevenLabs narration ("George" voice).
Sign-in and the `/api` calls use demo data, so no account or API key is needed.

| Video | Narration | Script |
| --- | --- | --- |
| `assets/deal-pro-tutorial.mp4` (home page) | `scripts/tutorial-narration.mp3` | `scripts/record_walkthrough.mjs` |
| `assets/deal-community-tutorial.mp4` (Deal Community page) | `scripts/community-narration.mp3` | `scripts/record_community.mjs` |

```sh
npm i -g playwright geist && pip3 install imageio-ffmpeg
node scripts/record_walkthrough.mjs
node scripts/record_community.mjs
```

The shared recorder is `scripts/walkthrough/lib.mjs`. If you change a narration,
update the timings in that video's script to match. `PREVIEW=1` writes one frame
a second to `.tutorial-build/frames` for a quick check without making the video.

Then bump the `?v=` number on the tutorial video and poster in `index.html`
so browsers load the new version, and redeploy.
