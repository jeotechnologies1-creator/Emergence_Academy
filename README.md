# Emergence Academy

Emergence Academy is a static web dashboard powered by Supabase auth and database APIs.

## Local Run

Because this project is static HTML/JS, run it with any local server:

```bash
npx serve .
```

Open `http://localhost:3000/login.html`.

## Runtime Config (Production)

The app reads config from `window.__EMERGENCE_CONFIG__` before loading [assets/js/config.js](assets/js/config.js).

Add this script block in your HTML pages above the `config.js` script tag:

```html
<script>
	window.__EMERGENCE_CONFIG__ = {
		SUPABASE: {
			URL: "https://your-project.supabase.co",
			ANON_KEY: "your-public-anon-key"
		},
		DEBUG: false
	};
</script>
```

If no override is provided, the default values in [assets/js/config.js](assets/js/config.js) are used.

## Vercel Deploy

This repository includes [vercel.json](vercel.json) with cache headers for HTML and assets.

Deploy:

1. Import the repository into Vercel.
2. Set Framework Preset to `Other`.
3. Build command: leave empty.
4. Output directory: leave empty (root static deployment).
5. Ensure your production Supabase values are injected via `window.__EMERGENCE_CONFIG__` in deployed pages.

## Test Suite

Run the regression suite:

```bash
node --test tests/*.js
```

All current tests pass after the latest stabilization pass.

## Agora live classes

Apply the Supabase migrations, then deploy `live-class-options`,
`schedule-live-class`, `join-live-class`, `agora-create-room`, and
`agora-join-room`. Configure `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` as
Supabase Edge Function secrets. Put only the App ID in
`assets/js/config.js` under `CONFIG.AGORA.APP_ID`; never expose the App
Certificate in browser code. Scheduling a class automatically authorizes and
notifies every student enrolled in its selected class. A student's first join
of a live session records attendance as present.

## AI Assistant

The AI Assistant is available to authenticated teachers and students through
the `ai-chat` Supabase Edge Function. Deploy the function and configure its
server-side OpenAI key. Do not add this key to browser JavaScript or Vercel
environment variables that are exposed to the client.

```bash
supabase functions deploy ai-chat --no-verify-jwt
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

Optionally set `OPENAI_MODEL` to a model available to your OpenAI project; the
function defaults to `gpt-5`.
