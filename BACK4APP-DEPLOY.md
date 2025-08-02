# 🚀 Deploy to Back4app with Docker

## Quick Setup (10 minutes)

### Prerequisites
1. **Back4app Account**: Sign up at [back4app.com](https://back4app.com)
2. **Git Repository**: Your code needs to be in a Git repo
3. **Docker Files**: All files are already included in this project

### Step 1: Prepare Your Repository

1. **Initialize Git** (if not already done):
   ```bash
   cd "F:\Checklist Web App"
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub/GitLab**:
   - Create a new repository on GitHub
   - Follow the instructions to push your code

### Step 2: Deploy to Back4app

1. **Login to Back4app**:
   - Go to [back4app.com](https://back4app.com)
   - Sign in to your account

2. **Create New App**:
   - Click "Build new app"
   - Choose "Container as a Service"
   - Select "Import from Git"

3. **Connect Repository**:
   - Connect your GitHub/GitLab account
   - Select your checklist app repository
   - Choose the main/master branch

4. **Configure Build**:
   - **Build Method**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile` (default)
   - **Port**: `8080`
   - **Health Check**: `/api/health`

5. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=8080
   DATA_DIR=/app/data
   ```

6. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete (~3-5 minutes)

### Step 3: Configure Custom Domain (Optional)

1. **Get Your URL**:
   - Back4app will provide a URL like `https://your-app.back4app.io`

2. **Test the App**:
   - Visit your URL
   - Test saving/loading checklists
   - Verify PWA installation works

3. **Custom Domain** (Optional):
   - In Back4app dashboard, go to "Custom Domain"
   - Add your domain and configure DNS

## Configuration

### Environment Variables
Set these in Back4app dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Run in production mode |
| `PORT` | `8080` | App port (required by Back4app) |
| `DATA_DIR` | `/app/data` | Where to store JSON files |

### Volume Configuration
- **Path**: `/app/data`
- **Size**: 1GB (sufficient for thousands of checklists)
- **Backup**: Enabled (recommended)

## How It Works

### Architecture
```
Internet → Back4app Load Balancer → Your Docker Container
                                   ├── Static Files (PWA)
                                   ├── API Server (/api/*)
                                   └── Data Storage (/app/data)
```

### File Structure in Container
```
/app/
├── index.html          # PWA main page
├── app.js              # React application
├── styles.css          # Styling
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── simple-api.js       # API routes
├── server.js           # Main server (auto-generated)
├── icons/              # PWA icons
└── data/               # Persistent storage
    ├── user1-lists.json
    ├── family-grocery.json
    └── ...
```

## Features Enabled

### ✅ What Works
- **Complete PWA**: Install on any device
- **Cloud Sync**: Save/load with unique IDs
- **Local Backup**: Export/import functionality
- **Drag & Drop**: Reorder lists and items
- **Notifications**: Browser notifications for reminders
- **Offline Mode**: Works without internet
- **Persistent Data**: Volume storage survives restarts
- **Auto-scaling**: Handles traffic spikes
- **SSL**: HTTPS by default

### 🔒 Security
- **Passphrase Protection**: Only you can save data
- **HTTPS**: All traffic encrypted
- **No User Data**: No personal info required
- **Data Isolation**: Each unique ID is separate

## Costs

### Back4app Pricing
- **Free Tier**: 1 container, 1GB storage, 1GB bandwidth
- **Paid Plans**: Start at $5/month for more resources
- **Perfect for**: Personal/family use

### Resource Usage
- **RAM**: ~100MB (very lightweight)
- **Storage**: <1MB per 100 checklists
- **CPU**: Minimal (only during API calls)

## Troubleshooting

### Build Fails
- Check that all files are committed to Git
- Verify Dockerfile is in repository root
- Ensure package.json is valid

### App Won't Start
- Check logs in Back4app dashboard
- Verify PORT environment variable is set to 8080
- Ensure health check endpoint `/api/health` is accessible

### Data Not Persisting
- Verify volume is mounted at `/app/data`
- Check DATA_DIR environment variable
- Restart container if needed

### Can't Save Data
- Verify API endpoints are working: visit `/api/health`
- Check if passphrase is correct
- Ensure unique ID format is valid (alphanumeric, hyphens, underscores)

## Local Testing

### Test with Docker
```bash
# Build the image
docker build -t checklist-app .

# Run locally
docker run -p 8080:8080 -v checklist-data:/app/data checklist-app

# Or use docker-compose
docker-compose up
```

### Test without Docker
```bash
# Install dependencies
npm install

# Run the API only
npm run api-only

# In another terminal, serve static files
python -m http.server 8000
```

## Maintenance

### Updates
1. Commit changes to Git
2. Push to repository
3. Back4app auto-deploys new version

### Backups
- **Automatic**: Back4app backs up your volume
- **Manual**: Use the app's export feature
- **Database**: Download JSON files via Back4app dashboard

### Monitoring
- **Logs**: Available in Back4app dashboard
- **Health**: Monitor `/api/health` endpoint
- **Usage**: Track in Back4app analytics

## Migration

### From Other Platforms
1. Export data using the app's backup feature
2. Deploy to Back4app following this guide
3. Import data using the app's restore feature

### To Other Platforms
1. Use the export feature to backup data
2. Deploy Dockerfile to any Docker platform
3. Import data in new deployment

The app is fully portable thanks to Docker! 🐳