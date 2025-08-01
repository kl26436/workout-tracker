// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6",
  storageBucket: "workout-tracker-b94b6.appspot.com",
  messagingSenderId: "111958991290",
  appId: "1:111958991290:web:23e1014ab2ba27df6ebd83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Enhanced App State
let currentUser = null;
let currentWorkout = null;
let savedData = {};
let workoutPlans = [];
let exerciseDatabase = [];
let globalRestTimer = null;
let workoutStartTime = null;
let workoutDurationTimer = null;
let globalUnit = 'lbs';
let exerciseUnits = {}; // Per-exercise unit preferences
let focusedExerciseIndex = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Enhanced Big Surf Workout Tracker...');
    initializeWorkoutApp();
    setupEventListeners();
    setTodayDisplay();
    loadData();
});

function initializeWorkoutApp() {
    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            showUserInfo(user);
            loadData();
            loadTodaysWorkout();
        } else {
            currentUser = null;
            showSignInButton();
        }
    });
}

function setupEventListeners() {
    // Tab navigation (if you have tabs)
    document.querySelectorAll('.nav-tab')?.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

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

async function loadData() {
    try {
        console.log('📥 Loading workout data...');
        
        // Load workout plans
        const workoutResponse = await fetch('./workouts.json');
        if (workoutResponse.ok) {
            workoutPlans = await workoutResponse.json();
            console.log('✅ Workout plans loaded:', workoutPlans.length);
        } else {
            console.error('❌ Failed to load workouts.json');
            workoutPlans = getDefaultWorkouts();
        }
        
        // Load exercise database
        const exerciseResponse = await fetch('./exercises.json');
        if (exerciseResponse.ok) {
            exerciseDatabase = await exerciseResponse.json();
            console.log('✅ Exercise database loaded:', exerciseDatabase.length);
        } else {
            console.error('❌ Failed to load exercises.json');
            exerciseDatabase = getDefaultExercises();
        }
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showNotification('Error loading workout data. Using defaults.', 'error');
        workoutPlans = getDefaultWorkouts();
        exerciseDatabase = getDefaultExercises();
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
        userInfo.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-primary); font-weight: bold;">
                        ${user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <span>Welcome, ${user.displayName || user.email}</span>
                </div>
                <button class="btn btn-secondary btn-small" onclick="signOutUser()">
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

// Date and UI functions
function setTodayDisplay() {
    const today = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const todayDateDisplay = document.getElementById('today-date-display');
    if (todayDateDisplay) {
        todayDateDisplay.textContent = `Today - ${today.toLocaleDateString('en-US', options)}`;
    }
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// Today's Workout Functions
async function loadTodaysWorkout() {
    if (!currentUser) return;

    const today = getTodayDateString();
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", today);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only load if it's actually today's workout AND not completed
            if (data.workoutType && 
                data.workoutType !== 'none' && 
                data.date === today && 
                !data.completedAt) {
                console.log('📅 Loading today\'s in-progress workout:', data.workoutType);
                selectWorkout(data.workoutType, data);
            } else {
                if (data.completedAt) {
                    console.log('✅ Previous workout was completed, starting fresh');
                }
                showWorkoutSelector(); // Show fresh workout selector
            }
        } else {
            showWorkoutSelector();
        }
    } catch (error) {
        console.error('❌ Error loading today\'s workout:', error);
        showWorkoutSelector();
    }
}

function showWorkoutSelector() {
    // If we have an active workout, ask for confirmation
    if (currentWorkout && savedData.workoutType) {
        const hasProgress = Object.keys(savedData.exercises || {}).some(key => {
            const exercise = savedData.exercises[key];
            return exercise.sets && exercise.sets.some(set => set.reps || set.weight);
        });
        
        if (hasProgress) {
            const confirmChange = confirm(
                'You have progress on your current workout. Changing will save your progress but return you to workout selection. Continue?'
            );
            if (!confirmChange) {
                return; // User chose to stay
            }
        }
    }
    
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    
    clearAllTimers();
    
    // Reset current workout state but keep saved data
    currentWorkout = null;
    exerciseUnits = {};
    
    showNotification('Workout progress saved. Select a new workout to continue.', 'info');
}

async function selectWorkout(workoutType, existingData = null) {
    if (!currentUser) {
        showNotification('Please sign in to select a workout', 'warning');
        return;
    }

    // Find the workout plan
    const workout = workoutPlans.find(w => w.day === workoutType);
    if (!workout) {
        showNotification('Workout plan not found', 'error');
        return;
    }

    currentWorkout = workout;
    
    // Load existing data or start fresh
    if (existingData) {
        savedData = existingData;
        workoutStartTime = existingData.startTime ? new Date(existingData.startTime) : new Date();
        
        // Restore exercise units from saved data
        if (existingData.exerciseUnits) {
            exerciseUnits = existingData.exerciseUnits;
        } else {
            // Initialize with global unit
            currentWorkout.exercises.forEach((exercise, index) => {
                exerciseUnits[index] = globalUnit;
            });
        }
    } else {
        savedData = {
            workoutType: workoutType,
            date: getTodayDateString(),
            startTime: new Date().toISOString(),
            exercises: {},
            exerciseUnits: {}
        };
        workoutStartTime = new Date();
        
        // Initialize exercise units
        currentWorkout.exercises.forEach((exercise, index) => {
            exerciseUnits[index] = globalUnit;
        });
    }

    // Save the workout selection
    await saveWorkoutData();

    // Update UI
    updateWorkoutDisplay(workoutType);
    document.getElementById('workout-selector')?.classList.add('hidden');
    document.getElementById('active-workout')?.classList.remove('hidden');
    
    renderExercises();
    startWorkoutDurationTimer();

    showNotification(`${workoutType} workout started!`, 'success');
}

function updateWorkoutDisplay(workoutName) {
    const titleEl = document.getElementById('current-workout-title');
    const metaEl = document.getElementById('workout-meta');
    
    if (titleEl) titleEl.textContent = workoutName;
    
    // Simple elapsed time display
    const updateTime = () => {
        if (!workoutStartTime || !metaEl) return;
        const elapsed = Math.floor((new Date() - workoutStartTime) / 1000 / 60);
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
    clearInterval(workoutDurationTimer);
    workoutDurationTimer = setInterval(updateTime, 60000); // Update every minute
    
    updateProgress();
}

function startWorkoutDurationTimer() {
    // This is now handled in updateWorkoutDisplay
}

async function finishWorkout() {
    if (!currentWorkout || !currentUser) return;

    if (!confirm('Finish this workout?')) return;

    // Stop duration timer
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }

    // Update saved data with completion info
    savedData.completedAt = new Date().toISOString();
    savedData.totalDuration = Math.floor((new Date() - workoutStartTime) / 1000);
    
    // Save final data
    await saveWorkoutData();

    showNotification('Workout completed! Great job! 💪', 'success');
    showWorkoutSelector();
    
    // Reset state
    currentWorkout = null;
    savedData = {};
    workoutStartTime = null;
    exerciseUnits = {};
    clearAllTimers();
}

function renderExercises() {
    const container = document.getElementById('exercise-list');
    if (!container || !currentWorkout) return;
    
    container.innerHTML = '';

    currentWorkout.exercises.forEach((exercise, index) => {
        const card = createExerciseCard(exercise, index);
        container.appendChild(card);
    });
    
    updateProgress();
}

function createExerciseCard(exercise, index) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.index = index;

    const unit = exerciseUnits[index] || globalUnit;
    const savedSets = savedData.exercises?.[`exercise_${index}`]?.sets || [];
    
    // Check if completed
    const completedSets = savedSets.filter(set => set && set.reps && set.weight).length;
    if (completedSets === exercise.sets) {
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
    const sets = savedData.exercises?.[`exercise_${exerciseIndex}`]?.sets || [];
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
    if (!currentWorkout) return;
    
    focusedExerciseIndex = index;
    const exercise = currentWorkout.exercises[index];
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('modal-exercise-title');
    const content = document.getElementById('modal-exercise-content');

    if (!modal || !title || !content) return;

    title.textContent = exercise.machine;
    
    // Set up per-exercise unit toggle
    const unitToggle = modal.querySelector('.exercise-unit-toggle .unit-toggle');
    const currentUnit = exerciseUnits[index] || globalUnit;
    
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

function closeExerciseModalHandler() {
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Clear any modal rest timers
    if (focusedExerciseIndex !== null) {
        clearModalRestTimer(focusedExerciseIndex);
    }
    
    focusedExerciseIndex = null;
    renderExercises(); // Refresh the main view
}

function generateExerciseTable(exercise, exerciseIndex, unit) {
    const savedSets = savedData.exercises?.[`exercise_${exerciseIndex}`]?.sets || [];
    const savedNotes = savedData.exercises?.[`exercise_${exerciseIndex}`]?.notes || '';
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
                    <th>Target</th>
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
                <td style="color: var(--text-secondary); font-size: 0.875rem;">
                    ${exercise.reps} × ${convertedWeight} ${unit}
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

async function updateSet(exerciseIndex, setIndex, field, value) {
    if (!currentUser) return;
    
    console.log(`Updating set: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
    
    // Initialize data structure if needed
    if (!savedData.exercises) savedData.exercises = {};
    if (!savedData.exercises[`exercise_${exerciseIndex}`]) {
        savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    const exerciseData = savedData.exercises[`exercise_${exerciseIndex}`];
    
    // Ensure sets array is the right length
    while (exerciseData.sets.length <= setIndex) {
        exerciseData.sets.push({ reps: '', weight: '' });
    }
    
    exerciseData.sets[setIndex][field] = value;
    
    // Save to Firebase
    await saveWorkoutData();
    
    // Start rest timer when both reps and weight are entered
    const setData = exerciseData.sets[setIndex];
    if (setData.reps && setData.weight) {
        // Check if we're in modal view
        const modal = document.getElementById('exercise-modal');
        if (modal && modal.classList.contains('active') && focusedExerciseIndex === exerciseIndex) {
            startModalRestTimer(exerciseIndex, setIndex);
        } else {
            startRestTimer(exerciseIndex, setIndex);
        }
        showNotification(`Set ${setIndex + 1} recorded! Rest timer started.`, 'success');
    }
    
    updateProgress();
}

function startModalRestTimer(exerciseIndex, setIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    const setNumber = setIndex + 1;
    
    // Clear any existing timers
    clearGlobalRestTimer();
    clearModalRestTimer(exerciseIndex);
    
    // Show modal timer
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    const exerciseLabel = modalTimer?.querySelector('.modal-rest-exercise');
    const timerDisplay = modalTimer?.querySelector('.modal-rest-display');
    
    if (!modalTimer || !exerciseLabel || !timerDisplay) {
        console.warn('Modal rest timer elements not found');
        return;
    }
    
    console.log(`Starting modal rest timer for ${exercise.machine} - Set ${setNumber}`);
    
    exerciseLabel.textContent = `Set ${setNumber} Complete - Rest Period`;
    modalTimer.classList.remove('hidden');
    
    let timeLeft = 90; // 90 seconds rest
    let isPaused = false;
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.style.color = 'var(--primary)';
    };
    
    updateDisplay();
    
    // Store timer reference on the modal timer element
    modalTimer.timerData = {
        interval: setInterval(() => {
            if (!isPaused && timeLeft > 0) {
                timeLeft--;
                updateDisplay();
                
                if (timeLeft === 0) {
                    // Timer finished
                    timerDisplay.textContent = 'Ready!';
                    timerDisplay.style.color = 'var(--success)';
                    
                    // Vibrate if supported
                    if ('vibrate' in navigator) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    
                    showNotification('Rest period complete! 💪', 'success');
                    
                    // Auto-hide after 5 seconds
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
                pauseBtn.innerHTML = isPaused ? 
                    '<i class="fas fa-play"></i>' : 
                    '<i class="fas fa-pause"></i>';
            }
            console.log(`Modal rest timer ${isPaused ? 'paused' : 'resumed'}`);
        },
        
        skip: () => {
            clearInterval(modalTimer.timerData.interval);
            modalTimer.classList.add('hidden');
            timerDisplay.style.color = 'var(--primary)';
            console.log('Modal rest timer skipped');
        }
    };
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

function clearModalRestTimer(exerciseIndex) {
    const modalTimer = document.getElementById(`modal-rest-timer-${exerciseIndex}`);
    if (modalTimer && modalTimer.timerData) {
        clearInterval(modalTimer.timerData.interval);
        modalTimer.timerData = null;
        modalTimer.classList.add('hidden');
    }
}

async function updateNotes(exerciseIndex, notes) {
    if (!currentUser) return;
    
    if (!savedData.exercises) savedData.exercises = {};
    if (!savedData.exercises[`exercise_${exerciseIndex}`]) {
        savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
    }
    
    savedData.exercises[`exercise_${exerciseIndex}`].notes = notes;
    await saveWorkoutData();
}

async function saveWorkoutData() {
    if (!currentUser) return;
    
    const saveDate = savedData.date || getTodayDateString();
    savedData.date = saveDate;
    savedData.exerciseUnits = exerciseUnits; // Save exercise unit preferences
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", saveDate);
        await setDoc(docRef, {
            ...savedData,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('💾 Workout data saved successfully for', saveDate);
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Failed to save workout data', 'error');
    }
}

function updateProgress() {
    if (!currentWorkout || !savedData.exercises) return;
    
    let completedSets = 0;
    let totalSets = 0;
    
    currentWorkout.exercises.forEach((exercise, index) => {
        totalSets += exercise.sets;
        const sets = savedData.exercises[`exercise_${index}`]?.sets || [];
        const exerciseCompletedSets = sets.filter(set => set && set.reps && set.weight).length;
        completedSets += exerciseCompletedSets;
    });
    
    const progressEl = document.getElementById('completed-progress');
    if (progressEl) {
        progressEl.textContent = `${completedSets}/${totalSets}`;
    }
}

async function loadExerciseHistory(exerciseName, exerciseIndex) {
    if (!currentUser) return;
    
    const historyDisplay = document.getElementById(`exercise-history-${exerciseIndex}`);
    const historyButton = document.querySelector(`button[onclick="loadExerciseHistory('${exerciseName}', ${exerciseIndex})"]`);
    
    if (!historyDisplay || !historyButton) return;
    
    // If already showing, hide it and change button text back
    if (!historyDisplay.classList.contains('hidden')) {
        historyDisplay.classList.add('hidden');
        historyButton.innerHTML = '<i class="fas fa-history"></i> Show Last Workout';
        return;
    }
    
    // Change button text to indicate it can be hidden
    historyButton.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Last Workout';
    
    try {
        // Query for recent workouts containing this exercise
        const workoutsRef = collection(db, "users", currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(15));
        const querySnapshot = await getDocs(q);
        
        let lastWorkout = null;
        let lastExerciseData = null;
        let workoutDate = null;
        
        // Find the most recent workout with this exercise (excluding today)
        const today = getTodayDateString();
        
        querySnapshot.forEach((doc) => {
            if (lastWorkout) return; // Already found one
            
            const data = doc.data();
            
            // Skip today's workout
            if (data.date === today) return;
            
            if (data.exercises) {
                // Look through exercises to find matching one
                Object.keys(data.exercises).forEach(key => {
                    if (key.startsWith('exercise_')) {
                        const exerciseData = data.exercises[key];
                        // We need to find the exercise by matching the workout plan
                        const workout = workoutPlans.find(w => w.day === data.workoutType);
                        if (workout) {
                            const exerciseIdx = parseInt(key.split('_')[1]);
                            const exercise = workout.exercises[exerciseIdx];
                            if (exercise && exercise.machine === exerciseName && exerciseData.sets && exerciseData.sets.length > 0) {
                                // Check if there are actually completed sets
                                const completedSets = exerciseData.sets.filter(set => set && set.reps && set.weight);
                                if (completedSets.length > 0) {
                                    lastWorkout = data;
                                    lastExerciseData = exerciseData;
                                    workoutDate = data.date;
                                }
                            }
                        }
                    }
                });
            }
        });
        
        if (lastWorkout && lastExerciseData) {
            const displayDate = new Date(workoutDate).toLocaleDateString();
            const unit = exerciseUnits[exerciseIndex] || globalUnit;
            
            let historyHTML = `
                <div class="exercise-history-content" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                    <h5 style="margin: 0 0 0.5rem 0; color: var(--primary);">Last Workout (${displayDate}):</h5>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            
            lastExerciseData.sets.forEach((set, index) => {
                if (set.reps && set.weight) {
                    // Convert weight to current unit if needed (assuming stored in lbs)
                    const convertedWeight = convertWeight(set.weight, 'lbs', unit);
                    historyHTML += `
                        <div style="background: var(--bg-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                            Set ${index + 1}: ${set.reps} × ${convertedWeight} ${unit}
                        </div>
                    `;
                }
            });
            
            if (lastExerciseData.notes) {
                historyHTML += `</div><div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);"><strong>Notes:</strong> ${lastExerciseData.notes}</div>`;
            } else {
                historyHTML += `</div>`;
            }
            
            historyHTML += `</div>`;
            
            historyDisplay.innerHTML = historyHTML;
            historyDisplay.classList.remove('hidden');
        } else {
            historyDisplay.innerHTML = `
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: center; color: var(--text-secondary);">
                    No previous data found for this exercise
                </div>
            `;
            historyDisplay.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('❌ Error loading exercise history:', error);
        historyDisplay.innerHTML = `
            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: center; color: var(--danger);">
                Error loading exercise history
            </div>
        `;
        historyDisplay.classList.remove('hidden');
        
        // Reset button text on error
        historyButton.innerHTML = '<i class="fas fa-history"></i> Show Last Workout';
    }
}

function checkExerciseCompletion(exerciseIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    const exerciseData = savedData.exercises[`exercise_${exerciseIndex}`];
    const sets = exerciseData?.sets || [];
    
    // Check if manually completed OR all sets are done
    const completedSets = sets.filter(set => set && set.reps && set.weight).length;
    const isCompleted = exerciseData?.manuallyCompleted || completedSets === exercise.sets;
    
    // Update card in main view
    const card = document.querySelector(`[data-index="${exerciseIndex}"]`);
    if (card) {
        card.classList.toggle('completed', isCompleted);
        
        // Update preview
        const unit = exerciseUnits[exerciseIndex] || globalUnit;
        const preview = card.querySelector('.exercise-preview');
        if (preview) {
            preview.innerHTML = generateSetPreview(exercise, exerciseIndex, unit);
        }
    }
}

function startRestTimer(exerciseIndex, setIndex) {
    const exerciseName = currentWorkout.exercises[exerciseIndex].machine;
    const setNumber = setIndex + 1;
    
    // Clear any existing global rest timer
    clearGlobalRestTimer();
    
    // Show sticky timer
    const stickyTimer = document.getElementById('rest-timer-sticky');
    const exerciseLabel = document.getElementById('rest-timer-exercise');
    const timerDisplay = document.getElementById('rest-timer-display');
    
    if (!stickyTimer || !exerciseLabel || !timerDisplay) {
        console.warn('Rest timer elements not found');
        return;
    }
    
    console.log(`Starting rest timer for ${exerciseName} - Set ${setNumber}`);
    
    exerciseLabel.textContent = `${exerciseName} - Set ${setNumber}`;
    stickyTimer.classList.add('active');
    
    let timeLeft = 90; // 90 seconds rest
    let isPaused = false;
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.style.color = 'var(--primary)';
    };
    
    updateDisplay();
    
    globalRestTimer = {
        interval: setInterval(() => {
            if (!isPaused && timeLeft > 0) {
                timeLeft--;
                updateDisplay();
                
                if (timeLeft === 0) {
                    // Timer finished
                    timerDisplay.textContent = 'Ready!';
                    timerDisplay.style.color = 'var(--success)';
                    
                    // Vibrate if supported
                    if ('vibrate' in navigator) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    
                    showNotification('Rest period complete! 💪', 'success');
                    
                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        stickyTimer.classList.remove('active');
                        timerDisplay.style.color = 'var(--primary)';
                    }, 5000);
                }
            }
        }, 1000),
        
        pause: () => {
            isPaused = !isPaused;
            const pauseBtn = document.getElementById('pause-rest-btn');
            if (pauseBtn) {
                pauseBtn.innerHTML = isPaused ? 
                    '<i class="fas fa-play"></i>' : 
                    '<i class="fas fa-pause"></i>';
            }
            console.log(`Rest timer ${isPaused ? 'paused' : 'resumed'}`);
        },
        
        skip: () => {
            clearInterval(globalRestTimer.interval);
            stickyTimer.classList.remove('active');
            timerDisplay.style.color = 'var(--primary)';
            console.log('Rest timer skipped');
        }
    };
}

function toggleRestTimer() {
    if (globalRestTimer) {
        globalRestTimer.pause();
    }
}

function skipRestTimer() {
    if (globalRestTimer) {
        globalRestTimer.skip();
        globalRestTimer = null;
    }
}

function clearGlobalRestTimer() {
    if (globalRestTimer) {
        clearInterval(globalRestTimer.interval);
        globalRestTimer = null;
    }
    const stickyTimer = document.getElementById('rest-timer-sticky');
    const timerDisplay = document.getElementById('rest-timer-display');
    if (stickyTimer) stickyTimer.classList.remove('active');
    if (timerDisplay) timerDisplay.style.color = 'var(--primary)';
}

function clearAllTimers() {
    clearGlobalRestTimer();
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
}

function setGlobalUnit(unit) {
    globalUnit = unit;
    
    // Update global unit toggle
    document.querySelectorAll('.global-settings .unit-btn')?.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === unit);
    });
    
    // Update all exercises that don't have individual unit preferences
    if (currentWorkout) {
        currentWorkout.exercises.forEach((exercise, index) => {
            if (!exerciseUnits[index]) {
                exerciseUnits[index] = unit;
            }
        });
        
        renderExercises();
        saveWorkoutData(); // Save unit preferences
    }
}

function setExerciseUnit(exerciseIndex, unit) {
    exerciseUnits[exerciseIndex] = unit;
    
    // Update modal unit toggle
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === unit);
        });
        
        // Refresh modal content
        const exercise = currentWorkout.exercises[exerciseIndex];
        const content = document.getElementById('modal-exercise-content');
        if (content) {
            content.innerHTML = generateExerciseTable(exercise, exerciseIndex, unit);
        }
    }
    
    // Save unit preference
    saveWorkoutData();
}

function convertWeight(weight, fromUnit, toUnit) {
    if (fromUnit === toUnit) return Math.round(weight);
    
    if (fromUnit === 'lbs' && toUnit === 'kg') {
        return Math.round(weight * 0.453592);
    } else if (fromUnit === 'kg' && toUnit === 'lbs') {
        return Math.round(weight * 2.20462);
    }
    
    return weight;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'primary'});
        z-index: 10000;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Tab switching (if you have tabs)
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab')?.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content')?.forEach(content => {
        content.classList.toggle('hidden', !content.id.startsWith(tabName));
    });
}

// Default data functions
function getDefaultWorkouts() {
    return [
        {
            "day": "Chest – Push",
            "exercises": [
                {
                    "machine": "Seated Chest Press",
                    "sets": 4,
                    "reps": 10,
                    "weight": 110,
                    "video": "https://www.youtube.com/watch?v=n8TOta_pfr4"
                },
                {
                    "machine": "Pec Deck (Chest Fly)",
                    "sets": 3,
                    "reps": 12,
                    "weight": 70,
                    "video": "https://www.youtube.com/watch?v=JJitfZKlKk4"
                }
            ]
        }
    ];
}

function getDefaultExercises() {
    return [
        {
            "name": "Incline Dumbbell Press",
            "machine": "Incline Dumbbell Press",
            "bodyPart": "Chest",
            "equipmentType": "Dumbbell",
            "tags": ["chest", "upper body", "push"],
            "sets": 4,
            "reps": 8,
            "weight": 45,
            "video": "https://www.youtube.com/watch?v=example"
        }
    ];
}

// Make functions globally accessible for onclick handlers
window.focusExercise = focusExercise;
window.updateSet = updateSet;
window.updateNotes = updateNotes;
window.signOutUser = signOutUser;
window.switchTab = switchTab;
window.loadExerciseHistory = loadExerciseHistory;
window.markExerciseComplete = markExerciseComplete;
window.toggleModalRestTimer = toggleModalRestTimer;
window.skipModalRestTimer = skipModalRestTimer;

console.log('✅ Enhanced Big Surf Workout Tracker with Firebase loaded successfully!');