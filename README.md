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
