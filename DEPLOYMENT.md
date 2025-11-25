# Firebase Hosting Deployment Guide

## Prerequisites

### 1. Install Node.js
Download and install Node.js from: https://nodejs.org/

Choose the LTS (Long Term Support) version for Windows.

After installation, restart your terminal/command prompt and verify:
```bash
node --version
npm --version
```

## Deployment Steps

### 2. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 3. Login to Firebase
```bash
firebase login
```
This will open a browser window for you to authenticate with your Google account.

### 4. Deploy to Firebase Hosting
```bash
firebase deploy
```

Your app will be deployed to: `https://workout-tracker-b94b6.web.app`

## Post-Deployment

### Verify Authorized Domains
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `workout-tracker-b94b6`
3. Navigate to **Authentication** > **Settings** > **Authorized domains**
4. Ensure these domains are listed:
   - `workout-tracker-b94b6.web.app`
   - `workout-tracker-b94b6.firebaseapp.com`
   - `localhost` (for development)

### Test Your Deployment
1. Visit your deployed URL
2. Test sign-in functionality (should use redirect, not popup)
3. Test PWA installation on mobile device
4. Verify workout creation and history

## Useful Commands

```bash
# View deployment history
firebase hosting:channel:list

# Deploy to preview channel (test before production)
firebase hosting:channel:deploy preview

# View logs
firebase deploy --only hosting --debug
```

## Troubleshooting

### Sign-in redirect not working
- Check Authorized domains in Firebase Console
- Verify firebase.json rewrites are correct
- Check browser console for errors

### PWA not installing
- Ensure BigSurf.png exists in root directory
- Check manifest.json paths are relative
- Verify HTTPS connection (required for PWA)

### Changes not appearing
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Check Firebase Hosting cache headers in firebase.json
