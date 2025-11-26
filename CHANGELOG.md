# 📝 Changelog - Big Surf Workout Tracker

All notable changes and improvements to BigSurf-B.

## [2.2.0] - 2025-01-25

### ✨ New Features

#### Personal Records (PR) Tracking System
- **Equipment-Specific PRs**: Track personal records per equipment type (Barbell, Machine, Hammer Strength, etc.)
- **Location-Aware Tracking**: Manage multiple gym locations with visit tracking
- **Three PR Types**: Max weight, max reps, and max volume tracking
- **Real-Time Detection**: Automatic PR detection as you enter set data during workouts
- **Visual Feedback**: Gold trophy badges appear next to PR sets with pulsing animation
- **PR Display**: View all PRs in exercise history modal with equipment context
- **Smart Notifications**: Toast notifications specify PR type achieved

#### Location Management
- **Location Selector Modal**: Choose gym location before starting workout
- **Saved Locations**: Quick-select from frequently visited gyms
- **Visit Tracking**: Automatically tracks visit count and last visit date
- **Location Suggestions**: Suggests most frequently visited location

### 🎨 UI/UX Improvements

#### Workout History Enhancements
- **Delete Completed Workouts**: Added delete button to all workouts in history
- **Repeat Workout Button**: Quickly restart any past workout
- **Enhanced Metrics Display**: Shows duration, start/end times, progress bar
- **Video Buttons**: Watch form videos from workout history detail view

#### Exercise Manager Redesign
- **Integrated Modal**: Converted exercise manager from popup window to integrated modal
- **Consistent Theming**: Updated all styles to match main app's dark theme with turquoise accents
- **Better Mobile Experience**: No more context switching between windows on mobile
- **Visual Badges**: Added custom/override/default badges for exercise types
- **Search & Filter**: Real-time search with body part and equipment filters
- **Exercise Cards**: Redesigned with stats display (sets, reps, weight)

### 🏗️ Architecture Improvements

#### New Modules
- Created `pr-tracker.js` - Personal records tracking engine
  - Equipment and location-aware PR calculation
  - Firebase storage for PR data
  - Three PR type detection (max weight, max reps, max volume)
  - Automatic PR processing after workout completion
- Created `location-ui.js` - Location selector modal and management
  - Location selection before workouts
  - Saved locations with visit statistics
  - Location change functionality
- Created `exercise-manager-ui.js` - Complete exercise library management
  - CRUD operations for exercises
  - Search and filter functionality
  - Modal-based UI (no popup windows)
  - Integrated with AppState

#### Project Reorganization
- Created `docs/` folder for documentation
- Created `data/` folder for default JSON files
- Created `legacy/` folder for deprecated files
- Moved DEPLOYMENT.md and MOBILE_TESTING.md to docs/
- Moved exercises.json and workouts.json to data/
- Updated all file path references in code

### 📚 Documentation

- Created `FUTURE_ENHANCEMENTS.md` - Roadmap of potential features with priority ratings
- Updated CLAUDE.md with new modules (pr-tracker.js, location-ui.js, exercise-manager-ui.js)
- Updated README.md project structure to reflect new folders
- Added notes about modal-based architecture and PR tracking system
- Documented that JSON files are essential fallback data (not legacy)
- Documented Firebase schema for PR storage

### 🛠️ Development Tools

- Updated .gitignore to exclude auto-generated files
- Added .firebaserc to repository (needed for deployment)
- Excluded Python utility scripts from repo

### 🧹 Code Cleanup

- **Removed 15 unused legacy functions** (~450 lines of dead code)
  - Swap exercise functions (replaced by delete + add workflow)
  - Legacy global rest timer (replaced by modal rest timer)
  - Unused helper functions and TODO stubs
- **Simplified main.js imports** - Removed imports for deleted functions
- **Improved code maintainability** - Less confusion about which functions are actually used

### 🐛 Bug Fixes

- Fixed missing delete/repeat buttons in workout detail modal
- Fixed emoji encoding in exercise library UI
- Fixed emoji encoding in workout history UI
- Fixed authentication redirect for Firebase Hosting deployment

### 🗄️ Database Changes

**New Firebase Collection:**
```
users/{userId}/stats/personalRecords:
- exercisePRs: { "Exercise Name": { "Equipment": { maxWeight, maxReps, maxVolume } } }
- locations: { "Gym Name": { visitCount, lastVisit } }
- currentLocation: string
```

**Workout Schema Updates:**
- Added `location` field to workout documents
- Location stored with each workout for PR context

### 📝 Notes

**Why JSON Files Are Kept:**
- Provide default exercise library and workout templates
- Fallback data when Firebase is unavailable
- Enable offline functionality
- Progressive enhancement pattern (app works without Firebase)

## [2.0.0] - 2025-01-24

### 🎉 Major Refactoring & Improvements

This version represents a complete overhaul with focus on code quality, security, and user experience.

### ✨ New Features

#### PWA Support
- **Service Worker**: Offline functionality with intelligent caching
- **Web App Manifest**: Install to home screen on mobile devices
- **App Shortcuts**: Quick access to Start Workout and History
- **Automatic Updates**: Notifies users when new version available

#### Error Handling
- **Global Error Handler**: Catches all uncaught errors and promise rejections
- **User-Friendly Messages**: Converts technical errors to actionable messages
- **Offline Detection**: Notifies when connection lost/restored
- **Firebase Monitoring**: Checks connection every 30 seconds
- **Error Rate Limiting**: Prevents notification spam

#### Performance Optimizations
- **Loading Skeletons**: Smooth loading states for better UX
- **Content Visibility**: Browser rendering optimizations
- **Image Lazy Loading**: Deferred image loading
- **Accessibility**: Respects `prefers-reduced-motion`

### 🏗️ Architecture Improvements

#### Modular Refactoring
- Split monolithic files into focused modules
- Created clear separation of concerns
- Improved maintainability and testability

**New Modules:**
- `app-initialization.js` - Startup & authentication
- `workout-core.js` - Workout session logic
- `template-selection.js` - Workout picker UI
- `workout-history-ui.js` - History & calendar
- `manual-workout.js` - Past workout entry
- `error-handler.js` - Global error handling
- `debug-utilities.js` - Development tools

### 🔒 Security Enhancements

#### Firebase Security Rules
- User data scoped to individual users only
- Global collections (exercises, workouts) are read-only
- Documented secure rule configuration
- Verified protection against unauthorized access

### 📚 Documentation

#### Comprehensive README.md
- Installation instructions
- Firebase setup guide
- Project structure documentation
- Usage examples
- Development guidelines
- Troubleshooting section

#### CLAUDE.md
- Development best practices
- Code patterns and conventions
- Architecture decisions
- Module responsibilities

#### MOBILE_TESTING.md
- Complete testing checklist
- Performance benchmarks
- Edge case scenarios
- Browser compatibility matrix

### 🎨 UI/UX Improvements

#### Visual Enhancements
- Favicon for browser tab
- SEO meta tags
- Open Graph/Twitter cards for sharing
- Dark theme refinements

#### User Experience
- Faster perceived load times
- Better offline experience
- Improved error messages
- Smooth animations and transitions

### 🐛 Bug Fixes

#### Character Encoding
- Fixed corrupted emojis in exercise display
- Corrected bullet points (• instead of â€¢)
- Fixed multiplication signs (× instead of Ã—)

#### Exercise Manager
- Fixed loading issue (only 2 exercises showing)
- Exposed `FirebaseWorkoutManager` to window object
- Properly connects parent window for popup

### 🛠️ Development Tools

#### Project Setup
- `.gitignore` for clean repository
- Service worker for offline testing
- Debug utilities for troubleshooting
- Error logging system

### 📦 Dependencies

No changes - still using:
- Firebase SDK 10.7.1 (CDN)
- Font Awesome 6.0.0 (CDN)
- Vanilla JavaScript (ES6 Modules)
- No build process required

### 🚀 Deployment

Ready for production with:
- ✅ Secure Firebase rules
- ✅ Comprehensive error handling
- ✅ PWA capabilities
- ✅ Performance optimizations
- ✅ Full documentation
- ✅ Mobile testing checklist

### 📝 Notes

**Known Limitations:**
- BigSurf.png logo is 1.2MB (recommend optimization to ~200KB)
- Some console.log emojis display incorrectly (cosmetic only)
- Exercise manager requires parent window connection

**Recommended Next Steps:**
1. Test on actual mobile devices (see MOBILE_TESTING.md)
2. Optimize logo image size
3. Deploy to Firebase Hosting
4. Monitor Firebase quotas
5. Gather user feedback

### 🙏 Credits

Built with ❤️ using:
- Firebase for backend
- Claude Code for development assistance
- Community feedback and testing

---

## Version History

### [1.0.0] - Original Version
- Basic workout tracking
- Exercise library
- Firebase integration
- Single-file architecture

---

## Upgrade Guide

### From 1.0.0 to 2.0.0

**Data Migration:** Not required - fully backward compatible with v1.0 data

**Breaking Changes:** None - API compatible with v1.0

**New Features to Enable:**
1. Update Firebase Security Rules (see README.md)
2. Deploy service-worker.js for PWA
3. Add manifest.json to enable installation
4. Update HTML head with new meta tags (optional)

**Recommended:**
- Clear browser cache for users
- Test PWA installation on mobile
- Monitor error logs for first week
- Review Firebase quota usage

---

*For detailed commit history, see git log*
