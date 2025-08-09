# Printago API Wrapper - Deployment Guide

## Quick Deploy to Railway (For Your Client)

### Step 1: Deploy to Railway
## Deploy to Railway

1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Search for `https://github.com/ThinkBuildMake/printago-wrapper` 
4. Click Deploy
5. Add environment variables (see below)

### Step 2: Configure Environment Variables
In the Railway dashboard, add these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PRINTAGO_API_KEY` | Your Printago API key | `pk_live_123abc...` |
| `STORE_ID` | Your Printago store ID | `store_123` |
| `WRAPPER_PASSWORD` | Password for API access (you choose this) | `mySecurePassword123` |
| `WRAPPER_USERNAME` | Username for API access (optional) | `client` (default) |
| `ALLOWED_ENDPOINTS` | Comma-separated list of allowed endpoints | See below |

### Step 3: Configure Allowed Endpoints
Set `ALLOWED_ENDPOINTS` to a comma-separated list like:
```
POST /v1/storage/signed-upload-urls,POST /v1/parts,POST /v1/builds
```

### Step 4: Get Your API URL
After deployment, click on the app and go to Settings. Under Networking, click Generate Domain.
Railway will give you a URL like:
```
https://your-app-name.railway.app
```

Share this URL and the `WRAPPER_PASSWORD` with your API client.

## Testing Your Deployment

### Health Check
Visit: `https://your-app-name.railway.app/health`

Should return:
```json
{
  "status": "healthy",
  "allowedEndpoints": ["POST /v1/parts", "POST /v1/builds", ...],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Test API Call
```bash
curl -X POST https://your-app-name.railway.app/v1/parts \
  -u "client:yourPassword" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "description": "test part"}'
```

## Security Notes

1. **Environment Variables**: Never commit API keys to git
2. **HTTPS**: Railway provides HTTPS by default
3. **Basic Auth**: All API endpoints require username/password
4. **Endpoint Filtering**: Only allowed endpoints work
5. **CORS**: Enabled for web applications

## Troubleshooting

### Common Issues:
1. **503 Error**: Check environment variables are set
2. **403 Forbidden**: Check endpoint is in `ALLOWED_ENDPOINTS`  
3. **401 Unauthorized**: Check username/password in your API calls
