# 📱 Mobile Testing Checklist

Use this checklist to test Big Surf Workout Tracker on your mobile device before releasing.

## 🔧 Prerequisites

- [ ] Deployed to Firebase Hosting or accessible URL
- [ ] Test on your actual phone (not just browser DevTools)
- [ ] Clear browser cache before testing
- [ ] Test on both WiFi and mobile data

## 📋 Core Functionality Tests

### Authentication
- [ ] Google sign-in works smoothly
- [ ] Sign-out works
- [ ] User info displays correctly
- [ ] Persists login after closing browser
- [ ] Works in incognito mode

### Starting a Workout
- [ ] Can select workout template
- [ ] Workout starts without errors
- [ ] All exercises load
- [ ] Can see exercise details
- [ ] Form videos play (if using YouTube links)

### During Workout
- [ ] Can enter sets, reps, and weights
- [ ] Number keyboard appears for number inputs
- [ ] Can switch between lbs/kg
- [ ] Rest timer works (if implemented)
- [ ] Can add/delete sets
- [ ] Can add notes to exercises
- [ ] Progress indicator updates correctly
- [ ] Can pause and resume
- [ ] Can delete exercises from workout

### Completing Workout
- [ ] Complete button works
- [ ] Workout saves to Firebase
- [ ] Appears in workout history
- [ ] Duration calculated correctly
- [ ] All data persisted (sets, reps, weights, notes)

### Workout History
- [ ] Calendar loads
- [ ] Can navigate months
- [ ] Past workouts display
- [ ] Can view workout details
- [ ] Can repeat past workouts
- [ ] Can delete workouts
- [ ] Filter/search works (if implemented)

### Manual Workout Entry
- [ ] Modal opens
- [ ] Can select date
- [ ] Can select template or custom
- [ ] Can add exercises
- [ ] Can enter all data
- [ ] Saves correctly
- [ ] Appears in history

### Exercise Library
- [ ] Library opens in new window/tab
- [ ] All 79+ exercises load
- [ ] Search works
- [ ] Filters work (body part, equipment)
- [ ] Can create custom exercises
- [ ] Can edit exercises
- [ ] Changes sync back to main app

## 🎨 UI/UX Tests

### Visual
- [ ] Logo displays correctly
- [ ] No layout breaks or overlaps
- [ ] Text is readable (not too small)
- [ ] Buttons are thumb-friendly (big enough to tap)
- [ ] Colors/contrast looks good
- [ ] Dark theme is comfortable
- [ ] Loading states show (spinners/skeletons)

### Responsive Design
- [ ] Works in portrait orientation
- [ ] Works in landscape orientation
- [ ] Handles small screens (iPhone SE)
- [ ] Handles large screens (iPhone Pro Max)
- [ ] Works on Android phones
- [ ] Works on tablets

### Touch Interactions
- [ ] Buttons respond to tap immediately
- [ ] No accidental double-taps
- [ ] Scroll works smoothly
- [ ] Modals can be dismissed
- [ ] No stuck loading states
- [ ] Keyboard doesn't cover inputs

## 📶 Network Tests

### Online Behavior
- [ ] Data loads quickly
- [ ] Firebase queries work
- [ ] Images load
- [ ] No console errors
- [ ] Service worker installs

### Offline Behavior
- [ ] Shows offline notification when disconnected
- [ ] App still loads from cache
- [ ] Can view cached data
- [ ] Shows appropriate error messages for Firebase operations
- [ ] Reconnects gracefully when online
- [ ] Syncs pending changes (if implemented)

## 🚀 PWA Tests

### Installation
- [ ] "Add to Home Screen" prompt appears (after criteria met)
- [ ] Can install to home screen
- [ ] App icon appears correctly
- [ ] App name displays correctly
- [ ] Opens in standalone mode (no browser chrome)

### Installed App
- [ ] Splash screen shows (if configured)
- [ ] Theme color matches app
- [ ] Status bar color correct
- [ ] App shortcuts work (if configured)
- [ ] Push notifications work (if implemented)

## ⚡ Performance Tests

### Load Time
- [ ] Initial load < 3 seconds on mobile data
- [ ] Subsequent loads < 1 second (cached)
- [ ] No flash of unstyled content
- [ ] No layout shifts during load

### Runtime Performance
- [ ] Smooth scrolling (60fps)
- [ ] No lag when entering data
- [ ] Firebase queries complete quickly
- [ ] Images don't slow down page
- [ ] No memory leaks (use for 30+ min)

## 🐛 Edge Cases

### Data
- [ ] Handles very long workout names
- [ ] Handles many exercises in one workout
- [ ] Handles very heavy weights (1000+ lbs)
- [ ] Handles many sets (10+)
- [ ] Handles special characters in notes
- [ ] Handles empty workouts

### User Flow
- [ ] Handles incomplete workouts (cancel/abandon)
- [ ] Handles app closure mid-workout
- [ ] Handles rapid button tapping
- [ ] Handles back button on Android
- [ ] Handles app switching
- [ ] Handles phone calls mid-workout

## 🔒 Security Tests

### Firebase Rules
- [ ] Can only see own workouts
- [ ] Cannot access other users' data
- [ ] Cannot modify global exercises
- [ ] Cannot modify global templates
- [ ] Sign-out clears session properly

## ♿ Accessibility

- [ ] Screen reader can read content (if testing with one)
- [ ] Buttons have clear labels
- [ ] Sufficient color contrast
- [ ] Touch targets are 44x44px minimum
- [ ] Works with text zoom
- [ ] Respects reduced motion preference

## 📝 Browser Compatibility

Test on:
- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Firefox (Mobile)
- [ ] Edge (Mobile) - if available
- [ ] Samsung Internet - if available

## ✅ Pre-Release Checklist

Before announcing to users:
- [ ] All critical tests pass
- [ ] No console errors
- [ ] No "TODO" or test data visible
- [ ] Firebase rules are secure
- [ ] Backup data exported
- [ ] README is up to date
- [ ] Version number updated (if using)

## 🚨 Common Issues to Watch For

### Known Issues
- Logo image is 1.2MB (loads slowly on 3G)
- Some console.log emojis may display incorrectly (cosmetic only)
- Exercise manager requires parent window connection

### If Something Breaks
1. Check browser console for errors
2. Check Firebase console for quota/errors
3. Clear browser cache and retry
4. Try incognito mode
5. Check Firebase security rules
6. Verify network connectivity

## 📊 Testing Record

| Date | Tester | Device | OS | Browser | Result | Notes |
|------|--------|--------|----|---------|---------| ------|
| | | | | | ✅/❌ | |
| | | | | | | |
| | | | | | | |

---

**Pro Tip**: Test during an actual gym session to catch real-world issues!
