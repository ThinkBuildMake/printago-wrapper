## Printago API Wrapper (Cloudflare Workers)

A simple, secure proxy in front of the Printago API that you can deploy on Cloudflare Workers. It adds:
- **Basic Auth** protection to your API
- **Allow-listing** of specific endpoints
- **CORS** so it can be safely called from browsers
- A **/health** endpoint to verify it’s running
- A **signed upload proxy** for PUT-ing files to cloud storage signed URLs

### What you’ll need
- **Cloudflare account** (free is fine)
- **Wrangler CLI** installed on your computer
- Your Printago credentials and IDs:
  - `PRINTAGO_API_KEY`
  - `STORE_ID`
  - A password you choose for the wrapper: `WRAPPER_PASSWORD`

### Pricing (simple explanation)
- Cloudflare Workers includes a free CPU time allowance: **10,000,000 CPU milliseconds per month**.
- If one request to this wrapper uses around **2,000 ms** of CPU time, that’s roughly **5,000 free requests per month**.
- Pricing can change. For the latest details, check Cloudflare’s pricing page.

### Install Wrangler CLI
- Install with npm:
```bash
npm i -g wrangler
```
- Log into your Cloudflare account from the terminal:
```bash
wrangler login
```

### 1) Get the code
```bash
git clone <your-fork-or-this-repo-url>
cd printago-wrapper
```

### 2) Configure basic settings (optional)
The file `wrangler.toml` already includes sensible defaults:
- `PRINTAGO_BASE_URL` defaults to `https://api.printago.io`
- `WRAPPER_USERNAME` defaults to `client`
- `ALLOWED_ENDPOINTS` defaults to these three endpoints:
  - `POST /v1/storage/signed-upload-urls`
  - `POST /v1/parts`
  - `POST /v1/builds`

You can adjust any of these in `wrangler.toml`. To allow more endpoints, add them to `ALLOWED_ENDPOINTS` as a comma‑separated list using the format `METHOD /path`.

### 3) Add your secrets (never commit these)
Run these commands and paste each secret when prompted:
```bash
wrangler secret put PRINTAGO_API_KEY
wrangler secret put STORE_ID
wrangler secret put WRAPPER_PASSWORD
```
- `WRAPPER_USERNAME` is not a secret and can remain in `wrangler.toml` (default: `client`).

### 4) Try it locally (optional)
```bash
wrangler dev
```
- Open the printed local URL and visit `/health` to confirm it’s running.

### 5) Deploy to Cloudflare
```bash
wrangler deploy
```
- Wrangler will print the public URL (for example: `https://printago-wrapper.<your-subdomain>.workers.dev`).
- Visit `/health` on that URL to verify it’s live.

### How to use it
- **Health check (no auth required):**
```bash
curl https://<your-worker-url>/health
```

- **Authenticated API call to Printago (Basic Auth):**
  - Username: value in `WRAPPER_USERNAME` (default: `client`)
  - Password: your `WRAPPER_PASSWORD` secret
```bash
curl -u client:YOUR_WRAPPER_PASSWORD \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"name":"example"}' \
  https://<your-worker-url>/v1/parts
```

- **Signed file upload proxy (PUT to a signed URL):**
  - Provide the signed URL via the `url` query parameter or `x-target-url` header.
```bash
curl -X PUT \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/path/to/your/file.bin \
  "https://<your-worker-url>/?url=https%3A%2F%2Fexample-signed-url"
```

### What’s included
- `src/worker.js` — Cloudflare Worker code
  - Basic Auth for all `/v1/*` routes
  - Allows only endpoints in `ALLOWED_ENDPOINTS`
  - Proxies to Printago with required headers
  - Passes responses through (status/body/headers)
  - CORS enabled for browser use
  - `/health` endpoint
  - PUT upload proxy for signed URLs (outside `/v1/*`)
- `wrangler.toml` — configuration and default variables

### Environment variables
- Secrets (set via `wrangler secret put`):
  - `PRINTAGO_API_KEY` — Your Printago API key
  - `STORE_ID` — Your Printago Store ID
  - `WRAPPER_PASSWORD` — Password required for Basic Auth
- Vars (in `wrangler.toml` or dashboard):
  - `WRAPPER_USERNAME` — Basic Auth username (default: `client`)
  - `PRINTAGO_BASE_URL` — Printago API base URL (default: `https://api.printago.io`)
  - `ALLOWED_ENDPOINTS` — Comma-separated allow list, e.g. `POST /v1/storage/signed-upload-urls,POST /v1/parts`

### Tips and troubleshooting
- **401 Unauthorized**: Check username/password in your API call.
- **403 Endpoint not allowed**: Add the method+path to `ALLOWED_ENDPOINTS` and redeploy.
- **Missing environment variables**: Ensure all three secrets are set.
- **Browser apps**: CORS is enabled; the Worker responds with the request’s Origin.

### Updating
- Edit `src/worker.js` or `wrangler.toml`
- Redeploy with:
```bash
wrangler deploy
```

### Removing
- Remove from the Cloudflare dashboard or via:
```bash
wrangler delete
```
