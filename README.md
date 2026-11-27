# Luma Studio · 影调工作台

A browser based photographic color workbench. Visitors can upload a photo, inspect the recommendation, preview and download the graded image or a 33³ sRGB `.cube` LUT, then request an AI interpretation through the server side Pikso edit endpoint. The filter library includes paired original/graded photographs; inspiration boards are stored locally in the visitor's browser.

## Requirements

- Node.js 22.13 or newer
- `npm ci`

## Local development

```bash
npm ci
npm run dev
```

The site runs at the URL printed by Vite. To exercise AI generation in a local production Worker preview, set the `PIKSO_API_KEY` runtime secret and run `npm run build && npm start`. The key must be server side. It is never included in this repository, the browser bundle, an archive, or sample files.

## Deploying with Sites

This repository includes the Sites source manifest at `.openai/hosting.json`, the Worker entry at `worker/index.ts`, and the full source/assets needed for a hosted build. Connect the repository to the existing Sites project, set the server side `PIKSO_API_KEY` secret in its environment, build, save a version, and publish it. Keep the project ID in the manifest when updating the existing site. The user facing website is public; no visitor login is required during this test phase. Each AI generation uses the project owner's Pikso account and consumes its quota.

The application expects `POST /api/generate` and `GET /api/status` to route to the Worker. Requests are capped at 5 MB per submitted JPEG and a single generated image; a same origin check rejects ordinary cross site browser submissions. Public billing should be monitored and a provider side spend cap or rate limit added before broad promotion.

## Project map

- `app/page.tsx`: upload, recommendation, LUT comparison and generation UI
- `app/film.ts`, `app/pixels.ts`: named looks and matching sRGB LUT transform
- `app/luts/`: filter catalog, matching, inspiration data and sample descriptions
- `app/look-gallery.tsx`: filter sample cards and interactive comparisons
- `public/look-examples/`: original, graded and matched card thumbnails
- `worker/images.ts`: authenticated server to Pikso proxy; the visitor does not receive the key
- `scripts/render-look-examples.cjs`: rebuild graded assets from source photos

To rebuild all library comparisons after changing LUT recipes:

```bash
node scripts/render-look-examples.cjs ''
```

For a single recipe, append its ID, for example `node scripts/render-look-examples.cjs '' neon-diary`.

The renderer also refreshes `app/luts/sample-tones.json`. Professional mode classifies the graded teaching samples using display luma: the median determines the main brightness, the P95 minus P5 range describes tonal span, and a separate two-peak check identifies full long tones. The render script checks that all ten representative samples match their categories. The live comparison and LUT export use the same grading transform as the asset renderer.

## Git

The public GitHub repository `vemodalen-x/vemo-app` checks the published Sites release every five minutes. The build creates a source manifest for that workflow. The workflow verifies the bytes of the source and sample assets before committing to `main`. It stops if a mirrored file was independently edited in GitHub. Use branches for GitHub edits, and apply intended production changes in the Sites source before publishing them.

Unpack the source archive and initialize a repository, or copy its contents into an existing one:

```bash
git init
git add .
git commit -m "Initial Luma Studio source"
```

Generated build folders and local environment files are excluded by `.gitignore`. Never commit the Pikso credential. Preserve the photo asset attribution/usage rights for any replacement imagery.
