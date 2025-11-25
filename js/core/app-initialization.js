// App Initialization Module - core/app-initialization.js
// Handles application startup, authentication, and global setup

import { auth, provider, onAuthStateChanged, signInWithPopup, signOut, db } from './firebase-config.js';
import { AppState } from './app-state.js';
import { showNotification, setTodayDisplay } from './ui-helpers.js';
import { loadWorkoutPlans } from './data-manager.js'; // ADD loadWorkoutData here
import { getExerciseLibrary } from './exercise-library.js';
import { getWorkoutHistory } from './workout-history.js';
import { initializeWorkoutManagement } from '../core/workout/workout-management-ui.js';
import { initializeErrorHandler, startConnectionMonitoring } from './error-handler.js';

// ===================================================================
// MAIN APP INITIALIZATION
// ===================================================================

export function initializeWorkoutApp() {
    console.log('🚀 Initializing Big Surf Workout Tracker...');

    // Initialize global error handling FIRST
    initializeErrorHandler();

    try {
        // Initialize exercise library BEFORE auth (so it's always available)
        const exerciseLibrary = getExerciseLibrary(AppState);
        exerciseLibrary.initialize();
        window.exerciseLibrary = exerciseLibrary;
        
        // Initialize workout history
        const workoutHistory = getWorkoutHistory(AppState);
        workoutHistory.initialize();
        window.workoutHistory = workoutHistory;

        // Start connection monitoring
        startConnectionMonitoring(db);

        console.log('âœ… Core modules initialized successfully');
        
    } catch (error) {
        console.error('âŒ Error initializing modules:', error);
        showNotification('Error initializing app modules', 'error');
    }
    
    // Set up authentication listener
    setupAuthenticationListener();
    
    console.log('âœ… App initialization completed');
}

export function initializeEnhancedWorkoutSelector() {
    console.log('ðŸŽ¯ Initializing enhanced workout selector...');
    
    // Set up workout category filters
    setupWorkoutFilters();
    
    // Set up workout search
    setupWorkoutSearch();
    
    // Load initial workout data
    if (AppState.workoutPlans && AppState.workoutPlans.length > 0) {
        renderInitialWorkouts();
    }
    
    console.log('âœ… Enhanced workout selector initialized');
}

// ===================================================================
// AUTHENTICATION
// ===================================================================

export async function signIn() {
    try {
        console.log('ðŸ” Attempting Google sign-in...');
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log('âœ… Sign-in successful:', user.displayName);
        showNotification(`Welcome, ${user.displayName}! ðŸ‘‹`, 'success');
        
    } catch (error) {
        console.error('âŒ Sign-in error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            showNotification('Sign-in cancelled', 'info');
        } else if (error.code === 'auth/popup-blocked') {
            showNotification('Please allow popups for sign-in', 'warning');
        } else {
            showNotification('Sign-in failed. Please try again.', 'error');
        }
    }
}

export async function signOutUser() {
    try {
        await signOut(auth);
        console.log('âœ… Sign-out successful');
        showNotification('Signed out successfully', 'info');
    } catch (error) {
        console.error('âŒ Sign-out error:', error);
        showNotification('Error signing out', 'error');
    }
}

export function showUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const signInBtn = document.getElementById('sign-in-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    if (userInfo) userInfo.classList.remove('hidden');
    if (signInBtn) signInBtn.classList.add('hidden');
    
    if (userAvatar) userAvatar.src = user.photoURL || '/default-avatar.png';
    if (userName) userName.textContent = user.displayName || user.email;
    
    console.log('âœ… User info displayed for:', user.displayName);
}

export function hideUserInfo() {
    const userInfo = document.getElementById('user-info');
    const signInBtn = document.getElementById('sign-in-btn');
    
    if (userInfo) userInfo.classList.add('hidden');
    if (signInBtn) signInBtn.classList.remove('hidden');
    
    console.log('âœ… User info hidden');
}

export function setupAuthenticationListener() {
    console.log('ðŸ” Setting up authentication listener...');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('ðŸ” User signed in:', user.displayName || user.email);
            AppState.currentUser = user;
            
            // Update UI
            showUserInfo(user);
            
            // Load ALL data FIRST (loadWorkoutPlans loads both plans AND exercises)
            await loadWorkoutPlans(AppState);
            console.log('âœ… Data loaded - Plans:', AppState.workoutPlans.length, 'Exercises:', AppState.exerciseDatabase.length);
            
            // Validate and refresh user data
            await validateUserData();
            
            // THEN check for in-progress workouts (now plans will be loaded!)
            await checkForInProgressWorkoutEnhanced();
            
        } else {
            console.log('ðŸ” User signed out');
            AppState.currentUser = null;
            
            // Update UI
            hideUserInfo();
        }
    });
}

// ===================================================================
// DATA LOADING AND VALIDATION
// ===================================================================

export async function validateUserData() {
    if (!AppState.currentUser) return;
    
    console.log('ðŸ” Validating user data...');
    
    try {
        // Refresh exercise database during validation
        await refreshExerciseDatabase();
        
        // Load user's workout templates
        const { FirebaseWorkoutManager } = await import('./firebase-workout-manager.js');
        const workoutManager = new FirebaseWorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        
        // Check custom exercises
        const customExercises = AppState.exerciseDatabase.filter(ex => ex.isCustom);
        
        console.log(`âœ… User data validation:
        - Templates: ${templates.length}
        - Custom exercises: ${customExercises.length}  
        - Total exercises: ${AppState.exerciseDatabase.length}`);
        
        showNotification(`Data loaded: ${templates.length} templates, ${customExercises.length} custom exercises`, 'success');
        
    } catch (error) {
        console.error('âŒ Error validating user data:', error);
        showNotification('Error loading user data', 'warning');
    }
}

export async function refreshExerciseDatabase() {
    console.log('ðŸ”„ Refreshing exercise database...');
    
    try {
        if (AppState.currentUser) {
            // Load full exercise library with user customizations
            const { FirebaseWorkoutManager } = await import('./firebase-workout-manager.js');
            const workoutManager = new FirebaseWorkoutManager(AppState);
            AppState.exerciseDatabase = await workoutManager.getExerciseLibrary();
        } else {
            // Load default exercises only
            const exerciseResponse = await fetch('./exercises.json');
            if (exerciseResponse.ok) {
                AppState.exerciseDatabase = await exerciseResponse.json();
            }
        }
        
        console.log(`âœ… Exercise database refreshed: ${AppState.exerciseDatabase.length} exercises`);
        
    } catch (error) {
        console.error('âŒ Error refreshing exercise database:', error);
    }
}

export function fillTemplateValues() {
    // Fill in any missing template values with defaults
    if (AppState.workoutPlans) {
        AppState.workoutPlans.forEach(plan => {
            if (plan.exercises) {
                plan.exercises.forEach(exercise => {
                    exercise.sets = exercise.sets || 3;
                    exercise.reps = exercise.reps || 10;
                    exercise.weight = exercise.weight || 50;
                });
            }
        });
    }
    
    console.log('âœ… Template values filled with defaults');
}

// ===================================================================
// IN-PROGRESS WORKOUT CHECK
// ===================================================================

async function checkForInProgressWorkoutEnhanced() {
    console.log('ðŸ” Checking for in-progress workout...');
    
    try {
        const { loadTodaysWorkout } = await import('./data-manager.js');
        const todaysData = await loadTodaysWorkout(AppState);
        
        if (todaysData && !todaysData.completedAt && !todaysData.cancelledAt) {
            console.log('ðŸ“‹ Found in-progress workout:', todaysData.workoutType);
            
            // NOW workout plans will be available!
            console.log('Available workout plans:', AppState.workoutPlans.length);
            
            // Validate workout plan exists
            const workoutPlan = AppState.workoutPlans.find(plan => 
                plan.day === todaysData.workoutType || 
                plan.name === todaysData.workoutType ||
                plan.id === todaysData.workoutType
            );
            
            if (!workoutPlan) {
                console.warn('âš ï¸ Workout plan not found for:', todaysData.workoutType);
                console.log('Available plans:', AppState.workoutPlans.map(p => p.day || p.name));
                return;
            }
            
            // Store in-progress workout globally
            window.inProgressWorkout = {
                ...todaysData,
                originalWorkout: workoutPlan
            };
            
            // Show in-progress workout prompt
            showInProgressWorkoutPrompt(todaysData);
            
        } else {
            console.log('âœ… No in-progress workout found');
        }
        
    } catch (error) {
        console.error('âŒ Error checking for in-progress workout:', error);
    }
}

function showInProgressWorkoutPrompt(workoutData) {
    if (window.showingProgressPrompt) return;
    window.showingProgressPrompt = true;
    
    console.log('📢 Showing resume workout card for:', workoutData.workoutType);
    
    // Update card elements
    const card = document.getElementById('resume-workout-banner');
    const nameElement = document.getElementById('resume-workout-name');
    const setsElement = document.getElementById('resume-sets-completed');
    const timeElement = document.getElementById('resume-time-ago');
    
    if (card && nameElement) {
        // Set workout name
        nameElement.textContent = workoutData.workoutType;
        
        // Calculate sets completed
        let completedSets = 0;
        let totalSets = 0;
        if (workoutData.exercises) {
            Object.keys(workoutData.exercises).forEach(key => {
                const exercise = workoutData.exercises[key];
                if (exercise && exercise.sets) {
                    exercise.sets.forEach(set => {
                        totalSets++;
                        if (set.reps && set.weight) completedSets++;
                    });
                }
            });
        }
        if (setsElement) {
            setsElement.textContent = `${completedSets}/${totalSets}`;
        }
        
        // Calculate time ago
        if (timeElement && workoutData.startedAt) {
            const startTime = new Date(workoutData.startedAt);
            const now = new Date();
            const diffMs = now - startTime;
            const diffMins = Math.floor(diffMs / 60000);
            
            let timeAgo;
            if (diffMins < 1) timeAgo = 'just now';
            else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)}h ago`;
            else timeAgo = `${Math.floor(diffMins / 1440)}d ago`;
            
            timeElement.textContent = timeAgo;
        }
        
        // Show the card
        card.classList.remove('hidden');
        
        // Scroll to top so card is visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // Fallback to old confirm dialog if card elements not found
        console.warn('Resume card elements not found, using fallback confirm dialog');
        const workoutDate = new Date(workoutData.date).toLocaleDateString();
        const message = `You have an in-progress "${workoutData.workoutType}" workout from ${workoutDate}.\n\nWould you like to continue where you left off?`;
        
        setTimeout(() => {
            if (confirm(message)) {
                import('./workout-core.js').then(module => {
                    module.continueInProgressWorkout();
                });
            } else {
                import('./workout-core.js').then(module => {
                    module.discardInProgressWorkout();
                });
            }
            window.showingProgressPrompt = false;
        }, 1000);
    }
}

// ===================================================================
// GLOBAL EVENT LISTENERS
// ===================================================================

export function setupEventListeners() {
    console.log('ðŸŽ¯ Setting up global event listeners...');
    
    // Wait a bit for DOM to be fully ready
    setTimeout(() => {
        setupSignInListeners();
    }, 500);
    
    // Set up other listeners immediately
    setupOtherEventListeners();
}

function setupSignInListeners() {
    console.log('ðŸ” Setting up sign-in listeners...');
    
    // Debug: Log all potential sign-in buttons
    const allSignInElements = document.querySelectorAll('#sign-in-btn, .sign-in-btn, .signin-btn, [onclick*="signIn"], button[class*="sign"]');
    console.log('ðŸ” Found potential sign-in elements:', allSignInElements.length);
    allSignInElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ID: "${el.id}", Class: "${el.className}", Text: "${el.textContent?.trim()}"${el.onclick ? ', Has onclick' : ''}`);
    });
    
    // Try multiple selectors for sign-in button
    const signInSelectors = [
        '#sign-in-btn',
        '.sign-in-btn', 
        'button:contains("Sign In with Google")',
        'button[onclick*="signIn"]',
        '[data-action="sign-in"]'
    ];
    
    let signInBtn = null;
    for (const selector of signInSelectors) {
        if (selector.includes('contains')) {
            // Special handling for text-based selector
            const buttons = Array.from(document.querySelectorAll('button'));
            signInBtn = buttons.find(btn => btn.textContent?.includes('Sign In with Google'));
        } else {
            signInBtn = document.querySelector(selector);
        }
        
        if (signInBtn) {
            console.log(`âœ… Found sign-in button with selector: ${selector}`);
            break;
        }
    }
    
    if (signInBtn) {
        console.log('âœ… Sign-in button found, adding event listener');
        console.log('Button details:', {
            id: signInBtn.id,
            className: signInBtn.className,
            textContent: signInBtn.textContent?.trim(),
            hidden: signInBtn.classList.contains('hidden'),
            display: window.getComputedStyle(signInBtn).display
        });
        
        // Remove any existing onclick to prevent conflicts
        signInBtn.onclick = null;
        
        // Add our event listener
        signInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('ðŸ” Sign-in button clicked - calling signIn()');
            
            // Make sure function exists
            if (typeof window.signIn === 'function') {
                window.signIn();
            } else {
                console.error('âŒ window.signIn is not a function:', typeof window.signIn);
            }
        });
        
        // Also add onclick as backup
        signInBtn.onclick = (e) => {
            e.preventDefault();
            console.log('ðŸ” Sign-in button onclick triggered');
            if (typeof window.signIn === 'function') {
                window.signIn();
            }
        };
        
    } else {
        console.warn('âš ï¸ No sign-in button found with any selector');
        
        // Last resort: add click listener to document for any sign-in related clicks
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target && target.textContent?.includes('Sign In')) {
                console.log('ðŸ” Detected sign-in button click via document listener');
                e.preventDefault();
                if (typeof window.signIn === 'function') {
                    window.signIn();
                }
            }
        });
    }
    
    // Sign-out button
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        console.log('âœ… Sign-out button found, adding event listener');
        signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('ðŸ” Sign-out button clicked');
            signOutUser();
        });
    }
    
    // Debug: Check user info elements
    const userInfo = document.getElementById('user-info');
    console.log('ðŸ” User info element:', {
        found: !!userInfo,
        hidden: userInfo?.classList.contains('hidden'),
        display: userInfo ? window.getComputedStyle(userInfo).display : 'N/A'
    });
}

function setupOtherEventListeners() {
    // Global unit toggle
    const globalUnitToggle = document.querySelector('.global-settings .unit-toggle');
    if (globalUnitToggle) {
        globalUnitToggle.addEventListener('click', (e) => {
            if (e.target.classList.contains('unit-btn')) {
                import('./workout-core.js').then(module => {
                    module.setGlobalUnit(e.target.dataset.unit);
                });
            }
        });
    }
    
    // Close modal buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal') || e.target.closest('.close-modal')) {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });
    
    // Close modal on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });
    
    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal:not(.hidden)');
            if (activeModal) {
                activeModal.classList.add('hidden');
            }
        }
    });

    // Click outside modal to close (backdrop click)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });

    console.log('âœ… Other event listeners setup complete');
}

export function setupKeyboardShortcuts() {
    console.log('âŒ¨ï¸ Setting up keyboard shortcuts...');
    
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('workout-search') || 
                              document.getElementById('exercise-search');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Space to pause/resume timer
        if (e.key === ' ' && AppState.globalRestTimer) {
            e.preventDefault();
            // Toggle timer pause (would need to implement pause functionality)
        }
        
        // ESC to close any open modals
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal:not(.hidden)');
            if (activeModal) {
                e.preventDefault();
                activeModal.classList.add('hidden');
            }
        }
    });
    
    console.log('âœ… Keyboard shortcuts setup complete');
}

// ===================================================================
// WORKOUT SELECTOR SETUP
// ===================================================================

function setupWorkoutFilters() {
    const filterButtons = document.querySelectorAll('.workout-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            filterWorkoutsByCategory(category);
        });
    });
}

function setupWorkoutSearch() {
    const searchInput = document.getElementById('workout-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounceWorkoutSearch);
    }
}

function filterWorkoutsByCategory(category) {
    // Update active filter
    document.querySelectorAll('.workout-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    // Import and use template selection module
    import('./template-selection.js').then(module => {
        module.filterTemplates(category);
    });
}

function debounceWorkoutSearch(event) {
    clearTimeout(debounceWorkoutSearch.timeout);
    debounceWorkoutSearch.timeout = setTimeout(() => {
        const query = event.target.value;
        
        // Import and use template selection module
        import('./template-selection.js').then(module => {
            module.searchTemplates(query);
        });
    }, 300);
}

function renderInitialWorkouts() {
    // Import and use template selection module
    import('./template-selection.js').then(module => {
        module.loadTemplatesByCategory();
    });
}

// ===================================================================
// GLOBAL SETUP HELPERS
// ===================================================================

export function setupGlobalVariables() {
    // Initialize any global variables that need setup
    window.showingProgressPrompt = false;
    window.historyListenersSetup = false;
    
    console.log('âœ… Global variables initialized');
}

export function initializeModules() {
    try {
        // Initialize workout management
        initializeWorkoutManagement(AppState);
        
        // Set up date display
        setTodayDisplay();
        
        console.log('âœ… All modules initialized successfully');
        
    } catch (error) {
        console.error('âŒ Error initializing modules:', error);
        showNotification('Some features may not work properly', 'warning');
    }
}

// ===================================================================
// MAIN ENTRY POINT
// ===================================================================

export function startApplication() {
    console.log('ðŸš€ Starting Big Surf Workout Tracker application...');

    // Register service worker for PWA functionality
    registerServiceWorker();

    // Set up global variables
    setupGlobalVariables();

    // Initialize core app
    initializeWorkoutApp();

    // Set up event listeners
    setupEventListeners();
    setupKeyboardShortcuts();

    // Initialize UI modules
    initializeModules();

    // Initialize enhanced workout selector
    initializeEnhancedWorkoutSelector();

    console.log('âœ… Application started successfully!');
}

// ===================================================================
// SERVICE WORKER REGISTRATION
// ===================================================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                    console.log('✅ Service Worker registered:', registration.scope);

                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('🔄 Service Worker update found');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available, show update notification
                                showNotification('App update available! Refresh to update.', 'info');
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.log('❌ Service Worker registration failed:', error);
                });
        });
    } else {
        console.log('⚠️ Service Workers not supported in this browser');
    }
}