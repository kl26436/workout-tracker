// Main application entry point - Enhanced with Exercise Swapping
import { auth, provider, onAuthStateChanged, signInWithPopup, signOut } from './core/firebase-config.js';
import { AppState } from './core/app-state.js';
import { showNotification, setTodayDisplay, convertWeight, updateProgress } from './core/ui-helpers.js';
import { saveWorkoutData, loadTodaysWorkout, loadWorkoutPlans, loadExerciseHistory } from './core/data-manager.js';
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
    createNewExercise
} from './core/workout/workout-management-ui.js';

// State variables
let selectedWorkoutCategory = null;
let currentTemplateCategory = 'default';
let currentEditingTemplate = null;
let isEditingMode = false;

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
    // Set up auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            AppState.currentUser = user;
            showUserInfo(user);
            await loadWorkoutPlans(AppState);
            
            // Try to load today's workout
            const todaysData = await loadTodaysWorkout(AppState);
            if (todaysData) {
                selectWorkout(todaysData.workoutType, todaysData);
            } else {
                showWorkoutSelector();
            }
        } else {
            AppState.currentUser = null;
            showSignInButton();
        }
    });
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
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.add('hidden');
    
    AppState.clearTimers();
    
    // Don't reset the data - keep it for re-selection
    AppState.currentWorkout = null;
    
    // Hide workout management if it was open
    hideWorkoutManagement();
    
    if (Object.keys(AppState.savedData.exercises || {}).length > 0) {
        showNotification('Workout progress saved. You can continue where you left off.', 'info');
    }
}

async function selectWorkout(workoutType, existingData = null, customWorkout = null) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to select a workout', 'warning');
        return;
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
}

function startWorkoutDurationTimer() {
    // This is now handled in updateWorkoutDisplay
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

    AppState.currentWorkout.exercises.forEach((exercise, index) => {
        const card = createExerciseCard(exercise, index);
        container.appendChild(card);
    });
    
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

    card.innerHTML = `
        <div class="exercise-header">
            <h3 class="exercise-title">${exercise.machine}</h3>
            <div class="exercise-actions">
                <button class="btn btn-secondary btn-small" onclick="swapExercise(${index})" title="Swap this exercise">
                    <i class="fas fa-exchange-alt"></i>
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

// Exercise Swapping Functions
async function swapExercise(exerciseIndex) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to swap exercises', 'warning');
        return;
    }
    
    // Store the current exercise index for the swap
    AppState.swappingExerciseIndex = exerciseIndex;
    
    // Open exercise library in swap mode
    const modal = document.getElementById('exercise-library-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Load exercise library with WorkoutManager
    const { WorkoutManager } = await import('./core/workout/workout-manager.js');
    const workoutManager = new WorkoutManager(AppState);
    const exerciseLibrary = await workoutManager.getExerciseLibrary();
    
    renderExerciseLibraryForSwap(exerciseLibrary);
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
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    updateDisplay();
    
    modalTimer.timerData = {
        interval: setInterval(() => {
            if (!isPaused && timeLeft > 0) {
                timeLeft--;
                updateDisplay();
                
                if (timeLeft === 0) {
                    timerDisplay.textContent = 'Ready!';
                    timerDisplay.style.color = 'var(--success)';
                    
                    if ('vibrate' in navigator) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    
                    showNotification('Rest period complete! 💪', 'success');
                    
                    setTimeout(() => {
                        modalTimer.classList.add('hidden');
                        timerDisplay.style.color = 'var(--primary)';
                    }, 5000);
                }
            }
        }, 1000),
        
        pause: () => {
            isPaused = !isPaused;
            const pauseBtn = modalTimer.querySelector('.modal-rest-controls .btn:first-child');
            if (pauseBtn) {
                pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            }
        },
        
        skip: () => {
            clearInterval(modalTimer.timerData.interval);
            modalTimer.classList.add('hidden');
            timerDisplay.style.color = 'var(--primary)';
        }
    };
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
        clearInterval(modalTimer.timerData.interval);
        modalTimer.timerData = null;
        modalTimer.classList.add('hidden');
    }
}

// Enhanced Exercise Library Functions
function closeExerciseLibraryEnhanced() {
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
    
    // Reset swapping state
    AppState.swappingExerciseIndex = null;
    
    // Call the original close function to maintain compatibility
    closeExerciseLibrary();
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
        // If we're in swap mode, use the exercise immediately
        if (AppState.swappingExerciseIndex !== null && AppState.swappingExerciseIndex !== undefined) {
            await confirmExerciseSwap(name, exerciseData);
            hideQuickAddExercise();
            return;
        }
        
        // Otherwise, add to library and show success
        if (AppState.currentUser) {
            const { WorkoutManager } = await import('./core/workout/workout-manager.js');
            const workoutManager = new WorkoutManager(AppState);
            await workoutManager.createExercise(exerciseData);
        }
        
        showNotification(`Exercise "${name}" added to library!`, 'success');
        hideQuickAddExercise();
        
        // Refresh library if open
        const modal = document.getElementById('exercise-library-modal');
        if (modal && !modal.classList.contains('hidden')) {
            location.reload();
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
    
    // Store the context that we're adding to template
    AppState.addingToTemplate = true;
    AppState.templateEditingContext = currentEditingTemplate;
    
    // Open exercise library
    await openExerciseLibraryForTemplate();
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

// Open Exercise Library for Template
async function openExerciseLibraryForTemplate() {
    const modal = document.getElementById('exercise-library-modal');
    if (!modal) return;
    
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
        const exerciseLibrary = await workoutManager.getExerciseLibrary();
        
        renderExerciseLibraryForTemplate(exerciseLibrary);
    } catch (error) {
        console.error('Error loading exercise library:', error);
        showNotification('Error loading exercises', 'error');
    }
}

// Render Exercise Library for Template
function renderExerciseLibraryForTemplate(exercises) {
    const grid = document.getElementById('exercise-library-grid');
    if (!grid) return;
    
    if (exercises.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Exercises Found</h3>
                <p>Try adjusting your search or create a new exercise.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    exercises.forEach(exercise => {
        const card = createExerciseLibraryCardForTemplate(exercise);
        grid.appendChild(card);
    });
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
    
    // Re-render exercises
    renderTemplateEditorExercises();
    
    // Close library
    closeExerciseLibraryForTemplate();
    
    showNotification(`Added "${templateExercise.name}" to template`, 'success');
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

// Global function assignments for onclick handlers
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

// Workout Management Global Functions
window.showWorkoutManagement = showWorkoutManagement;
window.createNewTemplate = createNewTemplate;
window.editTemplate = editTemplate; // Single definition
window.deleteTemplate = deleteTemplate;
window.useTemplate = useTemplate;
window.closeTemplateEditor = closeTemplateEditor;
window.saveCurrentTemplate = saveCurrentTemplate;
window.addExerciseToTemplate = addExerciseToTemplate;
window.editTemplateExercise = editTemplateExercise;
window.removeTemplateExercise = removeTemplateExercise;
window.closeExerciseLibrary = closeExerciseLibraryEnhanced;
window.searchExerciseLibrary = searchExerciseLibrary;
window.filterExerciseLibrary = filterExerciseLibrary;
window.showCreateExerciseForm = showCreateExerciseForm;
window.closeCreateExerciseModal = closeCreateExerciseModal;
window.createNewExercise = createNewExerciseEnhanced;

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

// Template Management Functions
window.showCreateTemplateModal = showCreateTemplateModal;
window.closeCreateTemplateModal = closeCreateTemplateModal;
window.createTemplate = createTemplate;
window.switchTemplateCategory = switchTemplateCategory;
window.useTemplateFromManagement = useTemplateFromManagement;

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

console.log('✅ Enhanced Big Surf Workout Tracker loaded successfully!');