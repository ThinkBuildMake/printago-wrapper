export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();

        // CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
        }

        const corsHeaders = buildCorsHeaders(request);

        // Health check (no auth)
        if (url.pathname === '/health') {
            const allowed = getAllowedEndpoints(env);
            return json({ status: 'healthy', allowedEndpoints: allowed, timestamp: new Date().toISOString() }, 200, corsHeaders);
        }

        // Signed upload proxy (PUT not targeting /v1/*)
        if (method === 'PUT' && !url.pathname.startsWith('/v1/')) {
            try {
                const targetUrl = url.searchParams.get('url') || request.headers.get('x-target-url');
                if (!targetUrl) {
                    return json({ error: 'No target URL provided for file upload' }, 400, corsHeaders);
                }

                const uploadHeaders = new Headers();
                const contentType = request.headers.get('content-type') || 'application/octet-stream';
                uploadHeaders.set('content-type', contentType);

                const response = await fetch(targetUrl, {
                    method: 'PUT',
                    headers: uploadHeaders,
                    body: request.body
                });

                // Pass through body and status, add CORS headers
                return passthrough(response, corsHeaders);
            } catch (err) {
                return json({ error: 'File upload failed', message: err instanceof Error ? err.message : String(err) }, 500, corsHeaders);
            }
        }

        // Printago API proxy under /v1/* with basic auth
        if (url.pathname.startsWith('/v1/')) {
            const missing = missingRequired(env);
            if (missing.length > 0) {
                return json({ error: 'Missing required environment variables', missing }, 500, corsHeaders);
            }

            const { ok: authOk, problem } = checkBasicAuth(request, env);
            if (!authOk) {
                const headers = new Headers(corsHeaders);
                headers.set('WWW-Authenticate', 'Basic realm="Printago API Wrapper"');
                return json({ error: problem || 'Unauthorized' }, 401, headers);
            }

            const allowed = getAllowedEndpoints(env);
            if (!isEndpointAllowed(method, url.pathname, allowed)) {
                return json({ error: 'Endpoint not allowed', endpoint: `${method} ${url.pathname}`, allowedEndpoints: allowed }, 403, corsHeaders);
            }

            try {
                const targetUrl = (env.PRINTAGO_BASE_URL || 'https://api.printago.io') + url.pathname + (url.search || '');

                const headers = new Headers();
                const contentType = request.headers.get('content-type') || 'application/json';
                headers.set('content-type', contentType);
                headers.set('authorization', `ApiKey ${env.PRINTAGO_API_KEY}`);
                headers.set('x-printago-storeid', env.STORE_ID);

                const init = {
                    method,
                    headers,
                    body: method === 'GET' || method === 'HEAD' ? undefined : request.body
                };

                const response = await fetch(targetUrl, init);
                return passthrough(response, corsHeaders);
            } catch (err) {
                return json({ error: 'Internal server error', message: err instanceof Error ? err.message : String(err) }, 500, corsHeaders);
            }
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
};

function buildCorsHeaders(request) {
    const origin = request.headers.get('origin') || '*';
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-Url');
    headers.set('Access-Control-Max-Age', '86400');
    return headers;
}

function getAllowedEndpoints(env) {
    const raw = env.ALLOWED_ENDPOINTS || 'POST /v1/storage/signed-upload-urls,POST /v1/parts,POST /v1/builds';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isEndpointAllowed(method, path, allowedList) {
    const endpoint = `${method} ${path}`;
    return allowedList.some(allowed => allowed === endpoint || allowed === path);
}

function checkBasicAuth(request, env) {
    const header = request.headers.get('authorization') || '';
    if (!header.startsWith('Basic ')) {
        return { ok: false, problem: 'Missing Basic auth header' };
    }
    try {
        const decoded = atob(header.slice(6));
        const sep = decoded.indexOf(':');
        const user = decoded.slice(0, sep);
        const pass = decoded.slice(sep + 1);
        const expectedUser = env.WRAPPER_USERNAME || 'client';
        if (user !== expectedUser || pass !== env.WRAPPER_PASSWORD) {
            return { ok: false, problem: 'Invalid credentials' };
        }
        return { ok: true };
    } catch (_e) {
        return { ok: false, problem: 'Invalid Basic auth encoding' };
    }
}

function missingRequired(env) {
    const miss = [];
    if (!env.PRINTAGO_API_KEY) miss.push('PRINTAGO_API_KEY');
    if (!env.STORE_ID) miss.push('STORE_ID');
    if (!env.WRAPPER_PASSWORD) miss.push('WRAPPER_PASSWORD');
    return miss;
}

function json(obj, status = 200, extraHeaders) {
    const headers = new Headers(extraHeaders || {});
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(obj), { status, headers });
}

function passthrough(response, extraHeaders) {
    const headers = new Headers(response.headers);
    if (extraHeaders) {
        for (const [k, v] of extraHeaders.entries()) headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers });
} 