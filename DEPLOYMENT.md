# 🚀 Deploy Your Checklist Sync API

## Quick Setup (5 minutes)

### Option 1: Deploy to Vercel (Recommended - Free)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   cd "F:\Checklist Web App"
   vercel
   ```

3. **Follow prompts**:
   - Set up and deploy? `Y`
   - Which scope? Choose your account
   - Link to existing project? `N`
   - Project name: `checklist-sync-api`
   - Directory: `./` (current)

4. **Get your URL**: 
   - Vercel will give you a URL like `https://checklist-sync-api-xxx.vercel.app`

5. **Update app.js**:
   - Replace `https://your-checklist-api.vercel.app/api` with your actual URL

### Option 2: Deploy to Railway (Also Free)

1. **Sign up at railway.app**
2. **Connect GitHub** and push this folder to a repo
3. **Deploy from GitHub** - Railway auto-detects Node.js
4. **Copy the generated URL**

### Option 3: Local Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run locally**:
   ```bash
   npm start
   ```

3. **Update app.js**:
   ```javascript
   const API_BASE = 'http://localhost:3000/api';
   ```

## How It Works

### 🔐 Security Model
- **Passphrase Protection**: Save functionality requires a specific passphrase (configured by you)
- **Unique IDs**: Each user picks their own unique identifier  
- **No User Accounts**: Simple file-based storage
- **Local + Cloud**: Data stays in local storage AND syncs to cloud

### 📱 Usage Flow
1. **Save**: Enter unique ID + passphrase → Data saved to cloud
2. **Load**: Enter same unique ID on any device → Data loads
3. **Sync**: Works across all your devices using the same ID

### 🛡️ Privacy Features
- **No personal info required** - just pick a unique ID
- **Data encrypted in transit** (HTTPS)
- **No analytics or tracking**
- **You control the server** (you deploy it)

## Example Usage

1. **On Computer**: Save with ID `john-groceries-2024`
2. **On Phone**: Load with ID `john-groceries-2024`
3. **On Tablet**: Load with ID `john-groceries-2024`

All devices now have the same checklists!

## File Structure

```
simple-api.js     # Main API server
package.json      # Dependencies
vercel.json       # Vercel deployment config
data/            # Created automatically - stores your data
├── john-groceries-2024.json
├── mary-todos-2024.json
└── team-project-lists.json
```

## Customization

### Change the Passphrase
In `app.js`, line ~X:
```javascript
const REQUIRED_PASSPHRASE = 'your-new-secret-phrase';
```

### Add More Security
- Change ID validation in `simple-api.js`
- Add rate limiting
- Add basic auth for admin functions

## Troubleshooting

### "Network Error"
- Check if your API URL is correct
- Verify the API is deployed and running
- Check browser console for detailed errors

### "Invalid Passphrase"  
- Make sure you're using the exact passphrase configured in the app
- Check the `REQUIRED_PASSPHRASE` value in `app.js`
- No extra spaces or different capitalization

### "ID Already Exists"
- Choose a different unique ID
- Or you're loading someone else's data (if IDs collide)

## Cost
- **Vercel**: Free forever for personal use
- **Railway**: Free tier with limits, then $5/month
- **Self-hosted**: Whatever your server costs

The API is extremely lightweight - hundreds of users could share a free Vercel instance!