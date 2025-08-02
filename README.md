# Checklist PWA

A powerful, mobile-friendly checklist application with reminders and notifications. Designed as a Progressive Web App (PWA) that works offline and can be installed on your device.

## Features

✅ **Multiple Named Checklists** - Create and manage multiple checklists
✅ **Rich Checklist Items** - Title, notes, due dates, and reminders
✅ **Smart Reminders** - Due date notifications with repeat settings
✅ **Auto-dismiss** - Automatically archive overdue items
✅ **Archive System** - Track completed items with timestamps
✅ **Dark/Light Theme** - Toggle between themes, preference saved
✅ **PWA Support** - Install as app, works offline
✅ **Chrome Notifications** - Browser notifications for reminders
✅ **Mobile Optimized** - Touch-friendly UI, works great on Galaxy S24
✅ **Local Storage** - All data stored locally in IndexedDB

## Quick Start

1. **Generate Icons** (Required for PWA):
   - Open `generate-icons.html` in Chrome
   - Click "Generate All Icons" to download icon files
   - Save all downloaded icons to the `icons/` folder

2. **Serve the Application**:
   ```bash
   # Using Python (if installed)
   python -m http.server 8000
   
   # Using Node.js (if installed)
   npx http-server
   
   # Using any local server of your choice
   ```

3. **Access the App**:
   - Open `http://localhost:8000` in Chrome
   - Grant notification permissions when prompted

4. **Install as PWA**:
   - Click the install button in Chrome's address bar
   - Or use Chrome menu → "Install Checklist App"

## Usage Guide

### Creating Checklists
1. Click "New Checklist" button
2. Enter a name for your checklist
3. Click "Create Checklist"

### Adding Items
1. Click "Add Item" on any checklist
2. Fill in the details:
   - **Title**: Required item description
   - **Notes**: Optional additional details
   - **Due Date**: When the item should be completed
   - **Repeat**: None, Daily, Weekly, or Custom interval
   - **Reminder Repeats**: How many reminder notifications to send
   - **Auto-dismiss**: Minutes after due time to auto-archive if not completed

### Managing Items
- **Check off**: Click the checkbox to mark complete (moves to archive)
- **Edit**: Click the pencil icon to modify
- **Delete**: Click the trash icon to remove

### Notifications
- Grant notification permission when prompted
- Notifications appear at due time
- Notifications repeat based on your settings
- Click notification to open the app

### Archive
- Switch to "Archive" tab to view completed items
- See completion timestamps and original due dates
- Archived items are permanently stored

## Technical Details

- **Frontend**: React 18, HTML5, CSS3
- **Storage**: IndexedDB for persistent local data
- **Notifications**: Browser Notification API
- **PWA**: Service Worker, Web App Manifest
- **Offline**: Full offline functionality once cached
- **Mobile**: Responsive design, touch-optimized

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited PWA features
- **Mobile Chrome**: Excellent (tested on Galaxy S24)

## File Structure

```
├── index.html          # Main HTML file
├── app.js              # React application code
├── styles.css          # CSS styles and theming
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── generate-icons.html # Icon generation utility
├── icons/              # App icons (generated)
└── README.md          # This file
```

## Privacy & Data

- **No account required** - Works entirely offline
- **Local storage only** - Data never leaves your device
- **No tracking** - No analytics or external connections
- **GDPR compliant** - No personal data collection

## Development

To modify the app:

1. Edit `app.js` for React components and functionality
2. Edit `styles.css` for styling and themes
3. Edit `manifest.json` for PWA settings
4. Test in Chrome with DevTools → Application → Service Workers

## Troubleshooting

**Notifications not working?**
- Ensure notification permission is granted
- Check Chrome settings → Privacy → Notifications

**PWA install not available?**
- Ensure you're using HTTPS or localhost
- Check all icons are present in icons/ folder
- Verify manifest.json is valid

**App not working offline?**
- Check service worker registration in DevTools
- Clear cache and reload if issues persist

**Mobile touch issues?**
- App is optimized for touch, ensure latest Chrome version
- Minimum touch target size is 44px for accessibility