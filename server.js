const express = require('express');
const fetch = require('node-fetch');
const basicAuth = require('express-basic-auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment variables
const config = {
    printagoApiKey: process.env.PRINTAGO_API_KEY,
    storeId: process.env.STORE_ID,
    printagoBaseUrl: process.env.PRINTAGO_BASE_URL || 'https://api.printago.io',
    wrapperUsername: process.env.WRAPPER_USERNAME || 'client',
    wrapperPassword: process.env.WRAPPER_PASSWORD,
    allowedEndpoints: (process.env.ALLOWED_ENDPOINTS || 'POST /v1/storage/signed-upload-urls,POST /v1/parts,POST /v1/builds').split(',')
};

// Validate required configuration
if (!config.printagoApiKey || !config.storeId || !config.wrapperPassword) {
    console.error('Missing required environment variables:');
    console.error('- PRINTAGO_API_KEY');
    console.error('- STORE_ID'); 
    console.error('- WRAPPER_PASSWORD');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb', type: 'application/octet-stream' }));

// Basic Authentication
app.use('/v1', basicAuth({
    users: { [config.wrapperUsername]: config.wrapperPassword },
    challenge: true,
    realm: 'Printago API Wrapper'
}));

// Helper function to check if endpoint is allowed
function isEndpointAllowed(method, path) {
    const endpoint = `${method.toUpperCase()} ${path}`;
    return config.allowedEndpoints.some(allowed => {
        const trimmedAllowed = allowed.trim();
        return endpoint === trimmedAllowed || path === trimmedAllowed;
    });
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        allowedEndpoints: config.allowedEndpoints,
        timestamp: new Date().toISOString()
    });
});

// Proxy middleware for Printago API
app.all('/v1/*', async (req, res) => {
    try {
        const path = req.path;
        const method = req.method;

        // Check if endpoint is allowed
        if (!isEndpointAllowed(method, path)) {
            return res.status(403).json({ 
                error: 'Endpoint not allowed',
                endpoint: `${method} ${path}`,
                allowedEndpoints: config.allowedEndpoints
            });
        }

        // Prepare headers for Printago API
        const headers = {
            'Content-Type': req.headers['content-type'] || 'application/json',
            'Authorization': `ApiKey ${config.printagoApiKey}`,
            'x-printago-storeid': config.storeId
        };

        // Handle different content types
        let body;
        if (req.headers['content-type'] === 'application/octet-stream' || Buffer.isBuffer(req.body)) {
            body = req.body;
        } else if (typeof req.body === 'object') {
            body = JSON.stringify(req.body);
        } else {
            body = req.body;
        }

        // Make request to Printago API
        const printagoUrl = `${config.printagoBaseUrl}${path}`;
        console.log(`Proxying ${method} ${path} to ${printagoUrl}`);

        const response = await fetch(printagoUrl, {
            method: method,
            headers: headers,
            body: method !== 'GET' ? body : undefined
        });

        // Handle file upload responses (might not be JSON)
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // Forward the response
        res.status(response.status).json(responseData);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

// Handle file uploads to signed URLs (these go directly to cloud storage, not Printago API)
app.put('*', async (req, res) => {
    try {
        // This handles uploads to signed URLs (like S3, etc.)
        // We need to proxy these as well since they might be cross-origin
        
        const targetUrl = req.query.url || req.headers['x-target-url'];
        if (!targetUrl) {
            return res.status(400).json({ error: 'No target URL provided for file upload' });
        }

        console.log(`Proxying file upload to: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'PUT',
            body: req.body,
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/octet-stream'
            }
        });

        res.status(response.status).send(await response.text());

    } catch (error) {
        console.error('File upload proxy error:', error);
        res.status(500).json({ 
            error: 'File upload failed', 
            message: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Printago API Wrapper running on port ${PORT}`);
    console.log(`Allowed endpoints: ${config.allowedEndpoints.join(', ')}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});