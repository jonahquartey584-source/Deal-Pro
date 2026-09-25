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

## Tutorial video

`assets/deal-pro-tutorial.mp4` is a recorded walkthrough of the site: a
headless browser clicks through each feature in time with the narration in
`scripts/tutorial-narration.mp3` (ElevenLabs, "George" voice). Sign-in and the
`/api` calls use demo data, so no account or API key is needed. To rebuild it:

```sh
npm i -g playwright geist && pip3 install imageio-ffmpeg
node scripts/record_walkthrough.mjs
```

If you change the narration, update the timings in the walkthrough section of
`scripts/record_walkthrough.mjs` to match. `PREVIEW=1` writes one frame a second
to `.tutorial-build/frames` for a quick check without making the video.

Then bump the `?v=` number on the tutorial video and poster in `index.html`
so browsers load the new version, and redeploy.
