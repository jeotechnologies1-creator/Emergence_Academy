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
