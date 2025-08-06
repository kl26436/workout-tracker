// Main application entry point - Enhanced with Exercise Swapping
import { auth, provider, onAuthStateChanged, signInWithPopup, signOut } from './core/firebase-config.js';
import { AppState } from './core/app-state.js';
import { showNotification, setTodayDisplay, convertWeight, updateProgress } from './core/ui-helpers.js';
import { saveWorkoutData, loadTodaysWorkout, loadWorkoutPlans, loadExerciseHistory } from './core/data-manager.js';
import { getExerciseLibrary } from './core/exercise-library.js';
import { getWorkoutHistory } from './core/workout-history.js';
import { 
    initializeWorkoutManagement, 
    showWorkoutManagement, 
    hideWorkoutManagement,
    createNewTemplate,
    closeTemplateEditor,
    saveCurrentTemplate,
    addExerciseToTemplate,
    editTemplateExercise,
    removeTemplateExercise,
    openExerciseLibrary,
    closeExerciseLibrary,
    searchExerciseLibrary,
    filterExerciseLibrary,
    showCreateExerciseForm,
    closeCreateExerciseModal,
    createNewExercise,
} from './core/workout/workout-management-ui.js';

// State variables
let selectedWorkoutCategory = null;
let currentTemplateCategory = 'default';
let currentEditingTemplate = null;
let isEditingMode = false;
let exerciseLibrary = null;
let inProgressWorkout = null;
let showingProgressPrompt = false;
let workoutHistory = null;
let currentManualWorkout = {
    date: '',
    category: '',
    name: '',
    duration: 60,
    status: 'completed',
    notes: '',
    exercises: []
};
let currentManualExerciseIndex = null;
let manualExerciseUnit = 'lbs';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Enhanced Big Surf Workout Tracker (Modular)...');
    initializeWorkoutApp();
    setupEventListeners();
    setTodayDisplay();
    loadWorkoutPlans(AppState);
    initializeWorkoutManagement(AppState);
    initializeEnhancedWorkoutSelector();
});

function initializeWorkoutApp() {
    // Initialize exercise library BEFORE auth (so it's always available)
    try {
        exerciseLibrary = getExerciseLibrary(AppState);
        exerciseLibrary.initialize();
        window.exerciseLibrary = exerciseLibrary;
        
        // Initialize workout history
        workoutHistory = getWorkoutHistory(AppState);
        workoutHistory.initialize();
        window.workoutHistory = workoutHistory;
        } catch (error) {
        console.error('❌ Error initializing modules:', error);
    }
    
    // Set up auth state listener with error handling
    onAuthStateChanged(auth, async (user) => {
        await refreshExerciseDatabase()
        try {
            if (user) {
                AppState.currentUser = user;
                showUserInfo(user);
                await loadWorkoutPlans(AppState);
                
                // Validate user data with delay to ensure everything is loaded
                setTimeout(() => {
                    try {
                        validateUserData();
                    } catch (error) {
                        console.error('❌ Error in validateUserData:', error);
                    }
                }, 2000);
                
                // Check for in-progress workout and show options
                await checkAndShowInProgressWorkout();
                
            } else {
                AppState.currentUser = null;
                showSignInButton();
                showWorkoutSelector(); // Show selector if not signed in
            }
        } catch (error) {
            console.error('❌ Error in auth state change:', error);
            showNotification('Error during sign in process', 'error');
        }
    });
}

function testHistoryFilters() {
    console.log('🧪 Testing history filters...');
    
    // Test if elements exist
    const filterBtns = document.querySelectorAll('.history-filter-btn');
    const searchInput = document.getElementById('history-search');
    const startDate = document.getElementById('history-start-date');
    const endDate = document.getElementById('history-end-date');
    
    console.log('Filter buttons found:', filterBtns.length);
    console.log('Search input found:', !!searchInput);
    console.log('Date inputs found:', !!startDate, !!endDate);
    console.log('Workout history object:', !!workoutHistory);
    
    if (workoutHistory && workoutHistory.currentHistory) {
        console.log('Current history length:', workoutHistory.currentHistory.length);
        console.log('Filtered history length:', workoutHistory.filteredHistory?.length || 'undefined');
    }
    
    // Test a filter
    if (filterBtns.length > 0) {
        console.log('Testing filter button click...');
        filterBtns[1]?.click(); // Click second filter button
    }
}

window.testHistoryFilters = testHistoryFilters;

async function validateUserData() {
    if (!AppState.currentUser) return;
    
    console.log('🔍 Validating user data...');
    
    try {
        // CRITICAL: Refresh exercise database during validation
        await refreshExerciseDatabase();
        
        // Your existing validation code...
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        
        // Check custom exercises (should now be in AppState.exerciseDatabase)
        const customExercises = AppState.exerciseDatabase.filter(ex => ex.isCustom);
        
        console.log(`✅ User data validation:
        - Templates: ${templates.length}
        - Custom exercises: ${customExercises.length}  
        - Total exercises: ${AppState.exerciseDatabase.length}`);
        
        showNotification(`Data loaded: ${templates.length} templates, ${customExercises.length} custom exercises`, 'success');
        
    } catch (error) {
        console.error('❌ Error validating user data:', error);
    }
}

async function checkAndShowInProgressWorkout() {
    try {
        const todaysData = await loadTodaysWorkout(AppState);
        
        if (todaysData && todaysData.workoutType && !todaysData.completedAt) {
            // Check if it's a known workout type
            let workout = AppState.workoutPlans.find(w => w.day === todaysData.workoutType);
            
            // If not found, try to find it in custom templates
            if (!workout) {
                workout = await handleUnknownWorkout(todaysData);
            }
            
            if (workout) {
                // There's a valid in-progress workout
                inProgressWorkout = todaysData;
                showInProgressWorkoutPrompt();
            } else {
                // Invalid workout - clear it and start fresh
                console.log('🧹 Clearing invalid in-progress workout');
                inProgressWorkout = null;
                showWorkoutSelector();
            }
        } else {
            // No in-progress workout, show normal selector
            inProgressWorkout = null;
            showWorkoutSelector();
        }
    } catch (error) {
        console.error('Error checking in-progress workout:', error);
        showWorkoutSelector(); // Fallback to normal selector
    }
}

// NEW FUNCTION: Show in-progress workout prompt
function showInProgressWorkoutPrompt() {
    if (showingProgressPrompt) return; // Prevent multiple prompts
    showingProgressPrompt = true;
    
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const workoutManagement = document.getElementById('workout-management');
    
    // Hide other sections
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.add('hidden');
    
    // Show selector with in-progress prompt
    if (workoutSelector) {
        workoutSelector.classList.remove('hidden');
        
        // Add in-progress workout prompt at the top
        const existingPrompt = workoutSelector.querySelector('.in-progress-prompt');
        if (existingPrompt) {
            existingPrompt.remove(); // Remove existing prompt if any
        }
        
        const progressSets = countProgressSets(inProgressWorkout);
        const workoutAge = getWorkoutAge(inProgressWorkout.startTime);
        
        const promptHTML = `
            <div class="in-progress-prompt">
                <div class="progress-alert">
                    <div class="progress-alert-content">
                        <div class="progress-alert-header">
                            <i class="fas fa-clock"></i>
                            <h3>Workout In Progress</h3>
                        </div>
                        <div class="progress-alert-body">
                            <p><strong>${inProgressWorkout.workoutType}</strong></p>
                            <div class="progress-details">
                                <span>${progressSets.completed}/${progressSets.total} sets completed</span>
                                <span>Started ${workoutAge}</span>
                            </div>
                        </div>
                        <div class="progress-alert-actions">
                            <button class="btn btn-primary" onclick="continueInProgressWorkout()">
                                <i class="fas fa-play"></i> Continue Workout
                            </button>
                            <button class="btn btn-danger" onclick="discardInProgressWorkout()">
                                <i class="fas fa-trash"></i> Discard & Start New
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        workoutSelector.insertAdjacentHTML('afterbegin', promptHTML);
    }
}

// NEW FUNCTION: Continue in-progress workout
async function continueInProgressWorkout() {
    if (!inProgressWorkout) return;
    
    showingProgressPrompt = false;
    
    // Remove the prompt
    const prompt = document.querySelector('.in-progress-prompt');
    if (prompt) prompt.remove();
    
    try {
        // Ensure workout plan exists
        const workoutPlan = AppState.workoutPlans.find(w => w.day === inProgressWorkout.workoutType);
        if (!workoutPlan) {
            throw new Error(`Workout plan "${inProgressWorkout.workoutType}" not found`);
        }
        
        // Restore the full workout structure
        AppState.currentWorkout = {
            day: inProgressWorkout.workoutType,
            exercises: [...workoutPlan.exercises] // Clone the exercises
        };
        
        // Restore all saved data
        AppState.savedData = { ...inProgressWorkout };
        AppState.workoutStartTime = new Date(inProgressWorkout.startTime);
        
        // Restore exercise units
        if (inProgressWorkout.exerciseUnits) {
            AppState.exerciseUnits = { ...inProgressWorkout.exerciseUnits };
        } else {
            // Initialize with global unit
            AppState.currentWorkout.exercises.forEach((exercise, index) => {
                AppState.exerciseUnits[index] = AppState.globalUnit;
            });
        }
        
        // Update UI
        updateWorkoutDisplay(inProgressWorkout.workoutType);
        document.getElementById('workout-selector')?.classList.add('hidden');
        document.getElementById('active-workout')?.classList.remove('hidden');
        
        renderExercises();
        startWorkoutDurationTimer();
        
        showNotification('Continuing your workout!', 'success');
        
    } catch (error) {
        console.error('Error continuing workout:', error);
        showNotification('Error loading workout. Starting fresh.', 'error');
        
        // Fallback: start fresh workout
        inProgressWorkout = null;
        showWorkoutSelector();
    }
}

async function refreshExerciseDatabase() {
    if (!AppState.currentUser) {
        console.log('❌ No user signed in, cannot refresh exercise database');
        return AppState.exerciseDatabase || [];
    }
    
    try {
        console.log('🔄 Refreshing exercise database in AppState...');
        
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        
        // Get fresh data from Firebase
        const freshExercises = await workoutManager.getExerciseLibrary();
        
        // Update AppState with fresh data
        AppState.exerciseDatabase = freshExercises;
        
        // Make WorkoutManager globally available for exercise manager
        window.WorkoutManager = WorkoutManager;
        
        const customCount = freshExercises.filter(ex => ex.isCustom).length;
        const defaultCount = freshExercises.filter(ex => !ex.isCustom).length;
        
        console.log(`✅ AppState exercise database refreshed: ${defaultCount} default + ${customCount} custom = ${freshExercises.length} total`);
        
        return freshExercises;
    } catch (error) {
        console.error('❌ Error refreshing exercise database:', error);
        return AppState.exerciseDatabase || [];
    }
}

function addToManualWorkoutFromLibrary(exerciseData) {
    try {
        console.log('🎯 Adding exercise to manual workout:', exerciseData);
        
        // Parse exercise data if it's a string
        let exercise = exerciseData;
        if (typeof exerciseData === 'string') {
            exercise = JSON.parse(exerciseData);
        }
        
        // FIX: Validate current manual workout exists
        if (!currentManualWorkout) {
            console.error('No current manual workout found');
            showNotification('Error: No manual workout in progress', 'error');
            return;
        }
        
        // FIX: Ensure exercise has required fields
        if (!exercise.name && !exercise.machine) {
            console.error('Exercise missing name/machine field:', exercise);
            showNotification('Error: Exercise missing required data', 'error');
            return;
        }
        
        // Create exercise entry for manual workout with better defaults
        const exerciseEntry = {
            name: exercise.name || exercise.machine,
            bodyPart: exercise.bodyPart || 'General',
            equipmentType: exercise.equipmentType || 'Machine',
            sets: [
                { reps: exercise.reps || '', weight: exercise.weight || '', completed: false },
                { reps: exercise.reps || '', weight: exercise.weight || '', completed: false },
                { reps: exercise.reps || '', weight: exercise.weight || '', completed: false }
            ],
            notes: '',
            manuallyCompleted: false
        };
        
        // FIX: Add to manual workout with validation
        currentManualWorkout.exercises.push(exerciseEntry);
        
        console.log('✅ Bug 17 Fix: Exercise added successfully:', exerciseEntry);
        
        // Update UI
        renderManualExerciseList();
        
        // Close exercise library
        if (exerciseLibrary && exerciseLibrary.close) {
            exerciseLibrary.close();
        }
        
        // Show success message
        showNotification(`Added "${exerciseEntry.name}" to manual workout!`, 'success');
        
    } catch (error) {
        console.error('Error adding exercise to manual workout:', error);
        showNotification('Error adding exercise to manual workout', 'error');
    }
}

// BUG 20 FIX with Enhanced Debugging - Replace your current function with this
async function discardInProgressWorkout() {
    console.log('🚮 Starting discard process...', inProgressWorkout);
    
    if (!inProgressWorkout) {
        console.log('❌ No in-progress workout to discard');
        return;
    }
    
    const confirmDiscard = confirm(
        `Are you sure you want to discard your in-progress "${inProgressWorkout.workoutType}" workout? ` +
        `This will permanently delete your progress and cannot be undone.`
    );
    
    if (!confirmDiscard) {
        console.log('❌ User cancelled discard');
        return;
    }
    
    try {
        // 1. Store workout info BEFORE clearing variables
        const workoutToDelete = {
            date: inProgressWorkout.date,
            workoutType: inProgressWorkout.workoutType,
            userId: AppState.currentUser?.uid
        };
        
        console.log('📋 Workout to delete:', workoutToDelete);
        
        // 2. DELETE the workout from Firebase FIRST (this is the key fix!)
        try {
            if (workoutToDelete.userId && workoutToDelete.date) {
                console.log('🔥 Attempting Firebase deletion...');
                
                // Import Firebase delete function - Add deleteDoc to imports
                const { deleteDoc, doc, db } = await import('./core/firebase-config.js');
                
                // Delete the workout document from Firebase
                const workoutRef = doc(db, "users", workoutToDelete.userId, "workouts", workoutToDelete.date);
                await deleteDoc(workoutRef);
                
                console.log('✅ SUCCESS: Workout deleted from Firebase:', workoutToDelete.date);
            } else {
                console.log('❌ Missing userId or date for Firebase deletion:', workoutToDelete);
            }
        } catch (firebaseError) {
            console.error('❌ ERROR deleting workout from Firebase:', firebaseError);
            // Continue with cleanup even if Firebase delete fails
        }
        
        // 3. Clear the in-progress workout variables
        console.log('🧹 Clearing in-progress workout variables...');
        inProgressWorkout = null;
        showingProgressPrompt = false;
        
        // 4. Reset AppState
        console.log('🔄 Resetting AppState...');
        AppState.reset();
        
        // 5. Clear localStorage as backup
        try {
            console.log('🗑️ Clearing localStorage...');
            localStorage.removeItem('workoutData');
            localStorage.removeItem('inProgressWorkout');
            localStorage.removeItem('currentWorkout');
            localStorage.removeItem('savedWorkoutData');
        } catch (storageError) {
            console.warn('⚠️ Error clearing localStorage:', storageError);
        }
        
        // 6. Remove in-progress prompt UI
        const prompt = document.querySelector('.in-progress-prompt');
        if (prompt) {
            console.log('🗑️ Removing in-progress prompt...');
            prompt.remove();
        }
        
        // 7. Reset UI to workout selector state
        const activeWorkout = document.getElementById('active-workout');
        const workoutSelector = document.getElementById('workout-selector');
        
        if (activeWorkout) {
            activeWorkout.classList.add('hidden');
        }
        
        if (workoutSelector) {
            workoutSelector.classList.remove('hidden');
        }
        
        // 8. Clear exercise list
        const exerciseList = document.getElementById('exercise-list');
        if (exerciseList) {
            exerciseList.innerHTML = '';
        }
        
        // 9. Reset workout display elements
        const workoutTitle = document.getElementById('current-workout-title');
        if (workoutTitle) {
            workoutTitle.textContent = '';
        }
        
        const workoutMeta = document.getElementById('workout-meta');
        if (workoutMeta) {
            workoutMeta.textContent = '';
        }
        
        // 10. Clear any focused exercise displays
        const focusedElements = document.querySelectorAll('.exercise-focus');
        focusedElements.forEach(element => {
            element.classList.add('hidden');
        });
        
        // 11. Show workout selector
        showWorkoutSelector();
        
        // 12. Success notification
        showNotification('Previous workout discarded and deleted completely!', 'info');
        
        console.log('✅ COMPLETE: Bug 20 Fixed - In-progress workout fully discarded and deleted from Firebase');
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR in discardInProgressWorkout:', error);
        showNotification('Error discarding workout. Please try again.', 'error');
        
        // Emergency fallback - still try to reset basic state
        inProgressWorkout = null;
        showingProgressPrompt = false;
        AppState.reset();
        showWorkoutSelector();
    }
}

function renderExerciseLibraryForTemplate() {
    // This function is now handled by the enhanced exercise library
    // Redirect to the new system
    if (window.exerciseLibrary) {
        window.exerciseLibrary.renderExercises();
    } else {
        console.warn('Exercise library not initialized');
    }
}

function setupEventListeners() {
    // Auth
    const signInBtn = document.getElementById('google-signin-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', signInWithGoogle);
    }

    // Workout selection
    document.querySelectorAll('.workout-option').forEach(option => {
        option.addEventListener('click', () => selectWorkout(option.dataset.workout));
    });

    // Workout controls
    const changeWorkoutBtn = document.getElementById('change-workout-btn');
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');
    
    if (changeWorkoutBtn) {
        changeWorkoutBtn.addEventListener('click', showWorkoutSelector);
    }
    if (finishWorkoutBtn) {
        finishWorkoutBtn.addEventListener('click', finishWorkout);
    }

    // Global unit toggle
    document.querySelectorAll('.global-settings .unit-btn')?.forEach(btn => {
        btn.addEventListener('click', () => setGlobalUnit(btn.dataset.unit));
    });

    // Rest timer controls
    const pauseRestBtn = document.getElementById('pause-rest-btn');
    const skipRestBtn = document.getElementById('skip-rest-btn');
    
    if (pauseRestBtn) {
        pauseRestBtn.addEventListener('click', toggleRestTimer);
    }
    if (skipRestBtn) {
        skipRestBtn.addEventListener('click', skipRestTimer);
    }

    // Exercise modal
    const closeExerciseModal = document.getElementById('close-exercise-modal');
    const exerciseModal = document.getElementById('exercise-modal');
    
    if (closeExerciseModal) {
        closeExerciseModal.addEventListener('click', closeExerciseModalHandler);
    }
    if (exerciseModal) {
        exerciseModal.addEventListener('click', (e) => {
            if (e.target.id === 'exercise-modal') closeExerciseModalHandler();
        });
    }
}

// Auth functions
async function signInWithGoogle() {
    try {
        console.log('🔐 Signing in with Google...');
        const result = await signInWithPopup(auth, provider);
        console.log('✅ Signed in successfully:', result.user.email);
        showNotification('Signed in successfully!', 'success');
    } catch (error) {
        console.error('❌ Sign in error:', error);
        showNotification('Sign in failed. Please try again.', 'error');
    }
    await refreshExerciseDatabase()
    
}

function showUserInfo(user) {
    const signInBtn = document.getElementById('google-signin-btn');
    const userInfo = document.getElementById('user-info');
    
    if (signInBtn) signInBtn.classList.add('hidden');
    if (userInfo) {
        userInfo.classList.remove('hidden');
        
        // Get first name only
        const firstName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
        
        userInfo.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.875rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 24px; height: 24px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-primary); font-weight: bold; font-size: 0.75rem;">
                        ${firstName[0].toUpperCase()}
                    </div>
                    <span>Hi ${firstName}</span>
                </div>
                <button class="btn btn-secondary btn-small" onclick="signOutUser()" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        `;
    }
}

function showSignInButton() {
    const signInBtn = document.getElementById('google-signin-btn');
    const userInfo = document.getElementById('user-info');
    
    if (signInBtn) signInBtn.classList.remove('hidden');
    if (userInfo) userInfo.classList.add('hidden');
}

async function signOutUser() {
    try {
        await signOut(auth);
        showNotification('Signed out successfully', 'success');
        showWorkoutSelector();
    } catch (error) {
        console.error('❌ Sign out error:', error);
        showNotification('Sign out failed', 'error');
    }
}

async function handleUnknownWorkout(workoutData) {
    console.log('🔍 Handling unknown workout type:', workoutData.workoutType);
    
    // Check if it's a custom template that was saved
    if (AppState.currentUser) {
        try {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            const templates = await workoutManager.getUserWorkoutTemplates();
            
            // Look for a template with matching name
            const customTemplate = templates.find(t => 
                t.name === workoutData.workoutType || 
                t.id === workoutData.workoutType
            );
            
            if (customTemplate) {
                console.log('✅ Found matching custom template:', customTemplate.name);
                
                // Convert template to workout format
                const customWorkout = {
                    day: customTemplate.name,
                    exercises: customTemplate.exercises.map(ex => ({
                        machine: ex.name,
                        sets: ex.sets || 3,
                        reps: ex.reps || 10,
                        weight: ex.weight || 50,
                        video: ex.video || ''
                    }))
                };
                
                return customWorkout;
            }
        } catch (error) {
            console.error('❌ Error checking custom templates:', error);
        }
    }
    
    // If we can't find the workout, return null
    console.warn('⚠️ Could not find workout plan for:', workoutData.workoutType);
    return null;
}


// Workout functions
async function showWorkoutSelector() {
    // If we have an active workout, ask for confirmation
    if (AppState.currentWorkout && AppState.savedData.workoutType) {
        if (AppState.hasWorkoutProgress()) {
            const confirmChange = confirm(
                'You have progress on your current workout. Changing will save your progress but return you to workout selection. Continue?'
            );
            if (!confirmChange) {
                return; // User chose to stay
            }
            
            // Save current progress before switching
            await saveWorkoutData(AppState);
        }
    }
    
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const workoutManagement = document.getElementById('workout-management');
    const historySection = document.getElementById('workout-history-section'); // ADD THIS LINE
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.add('hidden');
    if (historySection) historySection.classList.add('hidden'); // ADD THIS LINE
    
    AppState.clearTimers();
    
    // Don't reset the data - keep it for re-selection
    AppState.currentWorkout = null;
    
    // Hide workout management if it was open
    hideWorkoutManagement();
    
    if (Object.keys(AppState.savedData.exercises || {}).length > 0) {
        showNotification('Workout progress saved. You can continue where you left off.', 'info');
    }
}

function startWorkoutDurationTimer() {
    // Clear any existing timer
    if (AppState.workoutDurationTimer) {
        clearInterval(AppState.workoutDurationTimer);
        AppState.workoutDurationTimer = null;
    }
    
    const updateTime = () => {
        const metaEl = document.getElementById('workout-meta');
        if (!AppState.workoutStartTime || !metaEl) return;
        
        const elapsed = Math.floor((new Date() - AppState.workoutStartTime) / 1000 / 60);
        let timeText = 'Started now';
        
        if (elapsed > 0) {
            if (elapsed >= 240) { // 4+ hours, something's wrong
                timeText = 'Started today';
            } else {
                timeText = `Started ${elapsed}m ago`;
            }
        }
        metaEl.textContent = timeText;
    };
    
    // Update immediately
    updateTime();
    
    // Set interval to update every minute
    AppState.workoutDurationTimer = setInterval(updateTime, 60000);
}

async function selectWorkout(workoutType, existingData = null, customWorkout = null) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to select a workout', 'warning');
        return;
    }

    // Check for workout conflicts (different workout in progress)
    if (inProgressWorkout && 
        inProgressWorkout.workoutType !== workoutType && 
        !existingData && 
        !showingProgressPrompt) {
        
        const shouldContinue = await showWorkoutConflictDialog(workoutType);
        if (!shouldContinue) return;
    }

    let workout;
    
    if (customWorkout) {
        workout = customWorkout;
    } else {
        // Find the workout plan
        workout = AppState.workoutPlans.find(w => w.day === workoutType);
        if (!workout) {
            showNotification('Workout plan not found', 'error');
            return;
        }
    }

    AppState.currentWorkout = workout;
    
    // Check if we have existing data for today's workout of this type
    const today = AppState.getTodayDateString();
    let dataToUse = existingData;
    
    // If no existing data passed but we have saved data for this workout type today, use it
    if (!dataToUse && AppState.savedData.workoutType === workoutType && AppState.savedData.date === today) {
        dataToUse = AppState.savedData;
        console.log('🔄 Resuming existing workout data for', workoutType);
    }
    
    // Load existing data or start fresh
    if (dataToUse && dataToUse.workoutType === workoutType) {
        AppState.savedData = dataToUse;
        AppState.workoutStartTime = dataToUse.startTime ? new Date(dataToUse.startTime) : new Date();
        
        // Restore exercise units from saved data
        if (dataToUse.exerciseUnits) {
            AppState.exerciseUnits = dataToUse.exerciseUnits;
        } else {
            // Initialize with global unit
            AppState.currentWorkout.exercises.forEach((exercise, index) => {
                AppState.exerciseUnits[index] = AppState.globalUnit;
            });
        }
        
        console.log('📊 Loaded existing workout data with', Object.keys(AppState.savedData.exercises || {}).length, 'exercises');
    } else {
        // Start completely fresh
        AppState.savedData = {
            workoutType: workoutType,
            date: today,
            startTime: new Date().toISOString(),
            exercises: {},
            exerciseUnits: {}
        };
        AppState.workoutStartTime = new Date();
        
        // Initialize exercise units
        AppState.currentWorkout.exercises.forEach((exercise, index) => {
            AppState.exerciseUnits[index] = AppState.globalUnit;
        });
        
        console.log('🆕 Starting fresh workout for', workoutType);
    }

    // Clear any in-progress state since we're starting/continuing a workout
    inProgressWorkout = AppState.savedData;
    showingProgressPrompt = false;
    
    // Remove any prompts
    const prompt = document.querySelector('.in-progress-prompt');
    if (prompt) prompt.remove();

    // Save the workout selection
    await saveWorkoutData(AppState);

    // Update UI
    updateWorkoutDisplay(workoutType);
    document.getElementById('workout-selector')?.classList.add('hidden');
    document.getElementById('active-workout')?.classList.remove('hidden');
    
    renderExercises();
    startWorkoutDurationTimer();

    const progressMessage = (dataToUse && Object.keys(dataToUse.exercises || {}).length > 0) ? 
        'Continuing your workout!' : 
        `${workoutType} workout started!`;
    
    showNotification(progressMessage, 'success');
}

// NEW FUNCTION: Show workout conflict dialog


// NEW FUNCTION: Add cancel workout button to active workout
function addCancelWorkoutButton() {
    const workoutActions = document.querySelector('.workout-actions');
    if (!workoutActions) return;
    
    // Check if cancel button already exists
    const existingCancel = workoutActions.querySelector('.cancel-workout-btn');
    if (existingCancel) return;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary cancel-workout-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    cancelBtn.onclick = cancelCurrentWorkout;
    
    // Insert before the finish button
    const finishBtn = document.getElementById('finish-workout-btn');
    if (finishBtn) {
        workoutActions.insertBefore(cancelBtn, finishBtn);
    } else {
        workoutActions.appendChild(cancelBtn);
    }
}

// NEW FUNCTION: Cancel current workout
async function cancelCurrentWorkout() {
    if (!AppState.currentWorkout || !AppState.currentUser) return;

    const hasProgress = AppState.hasWorkoutProgress();
    
    let confirmMessage = 'Cancel this workout?';
    if (hasProgress) {
        confirmMessage = 'Cancel this workout? You have progress that will be lost and cannot be recovered.';
    }

    if (!confirm(confirmMessage)) return;

    try {
        // Mark as cancelled
        const cancelledData = {
            ...AppState.savedData,
            cancelledAt: new Date().toISOString(),
            status: 'cancelled'
        };
        
        await saveWorkoutData({ ...AppState, savedData: cancelledData });
        
        // Clear state
        AppState.reset();
        inProgressWorkout = null;
        showingProgressPrompt = false;
        
        showNotification('Workout cancelled', 'info');
        showWorkoutSelector();
        
    } catch (error) {
        console.error('Error cancelling workout:', error);
        showNotification('Error cancelling workout. Please try again.', 'error');
    }
}

// HELPER FUNCTIONS
function countProgressSets(workoutData) {
    if (!workoutData || !workoutData.exercises) {
        return { completed: 0, total: 0 };
    }
    
    let completed = 0;
    let total = 0;
    
    // Find the workout plan to get total sets
    const workout = AppState.workoutPlans?.find(w => w.day === workoutData.workoutType);
    if (workout) {
        workout.exercises.forEach((exercise, index) => {
            total += exercise.sets;
            const exerciseData = workoutData.exercises[`exercise_${index}`];
            if (exerciseData && exerciseData.sets) {
                const completedSets = exerciseData.sets.filter(set => set && set.reps && set.weight).length;
                completed += completedSets;
            }
        });
    }
    
    return { completed, total };
}

function getWorkoutAge(startTime) {
    if (!startTime) return 'recently';
    
    const start = new Date(startTime);
    const now = new Date();
    const diffMinutes = Math.floor((now - start) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return 'yesterday';
}

async function finishCurrentWorkoutQuiet() {
    if (!inProgressWorkout) return;
    
    const finishData = {
        ...inProgressWorkout,
        completedAt: new Date().toISOString(),
        totalDuration: Math.floor((new Date() - new Date(inProgressWorkout.startTime)) / 1000)
    };
    
    await saveWorkoutData({ ...AppState, savedData: finishData });
    inProgressWorkout = null;
    AppState.reset();
}

async function discardCurrentWorkoutQuiet() {
    if (!inProgressWorkout) return;
    
    const discardData = {
        ...inProgressWorkout,
        discardedAt: new Date().toISOString(),
        status: 'discarded'
    };
    
    await saveWorkoutData({ ...AppState, savedData: discardData });
    inProgressWorkout = null;
    AppState.reset();
}


function updateWorkoutDisplay(workoutName) {
    const titleEl = document.getElementById('current-workout-title');
    const metaEl = document.getElementById('workout-meta');
    
    if (titleEl) titleEl.textContent = workoutName;
    
    // Simple elapsed time display
    const updateTime = () => {
        if (!AppState.workoutStartTime || !metaEl) return;
        const elapsed = Math.floor((new Date() - AppState.workoutStartTime) / 1000 / 60);
        let timeText = 'Started now';
        if (elapsed > 0) {
            if (elapsed >= 240) { // 4+ hours, something's wrong
                timeText = 'Started today';
            } else {
                timeText = `Started ${elapsed}m ago`;
            }
        }
        metaEl.textContent = timeText;
    };
    
    updateTime();
    clearInterval(AppState.workoutDurationTimer);
    AppState.workoutDurationTimer = setInterval(updateTime, 60000); // Update every minute
    
    updateProgress(AppState);
    
    // Add cancel button
    addCancelWorkoutButton();
}

async function finishWorkout() {
    if (!AppState.currentWorkout || !AppState.currentUser) return;

    if (!confirm('Finish this workout?')) return;

    // Stop duration timer
    AppState.clearTimers();

    // Update saved data with completion info
    AppState.savedData.completedAt = new Date().toISOString();
    AppState.savedData.totalDuration = Math.floor((new Date() - AppState.workoutStartTime) / 1000);
    
    // Save final data
    await saveWorkoutData(AppState);

    showNotification('Workout completed! Great job! 💪', 'success');
    showWorkoutSelector();
    
    // Reset state
    AppState.reset();
}

// Exercise rendering and management
function renderExercises() {
    const container = document.getElementById('exercise-list');
    if (!container || !AppState.currentWorkout) return;
    
    container.innerHTML = '';

    // BUG 14 FIX: Add single "Add Exercise" button at the top
    const addExerciseHeader = document.createElement('div');
    addExerciseHeader.className = 'add-exercise-header';
    addExerciseHeader.innerHTML = `
        <button class="btn btn-primary" onclick="addExerciseToActiveWorkout()" title="Add new exercise to workout">
            <i class="fas fa-plus"></i> Add Exercise
        </button>
    `;
    container.appendChild(addExerciseHeader);

    // Render each exercise card
    AppState.currentWorkout.exercises.forEach((exercise, index) => {
        const card = createExerciseCard(exercise, index);
        container.appendChild(card);
    });
    
    // Show empty state if no exercises
    if (AppState.currentWorkout.exercises.length === 0) {
        container.innerHTML += `
            <div class="empty-workout-message">
                <i class="fas fa-dumbbell"></i>
                <h3>No exercises in this workout</h3>
                <p>Add some exercises to get started!</p>
            </div>
        `;
    }
    
    updateProgress(AppState);
}

function createExerciseCard(exercise, index) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.index = index;

    const unit = AppState.exerciseUnits[index] || AppState.globalUnit;
    const savedSets = AppState.savedData.exercises?.[`exercise_${index}`]?.sets || [];
    
    // Check if completed
    const exerciseData = AppState.savedData.exercises?.[`exercise_${index}`];
    const completedSets = savedSets.filter(set => set && set.reps && set.weight).length;
    const isCompleted = exerciseData?.manuallyCompleted || completedSets === exercise.sets;
    
    if (isCompleted) {
        card.classList.add('completed');
    }

    // BUG 15 FIX: Replace swap button with delete button, remove individual add buttons
    card.innerHTML = `
        <div class="exercise-header">
            <h3 class="exercise-title">${exercise.machine}</h3>
            <div class="exercise-actions">
                <button class="btn btn-danger btn-small" onclick="deleteExerciseFromWorkout(${index})" title="Delete this exercise">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="exercise-focus-btn" onclick="focusExercise(${index})" title="Focus on this exercise">
                    <i class="fas fa-expand"></i>
                </button>
            </div>
        </div>
        <div class="exercise-preview">
            ${generateSetPreview(exercise, index, unit)}
        </div>
    `;

    return card;
}


function generateSetPreview(exercise, exerciseIndex, unit) {
    const sets = AppState.savedData.exercises?.[`exercise_${exerciseIndex}`]?.sets || [];
    let preview = '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">';
    
    for (let i = 0; i < exercise.sets; i++) {
        const set = sets[i] || {};
        const completed = set.reps && set.weight;
        const bgColor = completed ? 'var(--success)' : 'var(--bg-tertiary)';
        const textColor = completed ? 'white' : 'var(--text-secondary)';
        
        const displayWeight = set.weight || convertWeight(exercise.weight, 'lbs', unit);
        
        preview += `
            <div style="background: ${bgColor}; color: ${textColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                Set ${i + 1}: ${set.reps || exercise.reps} × ${displayWeight} ${unit}
            </div>
        `;
    }
    
    preview += '</div>';
    return preview;
}

async function deleteExerciseFromWorkout(exerciseIndex) {
    if (!AppState.currentWorkout || !AppState.currentWorkout.exercises[exerciseIndex]) {
        showNotification('Exercise not found', 'error');
        return;
    }

    const exercise = AppState.currentWorkout.exercises[exerciseIndex];
    
    // REMOVED: No more popup confirmation
    // Just delete directly
    
    try {
        // Remove exercise from workout
        AppState.currentWorkout.exercises.splice(exerciseIndex, 1);
        
        // Clean up saved data for exercises that come after this one
        const exerciseKeys = Object.keys(AppState.savedData.exercises || {});
        const newExerciseData = {};
        
        exerciseKeys.forEach(key => {
            const match = key.match(/exercise_(\d+)/);
            if (match) {
                const oldIndex = parseInt(match[1]);
                if (oldIndex < exerciseIndex) {
                    // Keep exercises before the deleted one
                    newExerciseData[key] = AppState.savedData.exercises[key];
                } else if (oldIndex > exerciseIndex) {
                    // Shift exercises after the deleted one down by 1
                    const newKey = `exercise_${oldIndex - 1}`;
                    newExerciseData[newKey] = AppState.savedData.exercises[key];
                }
                // Skip the deleted exercise (oldIndex === exerciseIndex)
            }
        });
        
        AppState.savedData.exercises = newExerciseData;
        
        // FIXED: Handle exerciseUnits properly (it might be an object, not array)
        if (AppState.exerciseUnits) {
            if (Array.isArray(AppState.exerciseUnits)) {
                // If it's an array, use splice
                AppState.exerciseUnits.splice(exerciseIndex, 1);
            } else {
                // If it's an object, reindex it
                const newUnits = {};
                Object.keys(AppState.exerciseUnits).forEach(key => {
                    const index = parseInt(key);
                    if (index < exerciseIndex) {
                        newUnits[index] = AppState.exerciseUnits[key];
                    } else if (index > exerciseIndex) {
                        newUnits[index - 1] = AppState.exerciseUnits[key];
                    }
                    // Skip the deleted exercise index
                });
                AppState.exerciseUnits = newUnits;
            }
        }
        
        // Re-render the exercise list
        renderExercises();
        
        showNotification(`Deleted "${exercise.machine}" from workout`, 'success');
        
    } catch (error) {
        console.error('Error deleting exercise:', error);
        showNotification('Failed to delete exercise', 'error');
    }
}

async function swapExercise(exerciseIndex) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to swap exercises', 'warning');
        return;
    }
    
    await exerciseLibrary.openForSwap(exerciseIndex);
}

// NEW CONTEXT-AWARE CARD CREATION
function createExerciseCardForContext(exercise) {
    const card = document.createElement('div');
    card.className = 'library-exercise-card';
    
    let actionButton = '';
    
    if (currentExerciseLibraryContext === 'swap') {
        actionButton = `
            <button class="btn btn-primary btn-small" onclick="confirmExerciseSwap('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-exchange-alt"></i> Swap
            </button>
        `;
    } else if (currentExerciseLibraryContext === 'template') {
        actionButton = `
            <button class="btn btn-primary btn-small" onclick="addExerciseToTemplateFromLibrary('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-plus"></i> Add to Template
            </button>
        `;
    }
    
    card.innerHTML = `
        <h5>${exercise.name || exercise.machine}</h5>
        <div class="library-exercise-info">
            ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
            ${exercise.isCustom ? ' • Custom' : ''}
        </div>
        <div class="library-exercise-stats">
            ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
        </div>
        <div style="margin-top: 0.5rem;">
            ${actionButton}
        </div>
    `;
    
    return card;
}

function renderExerciseLibraryForSwap(exercises) {
    const grid = document.getElementById('exercise-library-grid');
    if (!grid) return;
    
    // Update modal title to indicate swap mode
    const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = `Swap Exercise: ${AppState.currentWorkout.exercises[AppState.swappingExerciseIndex].machine}`;
    }
    
    if (exercises.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Exercises Found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    exercises.forEach(exercise => {
        const card = createSwapExerciseCard(exercise);
        grid.appendChild(card);
    });
}

function createSwapExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = 'library-exercise-card';
    
    card.innerHTML = `
        <h5>${exercise.name || exercise.machine}</h5>
        <div class="library-exercise-info">
            ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
            ${exercise.isCustom ? ' • Custom' : ''}
        </div>
        <div class="library-exercise-stats">
            ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
        </div>
        <div style="margin-top: 0.5rem;">
            <button class="btn btn-primary btn-small" onclick="confirmExerciseSwap('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-exchange-alt"></i> Swap
            </button>
        </div>
    `;
    
    return card;
}

async function confirmExerciseSwap(exerciseName, exerciseData) {
    if (AppState.swappingExerciseIndex === null || AppState.swappingExerciseIndex === undefined) return;
    
    const exerciseIndex = AppState.swappingExerciseIndex;
    const oldExercise = AppState.currentWorkout.exercises[exerciseIndex];
    
    // Parse the exercise data (it comes as HTML-encoded JSON)
    let newExercise;
    try {
        newExercise = typeof exerciseData === 'string' ? JSON.parse(exerciseData) : exerciseData;
    } catch (e) {
        console.error('Error parsing exercise data:', e);
        return;
    }
    
    // Update the workout
    AppState.currentWorkout.exercises[exerciseIndex] = {
        machine: newExercise.name || newExercise.machine,
        sets: newExercise.sets || 3,
        reps: newExercise.reps || 10,
        weight: newExercise.weight || 50,
        video: newExercise.video || ''
    };
    
    // Clear any existing data for this exercise since it's different now
    if (AppState.savedData.exercises && AppState.savedData.exercises[`exercise_${exerciseIndex}`]) {
        AppState.savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    // Save the change
    await saveWorkoutData(AppState);
    
    // Update UI
    renderExercises();
    closeExerciseLibraryEnhanced();
    
    // Reset swapping state
    AppState.swappingExerciseIndex = null;
    
    showNotification(`Swapped "${oldExercise.machine}" → "${newExercise.name || newExercise.machine}"`, 'success');
}

function focusExercise(index) {
    if (!AppState.currentWorkout) return;
    
    AppState.focusedExerciseIndex = index;
    const exercise = AppState.currentWorkout.exercises[index];
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('modal-exercise-title');
    const content = document.getElementById('modal-exercise-content');

    if (!modal || !title || !content) return;

    title.textContent = exercise.machine;
    
    // Set up per-exercise unit toggle
    const unitToggle = modal.querySelector('.exercise-unit-toggle .unit-toggle');
    const currentUnit = AppState.exerciseUnits[index] || AppState.globalUnit;
    
    if (unitToggle) {
        // Clear existing event listeners to prevent multiplication
        const newUnitToggle = unitToggle.cloneNode(true);
        unitToggle.parentNode.replaceChild(newUnitToggle, unitToggle);
        
        newUnitToggle.innerHTML = `
            <button class="unit-btn ${currentUnit === 'lbs' ? 'active' : ''}" data-unit="lbs">lbs</button>
            <button class="unit-btn ${currentUnit === 'kg' ? 'active' : ''}" data-unit="kg">kg</button>
        `;

        // Add event listeners for this modal's unit toggle
        newUnitToggle.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                setExerciseUnit(index, btn.dataset.unit);
            });
        });
    }

    content.innerHTML = generateExerciseTable(exercise, index, currentUnit);
    modal.classList.add('active');
}

function generateExerciseTable(exercise, exerciseIndex, unit) {
    const savedSets = AppState.savedData.exercises?.[`exercise_${exerciseIndex}`]?.sets || [];
    const savedNotes = AppState.savedData.exercises?.[`exercise_${exerciseIndex}`]?.notes || '';
    const convertedWeight = convertWeight(exercise.weight, 'lbs', unit);

    // Ensure we have the right number of sets
    while (savedSets.length < exercise.sets) {
        savedSets.push({ reps: '', weight: '' });
    }

    let html = `
        <!-- Exercise History Reference -->
        <div class="exercise-history-section">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
                <button class="btn btn-secondary btn-small" onclick="loadExerciseHistory('${exercise.machine}', ${exerciseIndex})">
                    <i class="fas fa-history"></i> Show Last Workout
                </button>
                ${exercise.video ? 
                    `<button class="btn btn-primary btn-small" onclick="showExerciseVideo('${exercise.video}', '${exercise.machine}')">
                        <i class="fas fa-play"></i> Form Video
                    </button>` : ''
                }
            </div>
            <div id="exercise-history-${exerciseIndex}" class="exercise-history-display hidden"></div>
        </div>

        <!-- In-Modal Rest Timer -->
        <div id="modal-rest-timer-${exerciseIndex}" class="modal-rest-timer hidden">
            <div class="modal-rest-content">
                <div class="modal-rest-exercise">Rest Period</div>
                <div class="modal-rest-display">90s</div>
                <div class="modal-rest-controls">
                    <button class="btn btn-small" onclick="toggleModalRestTimer(${exerciseIndex})">
                        <i class="fas fa-pause"></i>
                    </button>
                    <button class="btn btn-small" onclick="skipModalRestTimer(${exerciseIndex})">
                        <i class="fas fa-forward"></i>
                    </button>
                </div>
            </div>
        </div>

        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Weight (${unit})</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let i = 0; i < exercise.sets; i++) {
        const set = savedSets[i] || { reps: '', weight: '' };
        
        html += `
            <tr>
                <td>Set ${i + 1}</td>
                <td>
                    <input type="number" class="set-input" 
                           placeholder="${exercise.reps}" 
                           value="${set.reps}"
                           onchange="updateSet(${exerciseIndex}, ${i}, 'reps', this.value)">
                </td>
                <td>
                    <input type="number" class="set-input" 
                           placeholder="${convertedWeight}" 
                           value="${set.weight}"
                           onchange="updateSet(${exerciseIndex}, ${i}, 'weight', this.value)">
                </td>
            </tr>
        `;
    }

    html += `
            </tbody>
        </table>
        
        <textarea class="notes-area" placeholder="Exercise notes..." 
                  onchange="updateNotes(${exerciseIndex}, this.value)">${savedNotes}</textarea>
        
        <div class="exercise-complete-section" style="margin-top: 1rem; text-align: center;">
            <button class="btn btn-success" onclick="markExerciseComplete(${exerciseIndex})">
                <i class="fas fa-check-circle"></i> Mark Exercise Complete
            </button>
        </div>
    `;

    return html;
}

function closeExerciseModalHandler() {
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Clear any modal rest timers
    if (AppState.focusedExerciseIndex !== null) {
        clearModalRestTimer(AppState.focusedExerciseIndex);
    }
    
    AppState.focusedExerciseIndex = null;
    renderExercises(); // Refresh the main view
}

// Set and note updating - Enhanced with proper unit tracking
async function updateSet(exerciseIndex, setIndex, field, value) {
    if (!AppState.currentUser) return;
    
    console.log(`Updating set: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
    
    // Initialize data structure if needed
    if (!AppState.savedData.exercises) AppState.savedData.exercises = {};
    if (!AppState.savedData.exercises[`exercise_${exerciseIndex}`]) {
        AppState.savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    const exerciseData = AppState.savedData.exercises[`exercise_${exerciseIndex}`];
    
    // Ensure sets array is the right length
    while (exerciseData.sets.length <= setIndex) {
        exerciseData.sets.push({ reps: '', weight: '', originalWeights: { lbs: '', kg: '' } });
    }
    
    const currentUnit = AppState.exerciseUnits[exerciseIndex] || AppState.globalUnit;
    
    if (field === 'weight' && value) {
        // Store the value in current unit and calculate the other
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            if (!exerciseData.sets[setIndex].originalWeights) {
                exerciseData.sets[setIndex].originalWeights = { lbs: '', kg: '' };
            }
            
            // Store the value in the unit it was entered
            exerciseData.sets[setIndex].originalWeights[currentUnit] = numValue;
            
            // Calculate the other unit
            if (currentUnit === 'lbs') {
                exerciseData.sets[setIndex].originalWeights.kg = Math.round(numValue * 0.453592 * 10) / 10; // Round to 1 decimal
            } else {
                exerciseData.sets[setIndex].originalWeights.lbs = Math.round(numValue * 2.20462);
            }
            
            // Set the display value
            exerciseData.sets[setIndex][field] = numValue;
        }
    } else {
        exerciseData.sets[setIndex][field] = value;
    }
    
    // Save to Firebase
    await saveWorkoutData(AppState);
    
    // Start rest timer when both reps and weight are entered
    const setData = exerciseData.sets[setIndex];
    if (setData.reps && setData.weight) {
        // Check if we're in modal view
        const modal = document.getElementById('exercise-modal');
        if (modal && modal.classList.contains('active') && AppState.focusedExerciseIndex === exerciseIndex) {
            startModalRestTimer(exerciseIndex, setIndex);
        } else {
            startRestTimer(exerciseIndex, setIndex);
        }
        showNotification(`Set ${setIndex + 1} recorded! Rest timer started.`, 'success');
    }
    
    updateProgress(AppState);
}

async function updateNotes(exerciseIndex, notes) {
    if (!AppState.currentUser) return;
    
    if (!AppState.savedData.exercises) AppState.savedData.exercises = {};
    if (!AppState.savedData.exercises[`exercise_${exerciseIndex}`]) {
        AppState.savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    AppState.savedData.exercises[`exercise_${exerciseIndex}`].notes = notes;
    await saveWorkoutData(AppState);
}

async function markExerciseComplete(exerciseIndex) {
    if (!AppState.currentUser || !AppState.currentWorkout) return;
    
    const exercise = AppState.currentWorkout.exercises[exerciseIndex];
    const exerciseData = AppState.savedData.exercises?.[`exercise_${exerciseIndex}`];
    
    if (!exerciseData || !exerciseData.sets) {
        showNotification('Please complete at least one set before marking as complete', 'warning');
        return;
    }
    
    // Check if at least one set has data
    const completedSets = exerciseData.sets.filter(set => set && set.reps && set.weight);
    if (completedSets.length === 0) {
        showNotification('Please complete at least one set before marking as complete', 'warning');
        return;
    }
    
    // Mark as manually completed
    if (!AppState.savedData.exercises[`exercise_${exerciseIndex}`]) {
        AppState.savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    AppState.savedData.exercises[`exercise_${exerciseIndex}`].manuallyCompleted = true;
    AppState.savedData.exercises[`exercise_${exerciseIndex}`].completedAt = new Date().toISOString();
    
    try {
        // Force save to Firebase immediately
        await saveWorkoutData(AppState);
        console.log('✅ Exercise completion saved to Firebase');
        
        // Update UI
        checkExerciseCompletion(exerciseIndex);
        
        // Show success and close modal
        showNotification(`${exercise.machine} marked as complete! 💪`, 'success');
        closeExerciseModalHandler();
        
    } catch (error) {
        console.error('❌ Error saving exercise completion:', error);
        showNotification('Error saving completion. Please try again.', 'error');
    }
}

function checkExerciseCompletion(exerciseIndex) {
    const exercise = AppState.currentWorkout.exercises[exerciseIndex];
    const exerciseData = AppState.savedData.exercises[`exercise_${exerciseIndex}`];
    const sets = exerciseData?.sets || [];
    
    // Check if manually completed OR all sets are done
    const completedSets = sets.filter(set => set && set.reps && set.weight).length;
    const isCompleted = exerciseData?.manuallyCompleted || completedSets === exercise.sets;
    
    // Update card in main view
    const card = document.querySelector(`[data-index="${exerciseIndex}"]`);
    if (card) {
        card.classList.toggle('completed', isCompleted);
        
        // Update preview
        const unit = AppState.exerciseUnits[exerciseIndex] || AppState.globalUnit;
        const preview = card.querySelector('.exercise-preview');
        if (preview) {
            preview.innerHTML = generateSetPreview(exercise, exerciseIndex, unit);
        }
    }
}

// Unit management - FIXED to prevent multiplication and remember original values
function setGlobalUnit(unit) {
    if (AppState.globalUnit === unit) return; // No change needed
    
    AppState.globalUnit = unit;
    
    // Update global unit toggle
    document.querySelectorAll('.global-settings .unit-btn')?.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === unit);
    });
    
    // Update all exercises that don't have individual unit preferences
    if (AppState.currentWorkout) {
        AppState.currentWorkout.exercises.forEach((exercise, index) => {
            if (!AppState.exerciseUnits[index]) {
                AppState.exerciseUnits[index] = unit;
            }
        });
        
        renderExercises();
        saveWorkoutData(AppState); // Save unit preferences
    }
}

function setExerciseUnit(exerciseIndex, unit) {
    const currentUnit = AppState.exerciseUnits[exerciseIndex] || AppState.globalUnit;
    if (currentUnit === unit) return; // No change needed
    
    AppState.exerciseUnits[exerciseIndex] = unit;
    
    // Update the displayed values without conversion - use stored original values
    if (AppState.savedData.exercises && AppState.savedData.exercises[`exercise_${exerciseIndex}`]) {
        const exerciseData = AppState.savedData.exercises[`exercise_${exerciseIndex}`];
        if (exerciseData.sets) {
            exerciseData.sets.forEach(set => {
                if (set.originalWeights && set.originalWeights[unit] !== '') {
                    // Use the stored original value for this unit
                    set.weight = set.originalWeights[unit];
                } else if (set.weight && !isNaN(set.weight)) {
                    // First time switching - calculate and store
                    if (!set.originalWeights) {
                        set.originalWeights = { lbs: '', kg: '' };
                    }
                    
                    const conversionFactor = (currentUnit === 'lbs' && unit === 'kg') ? 0.453592 : 
                                            (currentUnit === 'kg' && unit === 'lbs') ? 2.20462 : 1;
                    
                    const convertedWeight = unit === 'kg' ? 
                        Math.round(set.weight * conversionFactor * 10) / 10 : // kg to 1 decimal
                        Math.round(set.weight * conversionFactor); // lbs to whole number
                    
                    // Store both values
                    set.originalWeights[currentUnit] = set.weight;
                    set.originalWeights[unit] = convertedWeight;
                    set.weight = convertedWeight;
                }
            });
        }
    }
    
    // Update modal unit toggle
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === unit);
        });
        
        // Refresh modal content with new unit
        const exercise = AppState.currentWorkout.exercises[exerciseIndex];
        const content = document.getElementById('modal-exercise-content');
        if (content) {
            content.innerHTML = generateExerciseTable(exercise, exerciseIndex, unit);
        }
    }
    
    // Refresh main view
    renderExercises();
    
    // Save unit preference
    saveWorkoutData(AppState);
    
    showNotification(`Switched to ${unit.toUpperCase()} for this exercise`, 'success');
}

// Rest Timer Functions
function startRestTimer(exerciseIndex, setIndex) {
    // Skip the sticky timer - we only use modal timer now
    console.log(`Rest timer skipped for main screen - using modal timer only`);
}

function startModalRestTimer(exerciseIndex, setIndex) {
    const exercise = AppState.currentWorkout.exercises[exerciseIndex];
    const setNumber = setIndex + 1;
    
    clearGlobalRestTimer();
    clearModalRestTimer(exerciseIndex);
    
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    const exerciseLabel = modalTimer?.querySelector('.modal-rest-exercise');
    const timerDisplay = modalTimer?.querySelector('.modal-rest-display');
    
    if (!modalTimer || !exerciseLabel || !timerDisplay) return;
    
    exerciseLabel.textContent = `Set ${setNumber} Complete - Rest Period`;
    modalTimer.classList.remove('hidden');
    
    let timeLeft = 90;
    let isPaused = false;
    let startTime = Date.now();
    let pausedTime = 0;
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    const checkTime = () => {
        if (isPaused) return;
        
        const elapsed = Math.floor((Date.now() - startTime - pausedTime) / 1000);
        timeLeft = Math.max(0, 90 - elapsed);
        
        updateDisplay();
        
        if (timeLeft === 0) {
            timerDisplay.textContent = 'Ready!';
            timerDisplay.style.color = 'var(--success)';
            
            // Vibration and notification
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            
            // Show notification even if page is hidden
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Rest complete!', {
                    body: 'Time for your next set 💪',
                    icon: '/BigSurf.png'
                });
            }
            
            showNotification('Rest period complete! 💪', 'success');
            
            setTimeout(() => {
                modalTimer.classList.add('hidden');
                timerDisplay.style.color = 'var(--primary)';
            }, 5000);
            
            return;
        }
    };
    
    updateDisplay();
    
    // Use requestAnimationFrame for better performance
    const timerLoop = () => {
        checkTime();
        if (timeLeft > 0) {
            modalTimer.timerData.animationFrame = requestAnimationFrame(timerLoop);
        }
    };
    
    modalTimer.timerData = {
        animationFrame: requestAnimationFrame(timerLoop),
        
        pause: () => {
            isPaused = !isPaused;
            if (isPaused) {
                pausedTime += Date.now() - startTime;
            } else {
                startTime = Date.now();
            }
            const pauseBtn = modalTimer.querySelector('.modal-rest-controls .btn:first-child');
            if (pauseBtn) {
                pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            }
        },
        
        skip: () => {
            if (modalTimer.timerData.animationFrame) {
                cancelAnimationFrame(modalTimer.timerData.animationFrame);
            }
            modalTimer.classList.add('hidden');
            timerDisplay.style.color = 'var(--primary)';
        }
    };
    
    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function toggleRestTimer() {
    if (AppState.globalRestTimer) {
        AppState.globalRestTimer.pause();
    }
}

function skipRestTimer() {
    if (AppState.globalRestTimer) {
        AppState.globalRestTimer.skip();
        AppState.globalRestTimer = null;
    }
}

function toggleModalRestTimer(exerciseIndex) {
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    if (modalTimer && modalTimer.timerData) {
        modalTimer.timerData.pause();
    }
}

function skipModalRestTimer(exerciseIndex) {
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    if (modalTimer && modalTimer.timerData) {
        modalTimer.timerData.skip();
    }
}

function clearGlobalRestTimer() {
    if (AppState.globalRestTimer) {
        clearInterval(AppState.globalRestTimer.interval);
        AppState.globalRestTimer = null;
    }
    const stickyTimer = document.getElementById('rest-timer-sticky');
    const timerDisplay = document.getElementById('rest-timer-display');
    if (stickyTimer) stickyTimer.classList.remove('active');
    if (timerDisplay) timerDisplay.style.color = 'var(--primary)';
}

function clearModalRestTimer(exerciseIndex) {
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    if (modalTimer && modalTimer.timerData) {
        if (modalTimer.timerData.animationFrame) {
            cancelAnimationFrame(modalTimer.timerData.animationFrame);
        }
        modalTimer.timerData = null;
        modalTimer.classList.add('hidden');
    }
}

function closeExerciseLibraryEnhanced() {
    if (exerciseLibrary) {
        exerciseLibrary.close();
    }
}

// Template Selection System
function initializeEnhancedWorkoutSelector() {
    renderWorkoutTypes();
}

function renderWorkoutTypes() {
    const grid = document.getElementById('workout-type-grid');
    if (!grid) return;
    
    const workoutTypes = [
        {
            type: 'Push',
            icon: 'fa-hand-paper',
            title: 'Push Workouts',
            description: 'Chest, Shoulders, Triceps'
        },
        {
            type: 'Pull', 
            icon: 'fa-hand-rock',
            title: 'Pull Workouts',
            description: 'Back, Biceps, Rear Delts'
        },
        {
            type: 'Legs',
            icon: 'fa-walking',
            title: 'Leg Workouts',
            description: 'Quads, Glutes, Hamstrings, Calves'
        },
        {
            type: 'Cardio',
            icon: 'fa-heartbeat', 
            title: 'Cardio & Core',
            description: 'Heart Health, Core Strength'
        },
        {
            type: 'Other',
            icon: 'fa-dumbbell',
            title: 'Other Workouts',
            description: 'Full Body, Mixed Training'
        }
    ];
    
    grid.innerHTML = '';
    workoutTypes.forEach(type => {
        const card = document.createElement('div');
        card.className = 'workout-option';
        card.onclick = () => showTemplateSelection(type.type);
        
        card.innerHTML = `
            <i class="fas ${type.icon}"></i>
            <div>
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${type.title}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${type.description}</div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

async function showTemplateSelection(workoutType) {
    selectedWorkoutCategory = workoutType;
    const modal = document.getElementById('template-selection-modal');
    const title = document.getElementById('template-modal-title');
    
    if (!modal || !title) return;
    
    title.textContent = `Choose ${workoutType} Template`;
    modal.classList.remove('hidden');
    
    await loadTemplatesForCategory(workoutType);
}

async function loadTemplatesForCategory(category) {
    const grid = document.getElementById('template-selection-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading templates...</span></div>';
    
    try {
        // Get default templates for this category
        const defaultTemplates = AppState.workoutPlans.filter(w => 
            getWorkoutCategory(w.day).toLowerCase() === category.toLowerCase()
        );
        
        // Get custom templates for this category
        let customTemplates = [];
        if (AppState.currentUser) {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            const allCustom = await workoutManager.getUserWorkoutTemplates();
            customTemplates = allCustom.filter(t => t.category === category);
        }
        
        const allTemplates = [
            ...defaultTemplates.map(t => ({ ...t, isDefault: true, id: t.day })),
            ...customTemplates.map(t => ({ ...t, isDefault: false }))
        ];
        
        if (allTemplates.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No Templates Found</h3>
                    <p>No templates available for ${category}. Create your first one!</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = '';
        allTemplates.forEach(template => {
            const card = createTemplateSelectionCard(template);
            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading templates:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Templates</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

function createTemplateSelectionCard(template) {
    const card = document.createElement('div');
    card.className = `template-card ${template.isDefault ? 'default' : 'custom'}`;
    
    const exerciseCount = template.exercises?.length || 0;
    const exercisePreview = template.exercises?.slice(0, 3).map(ex => 
        ex.name || ex.machine
    ).join(', ') || 'No exercises';
    const moreText = exerciseCount > 3 ? ` and ${exerciseCount - 3} more...` : '';
    
    card.innerHTML = `
        <h4>${template.name || template.day}</h4>
        <div class="template-description">
            ${exerciseCount} exercises: ${exercisePreview}${moreText}
        </div>
        <div class="template-actions">
            <button class="btn btn-primary btn-small" onclick="selectTemplate('${template.id || template.day}', ${template.isDefault})">
                <i class="fas fa-play"></i> Start Workout
            </button>
            ${!template.isDefault ? 
                `<button class="btn btn-secondary btn-small" onclick="editTemplate('${template.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>` : 
                `<button class="btn btn-secondary btn-small" onclick="customizeDefaultTemplate('${template.day}')">
                    <i class="fas fa-copy"></i> Customize
                </button>`
            }
        </div>
    `;
    
    return card;
}

async function selectTemplate(templateId, isDefault) {
    let workout;
    
    if (isDefault) {
        workout = AppState.workoutPlans.find(w => w.day === templateId);
    } else {
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (template) {
            // Convert custom template to workout format
            workout = {
                day: template.name,
                exercises: template.exercises.map(ex => ({
                    machine: ex.name,
                    sets: ex.sets || 3,
                    reps: ex.reps || 10,
                    weight: ex.weight || 50,
                    video: ex.video || ''
                }))
            };
        }
    }
    
    if (!workout) {
        showNotification('Template not found', 'error');
        return;
    }
    
    closeTemplateSelection();
    selectWorkout(workout.day, null, workout);
}

function closeTemplateSelection() {
    const modal = document.getElementById('template-selection-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    selectedWorkoutCategory = null;
}

async function customizeDefaultTemplate(templateDay) {
    const template = AppState.workoutPlans.find(w => w.day === templateDay);
    if (!template) return;
    
    closeTemplateSelection();
    
    // Create a custom template based on the default
    const customTemplate = {
        name: `My ${template.day}`,
        category: getWorkoutCategory(template.day),
        exercises: template.exercises.map(ex => ({
            name: ex.machine,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            video: ex.video || ''
        }))
    };
    
    // Show template editor with this data
    showTemplateEditorWithData(customTemplate);
}

// Enhanced Exercise Video Functions
function convertYouTubeUrl(url) {
    if (!url) return '';
    
    // Handle different YouTube URL formats
    let videoId = '';
    
    if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('youtube.com/watch?v=')[1].split('&')[0];
    } else if (url.includes('youtube.com/embed/')) {
        return url; // Already in embed format
    }
    
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    return url; // Return original if not a YouTube URL
}

function showExerciseVideo(videoUrl, exerciseName) {
    const videoSection = document.getElementById('exercise-video-section');
    const iframe = document.getElementById('exercise-video-iframe');
    
    if (!videoSection || !iframe) return;
    
    const embedUrl = convertYouTubeUrl(videoUrl);
    
    // Check if it's a valid URL (not a placeholder)
    if (!embedUrl || embedUrl.includes('example') || embedUrl === videoUrl && !embedUrl.includes('youtube')) {
        showNotification('No form video available for this exercise', 'info');
        return;
    }
    
    iframe.src = embedUrl;
    videoSection.classList.remove('hidden');
    
    showNotification(`Showing form video for ${exerciseName}`, 'success');
}

function hideExerciseVideo() {
    const videoSection = document.getElementById('exercise-video-section');
    const iframe = document.getElementById('exercise-video-iframe');
    
    if (videoSection) videoSection.classList.add('hidden');
    if (iframe) iframe.src = '';
}

// Quick Add Exercise Functions
function showQuickAddExercise() {
    const section = document.getElementById('quick-add-section');
    if (section) {
        section.classList.remove('hidden');
    }
}

function hideQuickAddExercise() {
    const section = document.getElementById('quick-add-section');
    if (section) {
        section.classList.add('hidden');
        // Clear form
        const nameInput = document.getElementById('quick-exercise-name');
        if (nameInput) nameInput.value = '';
    }
}

async function quickAddExercise() {
    const name = document.getElementById('quick-exercise-name')?.value.trim();
    const bodyPart = document.getElementById('quick-body-part')?.value;
    const equipment = document.getElementById('quick-equipment')?.value;
    
    if (!name) {
        showNotification('Please enter an exercise name', 'warning');
        return;
    }
    
    const exerciseData = {
        name,
        machine: name,
        bodyPart,
        equipmentType: equipment,
        tags: [bodyPart.toLowerCase(), equipment.toLowerCase()],
        sets: 3,
        reps: 10,
        weight: 50,
        video: ''
    };
    
    try {
        // Save to library first if user is signed in
        if (AppState.currentUser) {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            await workoutManager.createExercise(exerciseData);
        }
        
        // Handle different contexts
        if (AppState.swappingExerciseIndex !== null && AppState.swappingExerciseIndex !== undefined) {
            // Swap mode
            await confirmExerciseSwap(name, exerciseData);
            hideQuickAddExercise();
            return;
        } else if (AppState.addingExerciseToWorkout) {
            // Adding to active workout
            await confirmExerciseAddToWorkout(name, exerciseData);
            hideQuickAddExercise();
            return;
        } else if (currentEditingTemplate) {
            // Adding to template being edited
            const templateExercise = {
                name: exerciseData.name,
                bodyPart: exerciseData.bodyPart,
                equipmentType: exerciseData.equipmentType,
                sets: exerciseData.sets,
                reps: exerciseData.reps,
                weight: exerciseData.weight,
                video: exerciseData.video
            };
            
            currentEditingTemplate.exercises = currentEditingTemplate.exercises || [];
            currentEditingTemplate.exercises.push(templateExercise);
            
            // Immediately refresh template editor
            renderTemplateEditorExercises();
            hideQuickAddExercise();
            closeExerciseLibraryForTemplate();
            
            showNotification(`Added "${name}" to template and library!`, 'success');
            return;
        }
        
        // Default: just add to library
        showNotification(`Exercise "${name}" added to library!`, 'success');
        hideQuickAddExercise();
        
        // Refresh library if open
        const modal = document.getElementById('exercise-library-modal');
        if (modal && !modal.classList.contains('hidden')) {
            // Refresh the exercise library display
            if (exerciseLibrary && exerciseLibrary.refresh) {
                await exerciseLibrary.refresh();
            }
        }
        
    } catch (error) {
        console.error('Error adding exercise:', error);
        showNotification('Failed to add exercise', 'error');
    }
}

// Template Management Functions
function showCreateTemplateModal() {
    const modal = document.getElementById('create-template-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeCreateTemplateModal() {
    const modal = document.getElementById('create-template-modal');
    const form = document.getElementById('create-template-form');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

async function createTemplate(event) {
    event.preventDefault();
    
    const name = document.getElementById('template-name')?.value.trim();
    const category = document.getElementById('template-category')?.value;
    const type = document.getElementById('template-type')?.value;
    const description = document.getElementById('template-description')?.value.trim();
    
    if (!name) {
        showNotification('Please enter a template name', 'warning');
        return;
    }
    
    const templateData = {
        name,
        category,
        type,
        description,
        exercises: []
    };
    
    closeCreateTemplateModal();
    showTemplateEditorWithData(templateData);
}

// Show Template Editor with Data
function showTemplateEditorWithData(templateData) {
    currentEditingTemplate = templateData;
    isEditingMode = true;
    
    // Hide other sections
    document.getElementById('workout-selector')?.classList.add('hidden');
    document.getElementById('active-workout')?.classList.add('hidden');
    document.getElementById('workout-management')?.classList.add('hidden');
    
    // Show template editor
    const editorSection = document.getElementById('template-editor-section');
    if (editorSection) {
        editorSection.classList.remove('hidden');
    } else {
        // Create template editor if it doesn't exist
        createTemplateEditorSection();
    }
    
    populateTemplateEditor();
}

function switchTemplateCategory(category) {
    currentTemplateCategory = category;
    
    // Update tab appearance
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });
    
    // Show/hide content
    document.getElementById('default-templates')?.classList.toggle('hidden', category !== 'default');
    document.getElementById('custom-templates')?.classList.toggle('hidden', category !== 'custom');
    
    // Load templates for this category
    loadTemplatesByCategory(category);
}

async function loadTemplatesByCategory(category) {
    const container = document.getElementById(`${category}-templates`);
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading templates...</span></div>';
    
    try {
        if (category === 'default') {
            // Load default templates (from workouts.json)
            const templates = AppState.workoutPlans || [];
            renderTemplatesInContainer(container, templates, true);
        } else {
            // Load custom templates (from Firebase)
            if (!AppState.currentUser) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-sign-in-alt"></i>
                        <h3>Sign In Required</h3>
                        <p>Please sign in to view your custom templates.</p>
                    </div>
                `;
                return;
            }
            
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            const templates = await workoutManager.getUserWorkoutTemplates();
            renderTemplatesInContainer(container, templates, false);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Templates</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

function renderTemplatesInContainer(container, templates, isDefault) {
    if (templates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No Templates Found</h3>
                <p>${isDefault ? 'No default templates available.' : 'Create your first custom template!'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    templates.forEach(template => {
        const card = createManagementTemplateCard(template, isDefault);
        container.appendChild(card);
    });
}

function createManagementTemplateCard(template, isDefault) {
    const card = document.createElement('div');
    card.className = 'template-card';
    
    const exerciseCount = template.exercises?.length || 0;
    const exercisePreview = template.exercises?.slice(0, 3).map(ex => 
        ex.name || ex.machine
    ).join(', ') || 'No exercises';
    const moreText = exerciseCount > 3 ? ` and ${exerciseCount - 3} more...` : '';
    
    card.innerHTML = `
        <h4>${template.name || template.day}</h4>
        <div class="template-category">${getWorkoutCategory(template.day || template.category)}</div>
        <div class="template-exercises-preview">
            ${exerciseCount} exercises: ${exercisePreview}${moreText}
        </div>
        <div class="template-actions">
            <button class="btn btn-primary btn-small" onclick="useTemplateFromManagement('${template.id || template.day}', ${isDefault})">
                <i class="fas fa-play"></i> Use Today
            </button>
            <button class="btn btn-secondary btn-small" onclick="${isDefault ? `customizeDefaultTemplate('${template.day}')` : `editTemplate('${template.id}')`}">
                <i class="fas fa-${isDefault ? 'copy' : 'edit'}"></i> ${isDefault ? 'Customize' : 'Edit'}
            </button>
            ${!isDefault ? 
                `<button class="btn btn-danger btn-small" onclick="deleteTemplate('${template.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>` : ''
            }
        </div>
    `;
    
    return card;
}

async function useTemplateFromManagement(templateId, isDefault) {
    // Hide management and go to workout
    hideWorkoutManagement();
    await selectTemplate(templateId, isDefault);
}

// Utility function to get workout category
function getWorkoutCategory(workoutName) {
    if (!workoutName) return 'Other';
    const name = workoutName.toLowerCase();
    if (name.includes('chest') || name.includes('push')) return 'Push';
    if (name.includes('back') || name.includes('pull')) return 'Pull';
    if (name.includes('legs') || name.includes('leg')) return 'Legs';
    if (name.includes('cardio') || name.includes('core')) return 'Cardio';
    return 'Other';
}

// Create Template Editor Section
function createTemplateEditorSection() {
    const container = document.querySelector('.app-container');
    
    const editorHTML = `
        <div id="template-editor-section" class="template-editor-section">
            <div class="editor-header">
                <div class="editor-title-section">
                    <h2 id="editor-title">Edit Template</h2>
                    <p id="editor-subtitle">Customize your workout template</p>
                </div>
                <div class="editor-actions">
                    <button class="btn btn-secondary" onclick="cancelTemplateEditor()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn btn-success" onclick="saveTemplateFromEditor()">
                        <i class="fas fa-save"></i> Save Template
                    </button>
                </div>
            </div>

            <div class="template-editor-content">
                <!-- Template Info -->
                <div class="template-info-section">
                    <h3>Template Information</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editor-template-name">Template Name *</label>
                            <input type="text" id="editor-template-name" class="form-input" 
                                   placeholder="e.g., My Chest & Triceps Workout" required>
                        </div>
                        <div class="form-group">
                            <label for="editor-template-category">Category</label>
                            <select id="editor-template-category" class="form-input">
                                <option value="Push">Push (Chest, Shoulders, Triceps)</option>
                                <option value="Pull">Pull (Back, Biceps)</option>
                                <option value="Legs">Legs (Quads, Glutes, Hamstrings)</option>
                                <option value="Cardio">Cardio & Core</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editor-template-description">Description (optional)</label>
                        <textarea id="editor-template-description" class="form-input" rows="2" 
                                  placeholder="Brief description of this workout..."></textarea>
                    </div>
                </div>

                <!-- Exercise List -->
                <div class="template-exercises-section">
                    <div class="exercises-header">
                        <h3>Exercises</h3>
                        <button class="btn btn-success" onclick="addExerciseToCurrentTemplate()">
                            <i class="fas fa-plus"></i> Add Exercise
                        </button>
                    </div>
                    <div id="template-editor-exercises" class="template-editor-exercises">
                        <!-- Exercises will be populated here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', editorHTML);
}

// Populate Template Editor with Data
function populateTemplateEditor() {
    if (!currentEditingTemplate) return;
    
    // Set title
    const title = document.getElementById('editor-title');
    const subtitle = document.getElementById('editor-subtitle');
    if (title) title.textContent = currentEditingTemplate.id ? 'Edit Template' : 'Create Template';
    if (subtitle) subtitle.textContent = currentEditingTemplate.id ? 
        'Modify your existing template' : 'Create a new workout template';
    
    // Populate form fields
    const nameInput = document.getElementById('editor-template-name');
    const categorySelect = document.getElementById('editor-template-category');
    const descriptionInput = document.getElementById('editor-template-description');
    
    if (nameInput) nameInput.value = currentEditingTemplate.name || '';
    if (categorySelect) categorySelect.value = currentEditingTemplate.category || 'Other';
    if (descriptionInput) descriptionInput.value = currentEditingTemplate.description || '';
    
    // Populate exercises
    renderTemplateEditorExercises();
}

// Render Exercises in Template Editor
function renderTemplateEditorExercises() {
    const container = document.getElementById('template-editor-exercises');
    if (!container || !currentEditingTemplate) return;
    
    if (!currentEditingTemplate.exercises || currentEditingTemplate.exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-exercises-state">
                <i class="fas fa-dumbbell"></i>
                <h4>No Exercises Added</h4>
                <p>Click "Add Exercise" to start building your template</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    currentEditingTemplate.exercises.forEach((exercise, index) => {
        const exerciseCard = createTemplateEditorExerciseCard(exercise, index);
        container.appendChild(exerciseCard);
    });
}

// Create Exercise Card for Template Editor
function createTemplateEditorExerciseCard(exercise, index) {
    const card = document.createElement('div');
    card.className = 'template-editor-exercise-card';
    
    card.innerHTML = `
        <div class="exercise-card-header">
            <div class="exercise-info">
                <h4>${exercise.name}</h4>
                <div class="exercise-meta">
                    ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
                </div>
            </div>
            <div class="exercise-actions">
                <button class="btn btn-secondary btn-small" onclick="editTemplateExerciseInEditor(${index})" title="Edit Exercise">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-small" onclick="removeExerciseFromTemplate(${index})" title="Remove Exercise">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="exercise-details">
            <div class="exercise-params">
                <span class="param">
                    <i class="fas fa-repeat"></i>
                    <input type="number" class="param-input" value="${exercise.sets || 3}" 
                           onchange="updateTemplateExerciseParam(${index}, 'sets', this.value)" min="1" max="10">
                    <label>Sets</label>
                </span>
                <span class="param">
                    <i class="fas fa-hashtag"></i>
                    <input type="number" class="param-input" value="${exercise.reps || 10}" 
                           onchange="updateTemplateExerciseParam(${index}, 'reps', this.value)" min="1" max="50">
                    <label>Reps</label>
                </span>
                <span class="param">
                    <i class="fas fa-weight-hanging"></i>
                    <input type="number" class="param-input" value="${exercise.weight || 50}" 
                           onchange="updateTemplateExerciseParam(${index}, 'weight', this.value)" min="0" step="5">
                    <label>Weight (lbs)</label>
                </span>
            </div>
            ${exercise.video ? `
                <div class="exercise-video-link">
                    <i class="fas fa-play-circle"></i>
                    <a href="${exercise.video}" target="_blank">Form Video</a>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

async function addExerciseToCurrentTemplate() {
    if (!currentEditingTemplate) return;
    
    await exerciseLibrary.openForTemplate(currentEditingTemplate);
}

function updateTemplateExerciseParam(exerciseIndex, param, value) {
    if (!currentEditingTemplate || !currentEditingTemplate.exercises[exerciseIndex]) return;
    currentEditingTemplate.exercises[exerciseIndex][param] = parseInt(value) || 0;
    showNotification('Exercise updated', 'success');
}

function removeExerciseFromTemplate(exerciseIndex) {
    if (!currentEditingTemplate || !currentEditingTemplate.exercises[exerciseIndex]) return;
    const exerciseName = currentEditingTemplate.exercises[exerciseIndex].name;
    if (confirm(`Remove "${exerciseName}" from template?`)) {
        currentEditingTemplate.exercises.splice(exerciseIndex, 1);
        renderTemplateEditorExercises();
        showNotification(`Removed "${exerciseName}" from template`, 'success');
    }
}

function editTemplateExerciseInEditor(exerciseIndex) {
    // For now, just focus on the exercise - could expand to full edit modal later
    const exerciseCard = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    if (exerciseCard) {
        exerciseCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        exerciseCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
            exerciseCard.style.transform = 'scale(1)';
        }, 300);
    }
    showNotification('Edit exercise parameters directly in the card', 'info');
}

// Edit Template Function - SINGLE DEFINITION
async function editTemplate(templateId) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to edit templates', 'warning');
        return;
    }
    
    try {
        // Load the template from Firebase
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
            showNotification('Template not found', 'error');
            return;
        }
        
        // Set up the template for editing
        currentEditingTemplate = {
            id: template.id,
            name: template.name,
            category: template.category || 'Other',
            description: template.description || '',
            exercises: template.exercises || []
        };
        
        // Show the template editor
        showTemplateEditorWithData(currentEditingTemplate);
        
    } catch (error) {
        console.error('Error loading template for editing:', error);
        showNotification('Failed to load template for editing', 'error');
    }
}

async function saveTemplateFromEditor() {
    if (!currentEditingTemplate) return;
    
    // Get updated values from form
    const nameInput = document.getElementById('editor-template-name');
    const categorySelect = document.getElementById('editor-template-category');
    const descriptionInput = document.getElementById('editor-template-description');
    
    if (!nameInput?.value.trim()) {
        showNotification('Please enter a template name', 'warning');
        nameInput?.focus();
        return;
    }
    
    if (!currentEditingTemplate.exercises || currentEditingTemplate.exercises.length === 0) {
        showNotification('Please add at least one exercise to the template', 'warning');
        return;
    }
    
    // Update template data
    currentEditingTemplate.name = nameInput.value.trim();
    currentEditingTemplate.category = categorySelect?.value || 'Other';
    currentEditingTemplate.description = descriptionInput?.value.trim() || '';
    
    try {
        // Save to Firebase if user is signed in
        if (AppState.currentUser) {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            
            if (currentEditingTemplate.id) {
                // Update existing template
                await workoutManager.updateWorkoutTemplate(currentEditingTemplate.id, currentEditingTemplate);
                showNotification(`Template "${currentEditingTemplate.name}" updated successfully!`, 'success');
            } else {
                // Save new template
                await workoutManager.saveWorkoutTemplate(currentEditingTemplate);
                showNotification(`Template "${currentEditingTemplate.name}" created successfully!`, 'success');
            }
        }
        
        // Return to workout management
        cancelTemplateEditor();
        
        // Refresh the templates list
        if (currentTemplateCategory === 'custom') {
            await loadTemplatesByCategory('custom');
        }
        
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Failed to save template', 'error');
    }
}

// Cancel Template Editor
function cancelTemplateEditor() {
    const editorSection = document.getElementById('template-editor-section');
    if (editorSection) {
        editorSection.classList.add('hidden');
    }
    
    // Reset state
    currentEditingTemplate = null;
    isEditingMode = false;
    
    // Show workout management
    document.getElementById('workout-management')?.classList.remove('hidden');
}

// Enhanced Create New Exercise
async function createNewExerciseEnhanced(event) {
    event.preventDefault();
    
    const name = document.getElementById('new-exercise-name')?.value.trim();
    const bodyPart = document.getElementById('new-exercise-body-part')?.value;
    const equipment = document.getElementById('new-exercise-equipment')?.value;
    const sets = parseInt(document.getElementById('new-exercise-sets')?.value) || 3;
    const reps = parseInt(document.getElementById('new-exercise-reps')?.value) || 10;
    const weight = parseInt(document.getElementById('new-exercise-weight')?.value) || 50;
    const video = document.getElementById('new-exercise-video')?.value.trim();
    
    if (!name) {
        showNotification('Please enter an exercise name', 'warning');
        return;
    }
    
    const exerciseData = {
        name,
        machine: name,
        bodyPart,
        equipmentType: equipment,
        tags: [bodyPart.toLowerCase(), equipment.toLowerCase()],
        sets,
        reps,
        weight,
        video: convertYouTubeUrl(video)
    };
    
    try {
        if (AppState.currentUser) {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            await workoutManager.createExercise(exerciseData);
        }
        
        showNotification(`Exercise "${name}" created successfully!`, 'success');
        closeCreateExerciseModal();
        
        // If we're in template editing mode, add to template
        if (AppState.addingToTemplate && currentEditingTemplate) {
            currentEditingTemplate.exercises = currentEditingTemplate.exercises || [];
            currentEditingTemplate.exercises.push({
                name: exerciseData.name,
                bodyPart: exerciseData.bodyPart,
                equipmentType: exerciseData.equipmentType,
                sets: exerciseData.sets,
                reps: exerciseData.reps,
                weight: exerciseData.weight,
                video: exerciseData.video
            });
            renderTemplateEditorExercises();
            showNotification(`Added "${name}" to template`, 'success');
        }
        
        // If we're in swap mode, use for swap
        if (AppState.swappingExerciseIndex !== null && AppState.swappingExerciseIndex !== undefined) {
            await confirmExerciseSwap(name, exerciseData);
        }
        
    } catch (error) {
        console.error('Error creating exercise:', error);
        showNotification('Failed to create exercise', 'error');
    }
}

// 1. FIX: Add exercise to active workout (not just swap)
async function addExerciseToActiveWorkout(exerciseIndex = null) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to add exercises', 'warning');
        return;
    }
    
    if (!AppState.currentWorkout) {
        showNotification('No active workout to add exercises to', 'warning');
        return;
    }
    
    // Set context for adding (not swapping)
    AppState.addingExerciseToWorkout = true;
    AppState.insertAfterIndex = exerciseIndex; // null means add to end
    
    await exerciseLibrary.openForWorkoutAdd();
}

// 2. FIX: Exercise library context for workout addition
async function confirmExerciseAddToWorkout(exerciseName, exerciseData) {
    if (!AppState.currentWorkout || !AppState.addingExerciseToWorkout) return;
    
    let newExercise;
    try {
        newExercise = typeof exerciseData === 'string' ? JSON.parse(exerciseData) : exerciseData;
    } catch (e) {
        console.error('Error parsing exercise data:', e);
        return;
    }
    
    const workoutExercise = {
        machine: newExercise.name || newExercise.machine,
        sets: newExercise.sets || 3,
        reps: newExercise.reps || 10,
        weight: newExercise.weight || 50,
        video: newExercise.video || ''
    };
    
    // Add to workout
    if (AppState.insertAfterIndex !== null) {
        // Insert after specific exercise
        AppState.currentWorkout.exercises.splice(AppState.insertAfterIndex + 1, 0, workoutExercise);
    } else {
        // Add to end
        AppState.currentWorkout.exercises.push(workoutExercise);
    }
    
    // Initialize exercise units for new exercise
    const newIndex = AppState.insertAfterIndex !== null ? 
        AppState.insertAfterIndex + 1 : 
        AppState.currentWorkout.exercises.length - 1;
    
    AppState.exerciseUnits[newIndex] = AppState.globalUnit;
    
    // Reindex exercise units if we inserted in middle
    if (AppState.insertAfterIndex !== null) {
        const newUnits = {};
        AppState.currentWorkout.exercises.forEach((exercise, index) => {
            if (index <= AppState.insertAfterIndex) {
                newUnits[index] = AppState.exerciseUnits[index] || AppState.globalUnit;
            } else if (index === AppState.insertAfterIndex + 1) {
                newUnits[index] = AppState.globalUnit; // New exercise
            } else {
                newUnits[index] = AppState.exerciseUnits[index - 1] || AppState.globalUnit;
            }
        });
        AppState.exerciseUnits = newUnits;
        
        // Reindex saved exercise data
        const newExercises = {};
        Object.keys(AppState.savedData.exercises || {}).forEach(key => {
            const exerciseIndex = parseInt(key.split('_')[1]);
            if (exerciseIndex <= AppState.insertAfterIndex) {
                newExercises[key] = AppState.savedData.exercises[key];
            } else {
                newExercises[`exercise_${exerciseIndex + 1}`] = AppState.savedData.exercises[key];
            }
        });
        AppState.savedData.exercises = newExercises;
    }
    
    // Save changes
    await saveWorkoutData(AppState);
    
    // Update UI
    renderExercises();
    closeExerciseLibraryEnhanced();
    
    // Reset state
    AppState.addingExerciseToWorkout = false;
    AppState.insertAfterIndex = null;
    
    showNotification(`Added "${workoutExercise.machine}" to workout!`, 'success');
}

// Enhanced Exercise Library Functions with Proper Context Handling
let currentExerciseLibraryContext = null; // 'template', 'swap', or null
let currentExerciseLibrary = [];
let currentFilteredExercises = [];

// REPLACE the existing openExerciseLibraryForTemplate function with this:
async function openExerciseLibraryForTemplate() {
    const modal = document.getElementById('exercise-library-modal');
    if (!modal) return;
    
    // Set context
    currentExerciseLibraryContext = 'template';
    
    // Update modal title
    const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Add Exercise to Template';
    }
    
    modal.classList.remove('hidden');
    
    // Load exercise library
    try {
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        currentExerciseLibrary = await workoutManager.getExerciseLibrary();
        currentFilteredExercises = [...currentExerciseLibrary];
        
        console.log('📚 Loaded exercise library for template:', currentExerciseLibrary.length, 'exercises');
        renderExerciseLibraryWithContext();
    } catch (error) {
        console.error('Error loading exercise library:', error);
        showNotification('Error loading exercises', 'error');
    }
}

// Create Exercise Library Card for Template
function createExerciseLibraryCardForTemplate(exercise) {
    const card = document.createElement('div');
    card.className = 'library-exercise-card';
    
    card.innerHTML = `
        <h5>${exercise.name || exercise.machine}</h5>
        <div class="library-exercise-info">
            ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
            ${exercise.isCustom ? ' • Custom' : ''}
        </div>
        <div class="library-exercise-stats">
            ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
        </div>
        <div class="library-exercise-actions">
            <button class="btn btn-primary btn-small" onclick="addExerciseToTemplateFromLibrary('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-plus"></i> Add to Template
            </button>
        </div>
    `;
    
    return card;
}

// Add Exercise to Template from Library
function addExerciseToTemplateFromLibrary(exerciseName, exerciseDataString) {
    if (!currentEditingTemplate) return;
    
    let exerciseData;
    try {
        exerciseData = typeof exerciseDataString === 'string' ? 
            JSON.parse(exerciseDataString.replace(/&quot;/g, '"')) : 
            exerciseDataString;
    } catch (e) {
        console.error('Error parsing exercise data:', e);
        return;
    }
    
    const templateExercise = {
        name: exerciseData.name || exerciseData.machine,
        bodyPart: exerciseData.bodyPart,
        equipmentType: exerciseData.equipmentType,
        sets: exerciseData.sets || 3,
        reps: exerciseData.reps || 10,
        weight: exerciseData.weight || 50,
        video: exerciseData.video || ''
    };
    
    currentEditingTemplate.exercises = currentEditingTemplate.exercises || [];
    currentEditingTemplate.exercises.push(templateExercise);
    
    // IMMEDIATE UI update - don't wait for close
    renderTemplateEditorExercises();
    
    // Show success immediately
    showNotification(`Added "${templateExercise.name}" to template`, 'success');
    
    // Keep library open for multiple additions
    // User can close manually when done
}

// Close Exercise Library for Template
function closeExerciseLibraryForTemplate() {
    const modal = document.getElementById('exercise-library-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Reset modal title
    const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Exercise Library';
    }
    
    // Clear search
    const searchInput = document.getElementById('exercise-library-search');
    const bodyPartFilter = document.getElementById('body-part-filter');
    const equipmentFilter = document.getElementById('equipment-filter');
    
    if (searchInput) searchInput.value = '';
    if (bodyPartFilter) bodyPartFilter.value = '';
    if (equipmentFilter) equipmentFilter.value = '';
    
    // Reset state
    AppState.addingToTemplate = false;
    AppState.templateEditingContext = null;
}

// Delete Template Function
async function deleteTemplate(templateId) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to delete templates', 'warning');
        return;
    }
    
    try {
        // Load the template first to get its name
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
            showNotification('Template not found', 'error');
            return;
        }
        
        // Confirm deletion
        const confirmDelete = confirm(`Are you sure you want to delete "${template.name}"? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }
        
        // Delete from Firebase
        await workoutManager.deleteWorkoutTemplate(templateId);
        
        showNotification(`Template "${template.name}" deleted successfully`, 'success');
        
        // Refresh the current view
        if (currentTemplateCategory === 'custom') {
            await loadTemplatesByCategory('custom');
        } else {
            // If in workout management, reload templates
            const workoutManagement = document.getElementById('workout-management');
            if (workoutManagement && !workoutManagement.classList.contains('hidden')) {
                await loadTemplatesByCategory('custom');
            }
        }
        
    } catch (error) {
        console.error('Error deleting template:', error);
        showNotification('Failed to delete template', 'error');
    }
}

// Use Template Function (for management screen)
async function useTemplate(templateId) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to use templates', 'warning');
        return;
    }
    
    try {
        // Load the template
        const { WorkoutManager } = await import('./core/workout/workout-manager.js');
        const workoutManager = new WorkoutManager(AppState);
        const templates = await workoutManager.getUserWorkoutTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
            showNotification('Template not found', 'error');
            return;
        }
        
        // Convert template to workout format
        const workout = {
            day: template.name,
            exercises: template.exercises.map(ex => ({
                machine: ex.name,
                sets: ex.sets || 3,
                reps: ex.reps || 10,
                weight: ex.weight || 50,
                video: ex.video || ''
            }))
        };
        
        // Hide workout management and go to workout
        hideWorkoutManagement();
        showWorkoutSelector();
        
        // Small delay to ensure UI updates, then start workout
        setTimeout(() => {
            selectWorkout(workout.day, null, workout);
        }, 100);
        
        showNotification(`Starting "${template.name}" workout!`, 'success');
        
    } catch (error) {
        console.error('Error using template:', error);
        showNotification('Failed to start workout from template', 'error');
    }
}

// 4. ADD this emergency fix function:
function emergencyFixFilters() {
    console.log('🚨 Emergency filter fix - checking all references...');
    
    // Force reload data into the right object
    if (workoutHistory && workoutHistory.loadHistory) {
        workoutHistory.loadHistory().then(() => {
            // Copy the data to window reference
            if (window.workoutHistory && workoutHistory.currentHistory.length > 0) {
                window.workoutHistory.currentHistory = [...workoutHistory.currentHistory];
                window.workoutHistory.filteredHistory = [...workoutHistory.currentHistory];
                console.log('✅ Emergency fix: Data copied to window.workoutHistory');
                console.log('New lengths:', window.workoutHistory.currentHistory.length);
            }
        });
    }
}

// Make functions globally available
window.fixWorkoutHistoryReference = fixWorkoutHistoryReference;
window.emergencyFixFilters = emergencyFixFilters;

// 2. ADD this new function to main.js (BUG-009 FIX):
function setupWorkoutHistoryEventListeners() {
    console.log('🔧 Setting up simplified workout history event listeners...');
    
    // Prevent duplicate listeners
    if (window.historyListenersSetup) {
        console.log('History listeners already set up, skipping...');
        return;
    }
    
    // The event listeners are now handled directly in workout-history.js
    // This function is kept for compatibility but most logic moved to the module
    
    window.historyListenersSetup = true;
    console.log('✅ Simplified workout history event listeners setup complete');
}

// 3. ADD this new function to main.js (BUG-009 & BUG-010 FIX):
function applyHistoryFilters() {
    console.log('🔍 Applying simplified search filter...');
    
    if (!window.workoutHistory) {
        console.warn('❌ No workoutHistory object found');
        return;
    }
    
    // Get search query from the simple search input
    const searchQuery = document.getElementById('workout-search')?.value?.trim() || '';
    
    // Apply the search filter
    window.workoutHistory.filterHistory(searchQuery);
    
    console.log('✅ Search filter applied');
}


// Separate function to apply filters when we know data exists
function applyHistoryFiltersWithData(historyObj) {
    console.log('📊 Applying filters with data...');
    
    // Get current filter values
    const searchQuery = document.getElementById('history-search')?.value?.trim() || '';
    const startDate = document.getElementById('history-start-date')?.value || '';
    const endDate = document.getElementById('history-end-date')?.value || '';
    
    // Get active status filter
    const activeStatusBtn = document.querySelector('.filter-section .history-filter-btn.active[data-filter]');
    const statusFilter = activeStatusBtn?.dataset.filter || 'all';
    
    // Get active time filter  
    const activeTimeBtn = document.querySelector('.filter-section:nth-child(2) .history-filter-btn.active[data-filter]');
    const timeFilter = activeTimeBtn?.dataset.filter || null;
    
    console.log('🎯 Filter values:', { searchQuery, statusFilter, timeFilter, startDate, endDate });
    
    // Start with all workouts
    let filtered = [...historyObj.currentHistory];
    console.log('📊 Starting with:', filtered.length, 'workouts');
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
        const beforeLength = filtered.length;
        filtered = filtered.filter(workout => {
            switch (statusFilter) {
                case 'completed':
                    return workout.completedAt && !workout.cancelledAt && !workout.status;
                case 'cancelled':
                    return workout.cancelledAt || workout.status === 'cancelled';
                case 'discarded':
                    return workout.status === 'discarded';
                default:
                    return true;
            }
        });
        console.log(`📊 After status filter (${statusFilter}):`, filtered.length, 'workouts (was', beforeLength, ')');
    }
    
    // Apply time filter
    if (timeFilter) {
        const beforeLength = filtered.length;
        const now = new Date();
        let filterDate;
        
        switch (timeFilter) {
            case 'this-week':
                filterDate = new Date(now);
                filterDate.setDate(now.getDate() - now.getDay());
                break;
            case 'this-month':
                filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }
        
        if (filterDate) {
            filtered = filtered.filter(workout => {
                const workoutDate = new Date(workout.date);
                return workoutDate >= filterDate;
            });
            console.log(`📊 After time filter (${timeFilter}):`, filtered.length, 'workouts (was', beforeLength, ')');
        }
    }
    
    // Apply search filter
    if (searchQuery) {
        const beforeLength = filtered.length;
        const searchLower = searchQuery.toLowerCase();
        filtered = filtered.filter(workout => {
            return (workout.workoutType && workout.workoutType.toLowerCase().includes(searchLower)) ||
                   (workout.date && workout.date.includes(searchQuery)) ||
                   (workout.exerciseNames && Object.values(workout.exerciseNames).some(name => 
                       name && name.toLowerCase().includes(searchLower))) ||
                   (workout.manualNotes && workout.manualNotes.toLowerCase().includes(searchLower));
        });
        console.log(`📊 After search filter (${searchQuery}):`, filtered.length, 'workouts (was', beforeLength, ')');
    }
    
    // Apply date range filter
    if (startDate || endDate) {
        const beforeLength = filtered.length;
        filtered = filtered.filter(workout => {
            const workoutDate = new Date(workout.date);
            if (startDate && endDate) {
                return workoutDate >= new Date(startDate) && workoutDate <= new Date(endDate);
            } else if (startDate) {
                return workoutDate >= new Date(startDate);
            } else if (endDate) {
                return workoutDate <= new Date(endDate);
            }
            return true;
        });
        console.log(`📊 After date filter:`, filtered.length, 'workouts (was', beforeLength, ')');
    }
    
    // Update the workout history object
    historyObj.filteredHistory.splice(0, historyObj.filteredHistory.length, ...filtered);
    historyObj.currentPage = 1;
    historyObj.renderHistory();
    
    console.log(`✅ Final result: ${filtered.length} workouts shown out of ${historyObj.currentHistory.length} total`);
}

// ADD NEW FUNCTION: Show add manual workout modal
function showAddManualWorkoutModal() {
    const modal = document.getElementById('add-manual-workout-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Reset to step 1
        showManualStep(1);
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('manual-workout-date');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // Reset workout data
        currentManualWorkout = {
            date: today,
            category: '',
            name: '',
            duration: 60,
            status: 'completed',
            notes: '',
            exercises: []
        };
        
        // Focus on date input
        setTimeout(() => dateInput?.focus(), 100);
    }
}

function proceedToExerciseSelection() {
    // Validate basic form
    const form = document.getElementById('manual-workout-basic-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // FIX: Properly collect and validate the date
    const selectedDate = document.getElementById('manual-workout-date')?.value;
    
    if (!selectedDate) {
        showNotification('Please select a workout date', 'warning');
        return;
    }
    
    // Collect basic workout data
    currentManualWorkout.date = selectedDate; // FIX: Ensure date is set correctly
    currentManualWorkout.category = document.getElementById('manual-workout-category')?.value || '';
    currentManualWorkout.name = document.getElementById('manual-workout-name')?.value || 
                                 (currentManualWorkout.category + ' Workout');
    currentManualWorkout.duration = parseInt(document.getElementById('manual-workout-duration')?.value) || 60;
    currentManualWorkout.status = document.getElementById('manual-workout-status')?.value || 'completed';
    currentManualWorkout.notes = document.getElementById('manual-workout-notes')?.value || '';
    
    // FIX: Additional validation
    if (!currentManualWorkout.date || !currentManualWorkout.category) {
        showNotification('Please fill in the required fields', 'warning');
        return;
    }
    
    console.log('🔧 BUG-022 FIX: Manual workout date set to:', currentManualWorkout.date);
    
    // Update step 2 display
    const titleDisplay = document.getElementById('manual-workout-title-display');
    const dateDisplay = document.getElementById('manual-workout-date-display');
    
    if (titleDisplay) titleDisplay.textContent = currentManualWorkout.name;
    if (dateDisplay) {
        const formattedDate = new Date(currentManualWorkout.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
        });
        dateDisplay.textContent = formattedDate;
    }
    
    // Show step 2
    showManualStep(2);
    
    // Render exercise list
    renderManualExerciseList();
}


function showManualStep(stepNumber) {
    console.log(`🔧 Switching to manual step ${stepNumber}`);
    document.querySelectorAll('.manual-step').forEach(step => step.classList.add('hidden'));
    const targetStep = document.getElementById(`manual-step-${stepNumber}`);
    if (targetStep) {
        targetStep.classList.remove('hidden');
        console.log(`✅ Step ${stepNumber} shown successfully`);
    } else {
        console.error(`❌ manual-step-${stepNumber} element not found`);
    }
}

// Also add this to your global assignments at the bottom:
window.showManualStep = showManualStep;


// STEP 2 -> STEP 1: Back to basic info
function backToBasicInfo() {
    showManualStep(1);
}

// Render exercise list in step 2
function renderManualExerciseList() {
    const container = document.getElementById('manual-exercises-container');
    const countDisplay = document.getElementById('manual-exercise-count');
    
    if (!container) return;
    
    // Update count
    if (countDisplay) countDisplay.textContent = currentManualWorkout.exercises.length;
    
    if (currentManualWorkout.exercises.length === 0) {
        container.innerHTML = `
            <div class="no-exercises-state">
                <i class="fas fa-plus-circle"></i>
                <h5>No Exercises Added</h5>
                <p>Click "Add Exercise" to start building your workout</p>
                <button class="btn btn-primary" onclick="addExerciseToManualWorkout()">
                    <i class="fas fa-plus"></i> Add Your First Exercise
                </button>
            </div>
        `;
        return;
    }
    
    // Render exercise cards
    let exercisesHTML = '';
    currentManualWorkout.exercises.forEach((exercise, index) => {
        const completedSets = exercise.sets.filter(set => set.reps && set.weight).length;
        const totalSets = exercise.sets.length;
        const isCompleted = exercise.manuallyCompleted || completedSets === totalSets;
        
        exercisesHTML += `
            <div class="manual-exercise-card ${isCompleted ? 'completed' : ''}" data-index="${index}">
                <div class="exercise-header">
                    <h4>${exercise.name}</h4>
                    <div class="exercise-actions">
                        <button class="btn btn-primary btn-small" onclick="editManualExercise(${index})" title="Add/Edit Sets">
                            <i class="fas fa-edit"></i> ${completedSets > 0 ? 'Edit' : 'Add'} Sets
                        </button>
                        <button class="btn btn-danger btn-small" onclick="removeManualExercise(${index})" title="Remove Exercise">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="exercise-preview">
                    ${generateManualSetPreview(exercise)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = exercisesHTML;
}

// Generate set preview for manual exercise
function generateManualSetPreview(exercise) {
    if (!exercise.sets || exercise.sets.length === 0) {
        return '<div class="no-sets">No sets added yet</div>';
    }
    
    let preview = '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">';
    
    exercise.sets.forEach((set, index) => {
        const completed = set.reps && set.weight;
        const bgColor = completed ? 'var(--success)' : 'var(--bg-tertiary)';
        const textColor = completed ? 'white' : 'var(--text-secondary)';
        
        if (completed) {
            preview += `
                <div style="background: ${bgColor}; color: ${textColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                    Set ${index + 1}: ${set.reps} × ${set.weight} lbs
                </div>
            `;
        } else {
            preview += `
                <div style="background: ${bgColor}; color: ${textColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                    Set ${index + 1}: Empty
                </div>
            `;
        }
    });
    
    preview += '</div>';
    return preview;
}

// Add exercise to manual workout
async function addExerciseToManualWorkout() {
    console.log('🎯 Opening exercise library for manual workout...');
    
    // Simple approach - just open the modal and set context manually
    const modal = document.getElementById('exercise-library-modal');
    const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
    
    if (modalTitle) {
        modalTitle.textContent = 'Add Exercise to Manual Workout';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
    
    // Ensure exercise library is initialized
    if (!exerciseLibrary) {
        try {
            exerciseLibrary = getExerciseLibrary(AppState);
            exerciseLibrary.initialize();
            window.exerciseLibrary = exerciseLibrary;
        } catch (error) {
            console.error('Error initializing exercise library:', error);
            showNotification('Error loading exercise library', 'error');
            return;
        }
    }
    
    // Try different ways to open the library
    try {
        // Method 1: Try the existing method
        if (exerciseLibrary.openForManualWorkout) {
            await exerciseLibrary.openForManualWorkout();
        } 
        // Method 2: Try loadAndShow directly
        else if (exerciseLibrary.loadAndShow) {
            // Set context manually since openForManualWorkout doesn't exist
            if (exerciseLibrary.currentContext !== undefined) {
                exerciseLibrary.currentContext = 'manual-workout';
            }
            await exerciseLibrary.loadAndShow();
        }
        // Method 3: Last resort - just show what we have
        else {
            console.log('📚 Using fallback method to open exercise library');
            showNotification('Exercise library opened - select exercises manually', 'info');
        }
    } catch (error) {
        console.error('Error opening exercise library:', error);
        showNotification('Error opening exercise library', 'error');
    }
}

// 7. FIX: Enhanced workout history with proper exercise names
async function saveWorkoutWithProperNames(state) {
    if (!state.currentUser || !state.currentWorkout) return;
    
    const saveDate = state.savedData.date || state.getTodayDateString();
    state.savedData.date = saveDate;
    state.savedData.exerciseUnits = state.exerciseUnits;
    
    // IMPORTANT: Store exercise names mapping for history
    const exerciseNames = {};
    state.currentWorkout.exercises.forEach((exercise, index) => {
        exerciseNames[`exercise_${index}`] = exercise.machine;
    });
    state.savedData.exerciseNames = exerciseNames;
    
    // Store the original workout structure for reconstruction
    state.savedData.originalWorkout = {
        day: state.currentWorkout.day,
        exercises: state.currentWorkout.exercises.map(ex => ({
            machine: ex.machine,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            video: ex.video || ''
        }))
    };
    
    // Convert weights to pounds for storage
    const normalizedData = { ...state.savedData };
    if (normalizedData.exercises) {
        Object.keys(normalizedData.exercises).forEach(exerciseKey => {
            const exerciseData = normalizedData.exercises[exerciseKey];
            const exerciseIndex = parseInt(exerciseKey.split('_')[1]);
            const currentUnit = state.exerciseUnits[exerciseIndex] || state.globalUnit;
            
            if (exerciseData.sets) {
                exerciseData.sets = exerciseData.sets.map(set => {
                    if (set.weight && currentUnit === 'kg') {
                        return {
                            ...set,
                            weight: Math.round(set.weight * 2.20462),
                            originalUnit: 'kg'
                        };
                    }
                    return {
                        ...set,
                        originalUnit: currentUnit || 'lbs'
                    };
                });
            }
        });
    }
    
    try {
        const docRef = doc(db, "users", state.currentUser.uid, "workouts", saveDate);
        await setDoc(docRef, {
            ...normalizedData,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('💾 Enhanced workout data saved for', saveDate);
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Failed to save workout data', 'error');
    }
}

// Edit manual exercise (open the exercise entry modal)
function editManualExercise(exerciseIndex) {
    const exercise = currentManualWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    
    currentManualExerciseIndex = exerciseIndex;
    
    // Show exercise entry modal
    const modal = document.getElementById('manual-exercise-entry-modal');
    const title = document.getElementById('manual-exercise-title');
    const content = document.getElementById('manual-exercise-content');
    
    if (!modal || !title || !content) return;
    
    title.textContent = exercise.name;
    
    // Generate exercise table (similar to live workout)
    content.innerHTML = generateManualExerciseTable(exercise, exerciseIndex);
    
    modal.classList.add('active');
}

// Generate exercise table for manual entry
function generateManualExerciseTable(exercise, exerciseIndex) {
    const savedSets = exercise.sets || [];
    const savedNotes = exercise.notes || '';
    
    // Ensure we have at least 3 sets
    while (savedSets.length < 3) {
        savedSets.push({ reps: '', weight: '' });
    }
    
    let html = `
        <div style="margin-bottom: 1rem;">
            <button class="btn btn-success btn-small" onclick="addSetToManualExercise()">
                <i class="fas fa-plus"></i> Add Set
            </button>
            <span style="margin-left: 1rem; color: var(--text-secondary);">
                Sets: ${savedSets.filter(s => s.reps && s.weight).length}/${savedSets.length}
            </span>
        </div>

        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Weight (${manualExerciseUnit})</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    savedSets.forEach((set, setIndex) => {
        const completed = set.reps && set.weight;
        
        html += `
            <tr class="${completed ? 'completed-set' : ''}">
                <td>Set ${setIndex + 1}</td>
                <td>
                    <input type="number" class="set-input" 
                           placeholder="10" 
                           value="${set.reps || ''}"
                           onchange="updateManualSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                </td>
                <td>
                    <input type="number" class="set-input" 
                           placeholder="50" 
                           value="${set.weight || ''}"
                           onchange="updateManualSet(${exerciseIndex}, ${setIndex}, 'weight', this.value)">
                </td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="removeSetFromManualExercise(${setIndex})" title="Remove Set">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        
        <textarea class="notes-area" placeholder="Exercise notes..." 
                  onchange="updateManualExerciseNotes(${exerciseIndex}, this.value)"
                  style="width: 100%; margin-top: 1rem;">${savedNotes}</textarea>
        
        <div style="margin-top: 1rem; text-align: center;">
            <button class="btn btn-success" onclick="markManualExerciseComplete(${exerciseIndex})">
                <i class="fas fa-check-circle"></i> Mark Exercise Complete
            </button>
        </div>
    `;

    return html;
}

// Update manual exercise set
function updateManualSet(exerciseIndex, setIndex, field, value) {
    if (!currentManualWorkout.exercises[exerciseIndex]) return;
    
    const exercise = currentManualWorkout.exercises[exerciseIndex];
    
    // Ensure sets array exists and is long enough
    if (!exercise.sets) exercise.sets = [];
    while (exercise.sets.length <= setIndex) {
        exercise.sets.push({ reps: '', weight: '' });
    }
    
    exercise.sets[setIndex][field] = value;
    
    console.log(`Updated manual set: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
}

// Update manual exercise notes
function updateManualExerciseNotes(exerciseIndex, notes) {
    if (!currentManualWorkout.exercises[exerciseIndex]) return;
    currentManualWorkout.exercises[exerciseIndex].notes = notes;
}

// Add set to manual exercise
function addSetToManualExercise() {
    if (currentManualExerciseIndex === null) return;
    
    const exercise = currentManualWorkout.exercises[currentManualExerciseIndex];
    if (!exercise.sets) exercise.sets = [];
    
    exercise.sets.push({ reps: '', weight: '' });
    
    // Refresh the modal
    editManualExercise(currentManualExerciseIndex);
}

// Remove set from manual exercise
function removeSetFromManualExercise(setIndex) {
    if (currentManualExerciseIndex === null) return;
    
    const exercise = currentManualWorkout.exercises[currentManualExerciseIndex];
    if (!exercise.sets || exercise.sets.length <= 1) {
        showNotification('Exercise must have at least one set', 'warning');
        return;
    }
    
    exercise.sets.splice(setIndex, 1);
    
    // Refresh the modal
    editManualExercise(currentManualExerciseIndex);
}

// Mark manual exercise as complete
function markManualExerciseComplete(exerciseIndex) {
    const exercise = currentManualWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    
    exercise.manuallyCompleted = true;
    
    // Close modal and refresh list
    closeManualExerciseEntry();
    renderManualExerciseList();
    
    showNotification(`${exercise.name} marked as complete!`, 'success');
}

// Remove exercise from manual workout
function removeManualExercise(exerciseIndex) {
    const exercise = currentManualWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    
    const confirmRemove = confirm(`Remove "${exercise.name}" from this workout?`);
    if (!confirmRemove) return;
    
    currentManualWorkout.exercises.splice(exerciseIndex, 1);
    renderManualExerciseList();
    
    showNotification(`Removed "${exercise.name}" from workout`, 'success');
}

// Close manual exercise entry modal
function closeManualExerciseEntry() {
    const modal = document.getElementById('manual-exercise-entry-modal');
    if (modal) modal.classList.remove('active');
    
    currentManualExerciseIndex = null;
    
    // Refresh the exercise list to show updates
    renderManualExerciseList();
}

// Finish and save manual workout
async function finishManualWorkout() {
    if (!AppState.currentUser) {
        showNotification('Please sign in to save workouts', 'warning');
        return;
    }
    
    if (currentManualWorkout.exercises.length === 0) {
        const confirmEmpty = confirm('This workout has no exercises. Save anyway?');
        if (!confirmEmpty) return;
    }
    
    try {
        // 🔧 FIX: Get the date properly and handle timezone issues
        let workoutDate = currentManualWorkout.date || document.getElementById('manual-workout-date')?.value;
        
        if (!workoutDate) {
            showNotification('Error: No workout date specified', 'error');
            return;
        }
        
        // 🔧 CRITICAL FIX: Ensure date is in YYYY-MM-DD format without timezone conversion
        if (workoutDate.includes('T')) {
            // If it somehow got converted to ISO string, extract just the date part
            workoutDate = workoutDate.split('T')[0];
        }
        
        // 🔧 VALIDATION: Ensure it's a valid date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(workoutDate)) {
            console.error('❌ Invalid date format:', workoutDate);
            showNotification('Error: Invalid date format', 'error');
            return;
        }
        
        console.log('🔧 BUG-022 FIX: Final workout date to save:', workoutDate);
        
        // Check if workout already exists for this date
        if (workoutHistory && workoutHistory.currentHistory) {
            const existingWorkout = workoutHistory.currentHistory.find(w => w.date === workoutDate);
            if (existingWorkout) {
                const confirmOverwrite = confirm(
                    `A workout already exists for ${new Date(workoutDate + 'T12:00:00').toLocaleDateString()}. Do you want to overwrite it?`
                );
                if (!confirmOverwrite) return;
            }
        }
        
        // Build workout data in the same format as live workouts
        const workoutData = {
            date: workoutDate, // 🔧 FIX: Use clean date string
            workoutType: currentManualWorkout.name || 'Manual Workout',
            startTime: new Date(workoutDate + 'T09:00:00').toISOString(),
            totalDuration: currentManualWorkout.duration * 60,
            exercises: {},
            exerciseUnits: {},
            exerciseNames: {},
            originalWorkout: {
                day: currentManualWorkout.name || 'Manual Workout',
                exercises: currentManualWorkout.exercises.map(ex => ({
                    machine: ex.name,
                    name: ex.name,
                    bodyPart: ex.bodyPart,
                    equipmentType: ex.equipmentType,
                    sets: ex.sets.length,
                    reps: ex.sets[0]?.reps || 10,
                    weight: ex.sets[0]?.weight || 50
                }))
            },
            totalExercises: currentManualWorkout.exercises.length,
            addedManually: true,
            manualNotes: currentManualWorkout.notes,
            category: currentManualWorkout.category,
            version: '2.0'
        };
        
        // Set status with proper timezone handling
        if (currentManualWorkout.status === 'completed') {
            workoutData.completedAt = new Date(workoutDate + 'T10:00:00').toISOString();
        } else if (currentManualWorkout.status === 'cancelled') {
            workoutData.cancelledAt = new Date(workoutDate + 'T10:00:00').toISOString();
            workoutData.status = 'cancelled';
        }
        
        // Convert exercises to the standard format
        currentManualWorkout.exercises.forEach((exercise, index) => {
            const exerciseKey = `exercise_${index}`;
            
            workoutData.exercises[exerciseKey] = {
                sets: exercise.sets || [],
                notes: exercise.notes || '',
                manuallyCompleted: exercise.manuallyCompleted || false
            };
            
            workoutData.exerciseNames[exerciseKey] = exercise.name;
            workoutData.exerciseUnits[index] = manualExerciseUnit || 'lbs';
        });
        
        console.log('🔧 BUG-022 DEBUG: Final workout data to save:', {
            date: workoutData.date,
            workoutType: workoutData.workoutType,
            documentId: workoutDate
        });
        
        // 🔧 FIX: Save directly to Firebase with the exact date as document ID
        const { db, doc, setDoc } = await import('./core/firebase-config.js');
        
        const docRef = doc(db, "users", AppState.currentUser.uid, "workouts", workoutDate);
        await setDoc(docRef, {
            ...workoutData,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('✅ BUG-022 FIXED: Manual workout saved with date as document ID:', workoutDate);
        
        // Force reload history to show the new workout
        if (workoutHistory && workoutHistory.loadHistory) {
            console.log('🔄 Reloading workout history...');
            await workoutHistory.loadHistory();
        }
        
        // Close modal
        closeAddManualWorkoutModal();
        
        showNotification(`Workout saved for ${new Date(workoutDate + 'T12:00:00').toLocaleDateString()}!`, 'success');
        
    } catch (error) {
        console.error('❌ Error saving manual workout:', error);
        showNotification('Error saving workout. Please try again.', 'error');
    }
}

// ADD NEW FUNCTION: Close add manual workout modal
function closeAddManualWorkoutModal() {
    const modal = document.getElementById('add-manual-workout-modal');
    const form = document.getElementById('manual-workout-basic-form');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
    
    // Reset state
    currentManualWorkout = { exercises: [] };
    currentManualExerciseIndex = null;
    
    // Close any sub-modals
    closeManualExerciseEntry();
}

document.addEventListener('keydown', function(event) {
    // ESC to close modal
    if (event.key === 'Escape') {
        const modal = document.getElementById('add-manual-workout-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeAddManualWorkoutModal();
        }
    }
    
    // Enter to move to next input in manual workout form
    if (event.key === 'Enter' && event.target.classList.contains('set-input')) {
        event.preventDefault();
        const form = event.target.closest('form');
        const inputs = Array.from(form.querySelectorAll('.set-input'));
        const currentIndex = inputs.indexOf(event.target);
        const nextInput = inputs[currentIndex + 1];
        
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
});

function fillTemplateValues(exerciseIndex) {
    const workoutType = document.getElementById('manual-workout-type')?.value;
    const workout = AppState.workoutPlans?.find(w => w.day === workoutType);
    
    if (!workout || !workout.exercises[exerciseIndex]) return;
    
    const exercise = workout.exercises[exerciseIndex];
    const exerciseCard = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    
    if (!exerciseCard) return;
    
    // Fill all sets with template values
    for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
        const repsInput = exerciseCard.querySelector(`input[name="exercise_${exerciseIndex}_set_${setIndex}_reps"]`);
        const weightInput = exerciseCard.querySelector(`input[name="exercise_${exerciseIndex}_set_${setIndex}_weight"]`);
        
        if (repsInput && !repsInput.value) repsInput.value = exercise.reps;
        if (weightInput && !weightInput.value) weightInput.value = exercise.weight;
    }
    
    // Update progress
    updateExerciseProgress(exerciseIndex);
    
    showNotification(`Filled ${exercise.machine} with template values`, 'success');
}

// ADD NEW FUNCTION: Load workout template for manual entry
function loadWorkoutTemplate() {
    const workoutType = document.getElementById('manual-workout-type')?.value;
    const exerciseSection = document.getElementById('manual-workout-exercises');
    const exercisesList = document.getElementById('manual-exercises-list');
    
    if (!workoutType || !exerciseSection || !exercisesList) return;
    
    // Find the workout template
    const workout = AppState.workoutPlans?.find(w => w.day === workoutType);
    if (!workout) {
        exerciseSection.classList.add('hidden');
        return;
    }
    
    // Show loading state
    exercisesList.classList.add('loading');
    exerciseSection.classList.remove('hidden');
    
    // Small delay for better UX
    setTimeout(() => {
        // Generate improved exercise inputs
        let exercisesHTML = '';
        workout.exercises.forEach((exercise, index) => {
            exercisesHTML += `
                <div class="manual-exercise-card" data-exercise-index="${index}">
                    <div class="manual-exercise-header">
                        <h5>${exercise.machine}</h5>
                        <div class="exercise-template-info">
                            <i class="fas fa-info-circle"></i>
                            Template: ${exercise.sets} sets × ${exercise.reps} reps @ ${exercise.weight} lbs
                        </div>
                    </div>
                    
                    <div class="manual-sets-grid">
                        ${Array.from({length: exercise.sets}, (_, setIndex) => `
                            <div class="manual-set-card">
                                <div class="set-number">
                                    <i class="fas fa-dumbbell"></i> Set ${setIndex + 1}
                                </div>
                                <div class="set-inputs">
                                    <div class="input-group">
                                        <label>Reps</label>
                                        <input type="number" 
                                               name="exercise_${index}_set_${setIndex}_reps" 
                                               placeholder="${exercise.reps}" 
                                               min="1" max="50" 
                                               class="set-input"
                                               onchange="updateExerciseProgress(${index})"
                                               oninput="validateSetInput(this)">
                                    </div>
                                    <div class="input-group">
                                        <label>Weight</label>
                                        <div class="weight-input-group">
                                            <input type="number" 
                                                   name="exercise_${index}_set_${setIndex}_weight" 
                                                   placeholder="${exercise.weight}" 
                                                   min="0" step="5" 
                                                   class="set-input"
                                                   onchange="updateExerciseProgress(${index})"
                                                   oninput="validateSetInput(this)">
                                            <span class="weight-unit">lbs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="exercise-notes-section">
                        <label for="exercise_${index}_notes">
                            <i class="fas fa-sticky-note"></i> Exercise Notes (optional)
                        </label>
                        <input type="text" 
                               name="exercise_${index}_notes" 
                               placeholder="How did this exercise feel? Any observations..." 
                               class="form-input exercise-notes-input">
                    </div>
                </div>
            `;
        });
        
        exercisesList.innerHTML = exercisesHTML;
        exercisesList.classList.remove('loading');
        
        // Add some visual feedback
        showNotification(`Loaded ${workout.exercises.length} exercises for ${workoutType}`, 'success');
        
    }, 300);
}

// NEW FUNCTION: Update exercise progress indicator
function updateExerciseProgress(exerciseIndex) {
    const exerciseCard = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    if (!exerciseCard) return;
    
    // Check if exercise has any data
    const inputs = exerciseCard.querySelectorAll('.set-input');
    const hasData = Array.from(inputs).some(input => input.value.trim() !== '');
    
    // Update visual state
    exerciseCard.classList.toggle('has-data', hasData);
    
    // Update overall form completion
    updateFormCompletion();
}

// NEW FUNCTION: Validate set input
function validateSetInput(input) {
    const value = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    
    // Remove any existing validation classes
    input.classList.remove('invalid', 'valid');
    
    if (input.value.trim() === '') {
        return; // Empty is okay
    }
    
    if (isNaN(value) || value < min || (max && value > max)) {
        input.classList.add('invalid');
        input.setCustomValidity('Please enter a valid number within the allowed range');
    } else {
        input.classList.add('valid');
        input.setCustomValidity('');
    }
}

// NEW FUNCTION: Update form completion status
function updateFormCompletion() {
    const exerciseCards = document.querySelectorAll('.manual-exercise-card');
    const totalExercises = exerciseCards.length;
    const completedExercises = document.querySelectorAll('.manual-exercise-card.has-data').length;
    
    // Update completion indicator (you can add this to the UI if desired)
    const completionRate = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
    
    // Update submit button text
    const submitBtn = document.querySelector('#add-manual-workout-form button[type="submit"]');
    if (submitBtn) {
        if (completedExercises === 0) {
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Workout (No Exercise Data)';
        } else if (completedExercises === totalExercises) {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Add Complete Workout';
            submitBtn.classList.add('btn-success');
            submitBtn.classList.remove('btn-primary');
        } else {
            submitBtn.innerHTML = `<i class="fas fa-plus"></i> Add Workout (${completedExercises}/${totalExercises} exercises)`;
            submitBtn.classList.add('btn-primary');
            submitBtn.classList.remove('btn-success');
        }
    }
}

// ADD NEW FUNCTION: Submit manual workout
async function submitManualWorkout(event) {
    event.preventDefault();
    
    if (!AppState.currentUser) {
        showNotification('Please sign in to add workouts', 'warning');
        return;
    }
    
    // Get form data
    const form = event.target;
    const formData = new FormData(form);
    
    const workoutDate = formData.get('manual-workout-date') || document.getElementById('manual-workout-date')?.value;
    const workoutType = formData.get('manual-workout-type') || document.getElementById('manual-workout-type')?.value;
    const duration = document.getElementById('manual-workout-duration')?.value;
    const status = document.getElementById('manual-workout-status')?.value;
    const notes = document.getElementById('manual-workout-notes')?.value;
    
    if (!workoutDate || !workoutType) {
        showNotification('Please fill in the required fields', 'warning');
        return;
    }
    
    // Check if workout already exists for this date
    const existingWorkout = workoutHistory.currentHistory?.find(w => w.date === workoutDate);
    if (existingWorkout) {
        const confirmOverwrite = confirm(
            `A workout already exists for ${new Date(workoutDate).toLocaleDateString()}. Do you want to overwrite it?`
        );
        if (!confirmOverwrite) return;
    }
    
    try {
        // Build workout data
        const workoutData = {
            date: workoutDate,
            workoutType: workoutType,
            startTime: new Date(workoutDate + 'T09:00:00').toISOString(),
            totalDuration: duration ? parseInt(duration) * 60 : 3600,
            exercises: {},
            exerciseUnits: {},
            addedManually: true,
            manualNotes: notes
        };
        
        // Set status
        if (status === 'completed') {
            workoutData.completedAt = new Date(workoutDate + 'T10:00:00').toISOString();
        } else if (status === 'cancelled') {
            workoutData.cancelledAt = new Date(workoutDate + 'T10:00:00').toISOString();
            workoutData.status = 'cancelled';
        }
        
        // Parse exercise data
        const workout = AppState.workoutPlans?.find(w => w.day === workoutType);
        if (workout) {
            workout.exercises.forEach((exercise, exerciseIndex) => {
                const exerciseData = { sets: [], notes: '' };
                
                // Get exercise notes
                const exerciseNotesInput = form.querySelector(`input[name="exercise_${exerciseIndex}_notes"]`);
                if (exerciseNotesInput?.value) {
                    exerciseData.notes = exerciseNotesInput.value;
                }
                
                // Get sets data
                for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
                    const repsInput = form.querySelector(`input[name="exercise_${exerciseIndex}_set_${setIndex}_reps"]`);
                    const weightInput = form.querySelector(`input[name="exercise_${exerciseIndex}_set_${setIndex}_weight"]`);
                    
                    const reps = repsInput?.value;
                    const weight = weightInput?.value;
                    
                    if (reps && weight) {
                        exerciseData.sets.push({
                            reps: parseInt(reps),
                            weight: parseInt(weight),
                            originalUnit: 'lbs'
                        });
                    } else {
                        exerciseData.sets.push({ reps: '', weight: '' });
                    }
                }
                
                workoutData.exercises[`exercise_${exerciseIndex}`] = exerciseData;
                workoutData.exerciseUnits[exerciseIndex] = 'lbs';
            });
        }
        
        // Save workout
        await workoutHistory.addManualWorkout(workoutData);
        
        // Close modal
        closeAddManualWorkoutModal();
        
        showNotification('Workout added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding manual workout:', error);
        showNotification('Error adding workout. Please try again.', 'error');
    }
}

// ADD NEW FUNCTION: Clear history filters
function clearAllHistoryFilters() {
    console.log('🧹 Clearing search filter...');
    
    // Clear search input
    const searchInput = document.getElementById('workout-search');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset workout history to show all workouts
    if (window.workoutHistory) {
        window.workoutHistory.filterHistory('');
    }
    
    showNotification('Search cleared', 'info');
    console.log('✅ Search filter cleared');
}

// 5. ADD this utility function to main.js:
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function debugWorkoutHistoryState() {
    console.log('🔍 Debugging workout history state...');
    console.log('workoutHistory object:', workoutHistory);
    
    if (workoutHistory) {
        console.log('currentHistory length:', workoutHistory.currentHistory?.length);
        console.log('filteredHistory length:', workoutHistory.filteredHistory?.length);
        console.log('currentPage:', workoutHistory.currentPage);
        
        // Sample workout data structure
        if (workoutHistory.currentHistory && workoutHistory.currentHistory.length > 0) {
            console.log('Sample workout:', workoutHistory.currentHistory[0]);
        }
    }
    
    // Check filter UI elements
    const filterBtns = document.querySelectorAll('.history-filter-btn');
    const activeBtn = document.querySelector('.history-filter-btn.active');
    console.log('Filter buttons:', filterBtns.length);
    console.log('Active filter:', activeBtn?.dataset.filter);
    
    // Check if event listeners are attached
    console.log('Event listeners setup:', window.historyListenersSetup);
}

window.debugWorkoutHistoryState = debugWorkoutHistoryState;

// ===== TESTING QUICK FIX =====
// Add this function to quickly test if the filtering logic works:
function testFilteringLogic() {
    console.log('🧪 Testing filtering logic...');
    
    if (!workoutHistory || !workoutHistory.currentHistory) {
        console.log('❌ No workout history loaded');
        return;
    }
    
    const originalCount = workoutHistory.currentHistory.length;
    console.log('Original workout count:', originalCount);
    
    // Test: Filter to only completed workouts
    const completedWorkouts = workoutHistory.currentHistory.filter(workout => 
        workout.completedAt && !workout.cancelledAt && !workout.status
    );
    
    console.log('Completed workouts found:', completedWorkouts.length);
    
    // Manually apply completed filter
    workoutHistory.filteredHistory = completedWorkouts;
    workoutHistory.currentPage = 1;
    workoutHistory.renderHistory();
    
    console.log('✅ Manual filter test applied');
}

window.testFilteringLogic = testFilteringLogic;

function forceCheckHistoryData() {
    console.log('🔍 Force checking history data...');
    console.log('window.workoutHistory:', window.workoutHistory);
    console.log('global workoutHistory:', workoutHistory);
    
    // Check both references
    if (window.workoutHistory) {
        console.log('window.workoutHistory.currentHistory:', window.workoutHistory.currentHistory?.length);
        console.log('window.workoutHistory.filteredHistory:', window.workoutHistory.filteredHistory?.length);
    }
    
    if (workoutHistory && workoutHistory !== window.workoutHistory) {
        console.log('global workoutHistory.currentHistory:', workoutHistory.currentHistory?.length);  
        console.log('global workoutHistory.filteredHistory:', workoutHistory.filteredHistory?.length);
    }
}

window.forceCheckHistoryData = forceCheckHistoryData;

function fixWorkoutHistoryReference() {
    console.log('🔧 Attempting to fix workout history reference...');
    
    // Check if the data loaded into the workout-history.js module internally
    if (window.workoutHistory && window.workoutHistory.currentHistory.length === 0) {
        console.log('🔄 Forcing history reload on the correct object...');
        
        // Force reload history on the window object
        window.workoutHistory.loadHistory().then(() => {
            console.log('✅ History reloaded on window object');
            console.log('Current history length:', window.workoutHistory.currentHistory.length);
        });
    }
}

function debugManualWorkoutDate() {
    console.log('🔍 DEBUGGING MANUAL WORKOUT DATE ISSUE:');
    console.log('currentManualWorkout.date:', currentManualWorkout.date);
    
    const dateInput = document.getElementById('manual-workout-date');
    console.log('Date input value:', dateInput?.value);
    
    const selectedDate = dateInput?.value;
    if (selectedDate) {
        console.log('Selected date string:', selectedDate);
        console.log('Date object from string:', new Date(selectedDate));
        console.log('ISO string:', new Date(selectedDate).toISOString());
        console.log('Local date string:', new Date(selectedDate).toLocaleDateString());
        
        // Check timezone offset
        const date = new Date(selectedDate);
        console.log('Timezone offset (minutes):', date.getTimezoneOffset());
        console.log('UTC date:', date.toUTCString());
    }
}

async function debugFirebaseWorkoutDates() {
    if (!AppState.currentUser) {
        console.log('❌ No user signed in');
        return;
    }
    
    try {
        const { db, collection, getDocs } = await import('./core/firebase-config.js');
        
        const workoutsRef = collection(db, "users", AppState.currentUser.uid, "workouts");
        const querySnapshot = await getDocs(workoutsRef);
        
        console.log('🔍 FIREBASE WORKOUT DATES DEBUG:');
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Document ID: ${doc.id}, Data date: ${data.date}, Workout: ${data.workoutType}`);
        });
        
    } catch (error) {
        console.error('Error debugging Firebase dates:', error);
    }
}

window.debugFirebaseWorkoutDates = debugFirebaseWorkoutDates;

// ===================================================================
// CONSOLIDATED GLOBAL FUNCTION ASSIGNMENTS FOR MAIN.JS
// Replace the existing global assignments section with this clean version
// ===================================================================

// Core Exercise and Workout Functions
window.focusExercise = focusExercise;
window.updateSet = updateSet;
window.updateNotes = updateNotes;
window.signOutUser = signOutUser;
window.showWorkoutSelector = showWorkoutSelector;
window.loadExerciseHistory = (exerciseName, exerciseIndex) => loadExerciseHistory(exerciseName, exerciseIndex, AppState);
window.markExerciseComplete = markExerciseComplete;
window.toggleModalRestTimer = toggleModalRestTimer;
window.skipModalRestTimer = skipModalRestTimer;
window.swapExercise = swapExercise;
window.confirmExerciseSwap = confirmExerciseSwap;
window.continueInProgressWorkout = continueInProgressWorkout;
window.discardInProgressWorkout = discardInProgressWorkout;
window.cancelCurrentWorkout = cancelCurrentWorkout;
window.selectWorkout = selectWorkout;
window.deleteExerciseFromWorkout = deleteExerciseFromWorkout;

// Manual Workout Functions
window.showAddManualWorkoutModal = showAddManualWorkoutModal;
window.closeAddManualWorkoutModal = closeAddManualWorkoutModal;
window.loadWorkoutTemplate = loadWorkoutTemplate;
window.submitManualWorkout = submitManualWorkout;
window.proceedToExerciseSelection = proceedToExerciseSelection;
window.backToBasicInfo = backToBasicInfo;
window.addExerciseToManualWorkout = addExerciseToManualWorkout;
window.editManualExercise = editManualExercise;
window.removeManualExercise = removeManualExercise;
window.closeManualExerciseEntry = closeManualExerciseEntry;
window.updateManualSet = updateManualSet;
window.updateManualExerciseNotes = updateManualExerciseNotes;
window.addSetToManualExercise = addSetToManualExercise;
window.removeSetFromManualExercise = removeSetFromManualExercise;
window.markManualExerciseComplete = markManualExerciseComplete;
window.finishManualWorkout = finishManualWorkout;
window.addExerciseToActiveWorkout = addExerciseToActiveWorkout;
window.confirmExerciseAddToWorkout = confirmExerciseAddToWorkout;
window.addToManualWorkoutFromLibrary = addToManualWorkoutFromLibrary;

// ===================================================================
// SIMPLIFIED WORKOUT HISTORY FUNCTIONS (NEW APPROACH)
// ===================================================================

// Updated showWorkoutHistory function for simplified table approach
async function showWorkoutHistory() {
    if (!AppState.currentUser) {
        showNotification('Please sign in to view workout history', 'warning');
        return;
    }

    // Hide other sections
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const workoutManagement = document.getElementById('workout-management');
    const historySection = document.getElementById('workout-history-section');
    
    if (workoutSelector) workoutSelector.classList.add('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.add('hidden');
    if (historySection) historySection.classList.remove('hidden');
    
    // Ensure workoutHistory is available
    if (!window.workoutHistory && workoutHistory) {
        window.workoutHistory = workoutHistory;
    }
    
    // Load history and setup table
    if (window.workoutHistory) {
        await window.workoutHistory.loadHistory();
        console.log('✅ History loaded with simplified table interface');
    }
}

// Simplified History Functions (replaces complex filtering)
window.showWorkoutHistory = showWorkoutHistory;

// Table Action Functions - these are called from the table buttons
window.viewWorkoutDetails = function(workoutId) {
    if (!window.workoutHistory) return;
    
    const workout = window.workoutHistory.getWorkoutDetails(workoutId);
    if (!workout) return;

    // Create a simple details display
    const status = window.workoutHistory.getWorkoutStatus(workout);
    const duration = window.workoutHistory.formatDuration(window.workoutHistory.getWorkoutDuration(workout));
    
    const details = `
Workout: ${workout.workoutType}
Date: ${new Date(workout.date).toLocaleDateString()}
Status: ${status.charAt(0).toUpperCase() + status.slice(1)}
Duration: ${duration}
Progress: ${workout.progress?.completedSets || 0}/${workout.progress?.totalSets || 0} sets (${workout.progress?.percentage || 0}%)
${workout.manualNotes ? `\nNotes: ${workout.manualNotes}` : ''}
    `.trim();
    
    alert(details);
};

window.repeatWorkout = function(workoutId) {
    if (window.workoutHistory) {
        window.workoutHistory.repeatWorkout(workoutId);
    }
};

window.deleteWorkout = function(workoutId) {
    if (window.workoutHistory) {
        window.workoutHistory.deleteWorkout(workoutId);
    }
};

// BUG-029 TARGETED FIX: Missing switchTemplateCategory function
// This fixes the specific ReferenceError: switchTemplateCategory is not defined

console.log('🔧 BUG-029: Applying targeted fix for switchTemplateCategory');

// 1. Add the missing switchTemplateCategory function to window object
window.switchTemplateCategory = function(category) {
    console.log('🔧 BUG-029: Switching template category to:', category);
    
    // Store current category globally
    window.currentTemplateCategory = category;
    
    // Update tab appearance
    document.querySelectorAll('.category-tab').forEach(tab => {
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Show/hide content grids
    const defaultGrid = document.getElementById('default-templates');
    const customGrid = document.getElementById('custom-templates');
    
    if (defaultGrid && customGrid) {
        if (category === 'default') {
            defaultGrid.classList.remove('hidden');
            customGrid.classList.add('hidden');
        } else if (category === 'custom') {
            defaultGrid.classList.add('hidden');
            customGrid.classList.remove('hidden');
        }
    }
    
    // Load templates for this category
    loadTemplatesByCategory(category);
};

// 2. Add the missing loadTemplatesByCategory function if it doesn't exist
if (typeof window.loadTemplatesByCategory === 'undefined') {
    window.loadTemplatesByCategory = async function(category) {
        console.log('🔧 BUG-029: Loading templates for category:', category);
        
        const defaultGrid = document.getElementById('default-templates');
        const customGrid = document.getElementById('custom-templates');
        
        if (!defaultGrid || !customGrid) {
            console.warn('❌ BUG-029: Template grids not found');
            return;
        }
        
        try {
            if (category === 'default') {
                // Load default templates
                defaultGrid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading default templates...</span></div>';
                
                const defaultTemplates = window.AppState?.workoutPlans || [];
                
                if (defaultTemplates.length === 0) {
                    defaultGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-clipboard-list"></i>
                            <h3>No Default Templates</h3>
                            <p>Default workout templates are loading...</p>
                        </div>
                    `;
                    return;
                }
                
                defaultGrid.innerHTML = '';
                defaultTemplates.forEach(template => {
                    const card = createTemplateCard(template, true);
                    defaultGrid.appendChild(card);
                });
                
            } else if (category === 'custom') {
                // Load custom templates
                customGrid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading custom templates...</span></div>';
                
                if (!window.AppState?.currentUser) {
                    customGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-sign-in-alt"></i>
                            <h3>Sign In Required</h3>
                            <p>Please sign in to view your custom templates</p>
                        </div>
                    `;
                    return;
                }
                
                // Load custom templates from Firebase
                try {
                    const { WorkoutManager } = await import('./core/workout/workout-manager.js');
                    const workoutManager = new WorkoutManager(window.AppState);
                    const customTemplates = await workoutManager.getUserWorkoutTemplates() || [];
                    
                    if (customTemplates.length === 0) {
                        customGrid.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-plus-circle"></i>
                                <h3>No Custom Templates</h3>
                                <p>Create your first custom workout template!</p>
                            </div>
                        `;
                        return;
                    }
                    
                    customGrid.innerHTML = '';
                    customTemplates.forEach(template => {
                        const card = createTemplateCard(template, false);
                        customGrid.appendChild(card);
                    });
                    
                } catch (error) {
                    console.error('❌ BUG-029: Error loading custom templates:', error);
                    customGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Error Loading Templates</h3>
                            <p>Please try again later.</p>
                        </div>
                    `;
                }
            }
            
        } catch (error) {
            console.error('❌ BUG-029: Error in loadTemplatesByCategory:', error);
        }
    };
}

// 3. Add the createTemplateCard function if it doesn't exist
if (typeof window.createTemplateCard === 'undefined') {
    window.createTemplateCard = function(template, isDefault = false) {
        const card = document.createElement('div');
        card.className = 'template-card';
        
        const exerciseCount = template.exercises?.length || 0;
        const exercisePreview = template.exercises?.slice(0, 3).map(ex => 
            ex.name || ex.machine
        ).join(', ') || 'No exercises';
        const moreText = exerciseCount > 3 ? ` and ${exerciseCount - 3} more...` : '';
        
        // Use template.id for custom templates, template.day for default templates
        const templateId = template.id || template.day;
        
        card.innerHTML = `
            <h4>${template.name || template.day}</h4>
            <div class="template-category">${getWorkoutCategory(template.day || template.category)}</div>
            <div class="template-exercises-preview">
                ${exerciseCount} exercises: ${exercisePreview}${moreText}
            </div>
            <div class="template-actions">
                <button class="btn btn-primary btn-small" onclick="useTemplateFromManagement('${templateId}', ${isDefault})">
                    <i class="fas fa-play"></i> Use Today
                </button>
                <button class="btn btn-secondary btn-small" onclick="${isDefault ? `customizeDefaultTemplate('${template.day}')` : `editTemplate('${template.id}')`}">
                    <i class="fas fa-${isDefault ? 'copy' : 'edit'}"></i> ${isDefault ? 'Customize' : 'Edit'}
                </button>
                ${!isDefault ? 
                    `<button class="btn btn-danger btn-small" onclick="deleteTemplate('${template.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>` : ''
                }
            </div>
        `;
        
        return card;
    };
}

// 4. Add missing helper functions
if (typeof window.getWorkoutCategory === 'undefined') {
    window.getWorkoutCategory = function(workoutName) {
        if (!workoutName) return 'Other';
        const name = workoutName.toLowerCase();
        if (name.includes('chest') || name.includes('push')) return 'Push';
        if (name.includes('back') || name.includes('pull')) return 'Pull';
        if (name.includes('legs') || name.includes('leg')) return 'Legs';
        if (name.includes('cardio') || name.includes('core')) return 'Cardio';
        return 'Other';
    };
}

// 5. Ensure other missing functions are available
if (typeof window.useTemplateFromManagement === 'undefined') {
    window.useTemplateFromManagement = async function(templateId, isDefault) {
        console.log('🔧 BUG-029: useTemplateFromManagement called:', { templateId, isDefault });
        
        try {
            // Hide management UI
            const workoutManagement = document.getElementById('workout-management');
            if (workoutManagement) {
                workoutManagement.classList.add('hidden');
            }
            
            // Show workout selector
            const workoutSelector = document.getElementById('workout-selector');
            if (workoutSelector) {
                workoutSelector.classList.remove('hidden');
            }
            
            // Call selectTemplate if it exists
            if (typeof window.selectTemplate === 'function') {
                await window.selectTemplate(templateId, isDefault);
            } else {
                console.error('❌ BUG-029: selectTemplate function not found');
                showNotification('Error: Template selection not available', 'error');
            }
            
        } catch (error) {
            console.error('❌ BUG-029: Error in useTemplateFromManagement:', error);
            showNotification('Error starting template', 'error');
        }
    };
}

// 7. Initialize with default templates when management is shown
const originalShowWorkoutManagement = window.showWorkoutManagement;
if (typeof originalShowWorkoutManagement === 'function') {
    window.showWorkoutManagement = function() {
        // Call original function
        const result = originalShowWorkoutManagement.apply(this, arguments);
        
        // Ensure default category is loaded
        setTimeout(() => {
            if (typeof window.switchTemplateCategory === 'function') {
                window.switchTemplateCategory('default');
            }
        }, 200);
        
        return result;
    };
}


// Template Selection Functions
window.showTemplateSelection = showTemplateSelection;
window.closeTemplateSelection = closeTemplateSelection;
window.selectTemplate = selectTemplate;
window.customizeDefaultTemplate = customizeDefaultTemplate;

// Exercise Video Functions
window.showExerciseVideo = showExerciseVideo;
window.hideExerciseVideo = hideExerciseVideo;

// Quick Add Functions
window.showQuickAddExercise = showQuickAddExercise;
window.hideQuickAddExercise = hideQuickAddExercise;
window.quickAddExercise = quickAddExercise;

// Workout Management Functions
window.showWorkoutManagement = showWorkoutManagement;
window.createNewTemplate = createNewTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.useTemplate = useTemplate;
window.closeTemplateEditor = closeTemplateEditor;
window.saveCurrentTemplate = saveCurrentTemplate;
window.addExerciseToTemplate = addExerciseToTemplate;
window.editTemplateExercise = editTemplateExercise;
window.removeTemplateExercise = removeTemplateExercise;
window.closeExerciseLibrary = closeExerciseLibraryEnhanced;
window.showCreateExerciseForm = showCreateExerciseForm;
window.closeCreateExerciseModal = closeCreateExerciseModal;
window.createNewExercise = createNewExerciseEnhanced;

// Template Editor Functions
window.showTemplateEditorWithData = showTemplateEditorWithData;
window.addExerciseToCurrentTemplate = addExerciseToCurrentTemplate;
window.updateTemplateExerciseParam = updateTemplateExerciseParam;
window.removeExerciseFromTemplate = removeExerciseFromTemplate;
window.editTemplateExerciseInEditor = editTemplateExerciseInEditor;
window.saveTemplateFromEditor = saveTemplateFromEditor;
window.cancelTemplateEditor = cancelTemplateEditor;
window.openExerciseLibraryForTemplate = openExerciseLibraryForTemplate;
window.renderExerciseLibraryForTemplate = renderExerciseLibraryForTemplate;
window.createExerciseLibraryCardForTemplate = createExerciseLibraryCardForTemplate;
window.addExerciseToTemplateFromLibrary = addExerciseToTemplateFromLibrary;
window.closeExerciseLibraryForTemplate = closeExerciseLibraryForTemplate;

// Validation and State Functions
window.AppState = AppState;
window.updateExerciseProgress = updateExerciseProgress;
window.validateSetInput = validateSetInput;
window.updateFormCompletion = updateFormCompletion;
window.fillTemplateValues = fillTemplateValues;
window.validateUserData = validateUserData;
window.handleUnknownWorkout = handleUnknownWorkout;

// BUG-029 SIMPLE FIX: Expose existing functions to window for HTML onclick
window.switchTemplateCategory = switchTemplateCategory;
window.loadTemplatesByCategory = loadTemplatesByCategory;
window.showCreateTemplateModal = showCreateTemplateModal;
window.closeCreateTemplateModal = closeCreateTemplateModal
window.createTemplate = createTemplate;

window.refreshExerciseDatabase = refreshExerciseDatabase;

// ===================================================================
// REMOVED FUNCTIONS (No longer needed with simplified approach)
// ===================================================================
// window.applyHistoryFilters = applyHistoryFilters; // REMOVED - handled in workout-history.js
// window.setupWorkoutHistoryEventListeners = setupWorkoutHistoryEventListeners; // REMOVED - handled in workout-history.js  
// window.clearHistoryFilters = clearAllHistoryFilters; // REMOVED - now just clear search
// window.filterWorkoutHistory = filterWorkoutHistory; // REMOVED - simplified to search only
