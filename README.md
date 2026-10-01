# PhotoMotion.ai v2

Updated English-language landing page + creator interface for the PhotoMotion.ai project.

## Added in v2
- New modern landing page inspired by the approved PhotoMotion.ai concept
- Image upload + preview
- Social platform selector
- "Create for All Platforms" flow
- Motion style, duration, camera and motion-strength controls
- Prompt input
- Ready-to-use creator templates
- 7 free-generation counter in the demo UI
- Pricing section
- Responsive mobile layout
- Backend fields for style, camera, motion, duration, platforms and template
- Static frontend served by the Express backend

## Important
The real AI video generation provider is NOT connected yet. The backend currently creates a queued request and stores it in demo memory. A provider API, database, authentication, payments, object storage, job queue/webhooks, rate limiting and production safety checks still need to be connected before public launch.

## Run
1. Install Node.js.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.
