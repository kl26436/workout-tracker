// Main application entry point - Modular Version
import { auth, provider, onAuthStateChanged, signInWithPopup, signOut } from './core/firebase-config.js';
import { AppState } from './core/app-state.js';
import { showNotification, setTodayDisplay, convertWeight, updateProgress } from './core/ui-helpers.js';
import { saveWorkoutData, loadTodaysWorkout, loadWorkoutPlans, loadExerciseHistory } from './core/data-manager.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Enhanced Big Surf Workout Tracker (Modular)...');
    initializeWorkoutApp();
    setupEventListeners();
    setTodayDisplay();
    loadWorkoutPlans(AppState);
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
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    
    AppState.clearTimers();
    
    // Don't reset the data - keep it for re-selection
    AppState.currentWorkout = null;
    
    if (Object.keys(AppState.savedData.exercises || {}).length > 0) {
        showNotification('Workout progress saved. You can continue where you left off.', 'info');
    }
}

async function selectWorkout(workoutType, existingData = null) {
    if (!AppState.currentUser) {
        showNotification('Please sign in to select a workout', 'warning');
        return;
    }

    // Find the workout plan
    const workout = AppState.workoutPlans.find(w => w.day === workoutType);
    if (!workout) {
        showNotification('Workout plan not found', 'error');
        return;
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
        unitToggle.innerHTML = `
            <button class="unit-btn ${currentUnit === 'lbs' ? 'active' : ''}" data-unit="lbs">lbs</button>
            <button class="unit-btn ${currentUnit === 'kg' ? 'active' : ''}" data-unit="kg">kg</button>
        `;

        // Add event listeners for this modal's unit toggle
        unitToggle.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', () => setExerciseUnit(index, btn.dataset.unit));
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
            <button class="btn btn-secondary btn-small" onclick="loadExerciseHistory('${exercise.machine}', ${exerciseIndex})">
                <i class="fas fa-history"></i> Show Last Workout
            </button>
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
                  onchange="updateNotes(${exerciseIndex}, this.value)"
                  style="width: 100%; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; color: var(--text-primary); resize: vertical; min-height: 80px; font-family: inherit; margin-top: 1rem;">${savedNotes}</textarea>
        
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

// Set and note updating
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
        exerciseData.sets.push({ reps: '', weight: '' });
    }
    
    exerciseData.sets[setIndex][field] = value;
    
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

// Unit management
function setGlobalUnit(unit) {
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
    AppState.exerciseUnits[exerciseIndex] = unit;
    
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
    
    // Save unit preference
    saveWorkoutData(AppState);
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

// Make functions globally accessible for onclick handlers
window.focusExercise = focusExercise;
window.updateSet = updateSet;
window.updateNotes = updateNotes;
window.signOutUser = signOutUser;
window.loadExerciseHistory = (exerciseName, exerciseIndex) => loadExerciseHistory(exerciseName, exerciseIndex, AppState);
window.markExerciseComplete = markExerciseComplete;
window.toggleModalRestTimer = toggleModalRestTimer;
window.skipModalRestTimer = skipModalRestTimer;

console.log('✅ Enhanced Big Surf Workout Tracker (Modular) loaded successfully!');