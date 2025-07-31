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

// App State
let currentUser = null;
let currentWorkout = null;
let savedData = {};
let workoutPlans = [];
let exerciseDatabase = [];
let timers = {};
let workoutStartTime = null;
let workoutDurationTimer = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Big Surf Workout Tracker...');
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
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
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

    // History
    const loadHistoryBtn = document.getElementById('load-history-btn');
    const copyTodayBtn = document.getElementById('copy-to-today-btn');
    const editHistoryBtn = document.getElementById('edit-history-btn');
    const addMissingDayBtn = document.getElementById('add-missing-day-btn');
    
    if (loadHistoryBtn) {
        loadHistoryBtn.addEventListener('click', loadHistoryForDate);
    }
    if (copyTodayBtn) {
        copyTodayBtn.addEventListener('click', copyWorkoutToToday);
    }
    if (editHistoryBtn) {
        editHistoryBtn.addEventListener('click', editHistoryWorkout);
    }
    if (addMissingDayBtn) {
        addMissingDayBtn.addEventListener('click', addMissingDay);
    }

    // Add Exercise Modal
    const closeAddExerciseBtn = document.getElementById('close-add-exercise-modal');
    const addExerciseForm = document.getElementById('add-exercise-form');
    const addAndUseBtn = document.getElementById('add-and-use-btn');
    
    if (closeAddExerciseBtn) {
        closeAddExerciseBtn.addEventListener('click', closeAddExerciseModal);
    }
    if (addExerciseForm) {
        addExerciseForm.addEventListener('submit', addNewExercise);
    }
    if (addAndUseBtn) {
        addAndUseBtn.addEventListener('click', addAndUseExercise);
    }
    
    // Plans
    const createPlanBtn = document.getElementById('create-plan-btn');
    if (createPlanBtn) {
        createPlanBtn.addEventListener('click', createNewPlan);
    }

    // Modal controls
    const closeSwapBtn = document.getElementById('close-swap-modal');
    const exerciseSearch = document.getElementById('exercise-search');
    
    if (closeSwapBtn) {
        closeSwapBtn.addEventListener('click', closeSwapModal);
    }
    if (exerciseSearch) {
        exerciseSearch.addEventListener('input', searchExercises);
    }
    
    // Close modal when clicking outside
    const swapModal = document.getElementById('swap-modal');
    const addExerciseModal = document.getElementById('add-exercise-modal');
    
    if (swapModal) {
        swapModal.addEventListener('click', (e) => {
            if (e.target.id === 'swap-modal') closeSwapModal();
        });
    }
    
    if (addExerciseModal) {
        addExerciseModal.addEventListener('click', (e) => {
            if (e.target.id === 'add-exercise-modal') closeAddExerciseModal();
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
        
        // Load recent workouts for history tab
        if (currentUser) {
            loadRecentWorkouts();
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
    document.getElementById('google-signin-btn').classList.add('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('user-info').innerHTML = `
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

function showSignInButton() {
    document.getElementById('google-signin-btn').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
}

async function signOutUser() {
    try {
        await signOut(auth);
        showNotification('Signed out successfully', 'success');
        showWorkoutSelector(); // Reset to workout selector
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
    
    // Set history date picker to today
    const historyDatePicker = document.getElementById('history-date-picker');
    if (historyDatePicker) {
        historyDatePicker.value = today.toISOString().split('T')[0];
    }
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// Navigation
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', !content.id.startsWith(tabName));
    });

    // Load data for specific tabs
    if (tabName === 'history' && currentUser) {
        loadRecentWorkouts();
    } else if (tabName === 'plans' && currentUser) {
        loadWorkoutPlans();
    }
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
            if (data.workoutType && data.workoutType !== 'none') {
                // User has already selected a workout for today
                selectWorkout(data.workoutType, data);
            } else {
                showWorkoutSelector();
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
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const addExerciseSection = document.getElementById('add-exercise-section');
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (addExerciseSection) addExerciseSection.classList.add('hidden'); // Hide add exercise button
    
    // Clear any selected workout options
    document.querySelectorAll('.workout-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Reset date override and header if we were adding a missing day
    if (window.addingForDate) {
        window.addingForDate = null;
        setTodayDisplay(); // Reset to today
    }
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
    
    // Use override date if adding missing day, otherwise use today or existing data
    const workoutDate = window.addingForDate || (existingData ? existingData.date : getTodayDateString());
    
    // Load existing data or start fresh
    if (existingData) {
        savedData = existingData;
        workoutStartTime = existingData.startTime ? new Date(existingData.startTime) : new Date();
    } else {
        savedData = {
            workoutType: workoutType,
            date: workoutDate,
            startTime: new Date().toISOString(),
            exercises: {}
        };
        workoutStartTime = new Date();
    }

    // Save the workout selection
    await saveWorkoutData();

    // Update UI
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const addExerciseSection = document.getElementById('add-exercise-section');
    const currentWorkoutTitle = document.getElementById('current-workout-title');
    
    if (workoutSelector) workoutSelector.classList.add('hidden');
    if (activeWorkout) activeWorkout.classList.remove('hidden');
    if (addExerciseSection) addExerciseSection.classList.remove('hidden'); // Show add exercise button
    if (currentWorkoutTitle) currentWorkoutTitle.textContent = workoutType;
    
    const currentWorkoutDate = document.getElementById('current-workout-date');
    
    if (window.addingForDate) {
        if (currentWorkoutDate) {
            currentWorkoutDate.textContent = `Adding for: ${new Date(workoutDate).toLocaleDateString()}`;
        }
    } else {
        if (currentWorkoutDate) {
            currentWorkoutDate.textContent = `Started: ${workoutStartTime.toLocaleTimeString()}`;
        }
    }

    // Start duration timer only if it's today's workout
    if (!window.addingForDate) {
        startWorkoutDurationTimer();
    } else {
        const workoutDuration = document.getElementById('workout-duration');
        if (workoutDuration) {
            workoutDuration.textContent = 'Adding Missing Day';
        }
    }

    // Render the workout
    renderWorkout();
    updateWorkoutStats();

    showNotification(`${workoutType} workout started!`, 'success');
}

function startWorkoutDurationTimer() {
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }

    workoutDurationTimer = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now - workoutStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        document.getElementById('workout-duration').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

async function finishWorkout() {
    if (!currentWorkout || !currentUser) return;

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
}

function renderWorkout() {
    const container = document.getElementById('workout-list');
    container.innerHTML = '';

    currentWorkout.exercises.forEach((exercise, index) => {
        const card = createExerciseCard(exercise, index);
        container.appendChild(card);
    });
    
    updateWorkoutStats();
}

function createExerciseCard(exercise, index) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exerciseIndex = index;

    const savedSets = savedData.exercises?.[`exercise_${index}`]?.sets || [];
    const savedNotes = savedData.exercises?.[`exercise_${index}`]?.notes || '';

    card.innerHTML = `
        <div class="exercise-header">
            <h3 class="exercise-title">${exercise.machine}</h3>
            <div class="exercise-actions">
                <button class="btn btn-danger btn-small" onclick="deleteExercise(${index})" 
                        title="Remove this exercise from workout">
                    <i class="fas fa-trash"></i> Remove
                </button>
                <button class="btn btn-secondary btn-small" onclick="openSwapModal(${index})">
                    <i class="fas fa-exchange-alt"></i> Swap
                </button>
                <button class="btn btn-secondary btn-small" onclick="viewHistory('${exercise.machine}')">
                    <i class="fas fa-history"></i> History
                </button>
            </div>
        </div>

        ${exercise.video ? `
            <a href="${exercise.video}" target="_blank" class="video-link">
                <i class="fas fa-play-circle"></i> Watch Form Video
            </a>
        ` : ''}

        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Weight (lbs)</th>
                    <th>Previous</th>
                    <th>Rest Timer</th>
                </tr>
            </thead>
            <tbody>
                ${generateSetRows(exercise, index, savedSets)}
            </tbody>
        </table>

        <textarea class="notes-area" placeholder="Exercise notes..." 
                  onchange="handleNoteChange(${index}, this.value)">${savedNotes}</textarea>
    `;

    // Check if exercise is completed
    const completedSets = savedSets.filter(set => set && set.reps && set.weight).length;
    if (completedSets === exercise.sets) {
        card.classList.add('completed');
    }

    return card;
}

function generateSetRows(exercise, exerciseIndex, savedSets) {
    let rows = '';
    for (let i = 0; i < exercise.sets; i++) {
        const savedSet = savedSets[i] || {};
        rows += `
            <tr>
                <td>Set ${i + 1}</td>
                <td>
                    <input type="number" class="set-input ${savedSet.reps ? 'completed' : ''}" 
                           placeholder="${exercise.reps}" 
                           value="${savedSet.reps || ''}"
                           onchange="handleSetChange(${exerciseIndex}, ${i}, 'reps', this.value)"
                           oninput="handleSetChange(${exerciseIndex}, ${i}, 'reps', this.value)">
                </td>
                <td>
                    <input type="number" class="set-input ${savedSet.weight ? 'completed' : ''}" 
                           placeholder="${exercise.weight}" 
                           value="${savedSet.weight || ''}"
                           onchange="handleSetChange(${exerciseIndex}, ${i}, 'weight', this.value)"
                           oninput="handleSetChange(${exerciseIndex}, ${i}, 'weight', this.value)">
                </td>
                <td>
                    <small style="color: var(--text-secondary);">
                        ${exercise.reps} × ${exercise.weight} lbs
                    </small>
                </td>
                <td>
                    <div class="timer-display" id="timer-${exerciseIndex}-${i}">
                        <i class="fas fa-clock"></i>
                        <span>Ready</span>
                    </div>
                </td>
            </tr>
        `;
    }
    return rows;
}

// New wrapper function to handle set changes
async function handleSetChange(exerciseIndex, setIndex, field, value) {
    console.log(`Saving set: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
    await saveSet(exerciseIndex, setIndex, field, value);
}

// New wrapper function to handle note changes
async function handleNoteChange(exerciseIndex, note) {
    console.log(`Saving note for exercise ${exerciseIndex}: ${note}`);
    await saveNote(exerciseIndex, note);
}

async function saveSet(exerciseIndex, setIndex, field, value) {
    if (!currentUser) {
        console.log('No user logged in, cannot save');
        return;
    }
    
    console.log(`Saving: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
    
    if (!savedData.exercises) savedData.exercises = {};
    if (!savedData.exercises[`exercise_${exerciseIndex}`]) {
        savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [] };
    }
    
    if (!savedData.exercises[`exercise_${exerciseIndex}`].sets[setIndex]) {
        savedData.exercises[`exercise_${exerciseIndex}`].sets[setIndex] = {};
    }
    
    savedData.exercises[`exercise_${exerciseIndex}`].sets[setIndex][field] = value;
    
    // Save to Firebase
    await saveWorkoutData();
    
    // Update input styling - find the input that triggered this
    const inputs = document.querySelectorAll(`input[onchange*="handleSetChange(${exerciseIndex}, ${setIndex}"]`);
    inputs.forEach(input => {
        if (input.getAttribute('onchange').includes(`'${field}'`)) {
            input.classList.toggle('completed', !!value);
        }
    });
    
    // Start rest timer when both reps and weight are entered
    const setData = savedData.exercises[`exercise_${exerciseIndex}`].sets[setIndex];
    if (setData && setData.reps && setData.weight) {
        console.log(`Starting timer for exercise ${exerciseIndex}, set ${setIndex}`);
        startRestTimer(exerciseIndex, setIndex);
        checkExerciseCompletion(exerciseIndex);
    }
    
    updateWorkoutStats();
}

async function saveNote(exerciseIndex, note) {
    if (!currentUser) return;
    
    if (!savedData.exercises) savedData.exercises = {};
    if (!savedData.exercises[`exercise_${exerciseIndex}`]) {
        savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [] };
    }
    
    savedData.exercises[`exercise_${exerciseIndex}`].notes = note;
    await saveWorkoutData();
}

async function saveWorkoutData() {
    if (!currentUser) return;
    
    // Use the override date if we're adding a missing day
    const saveDate = window.addingForDate || savedData.date || getTodayDateString();
    savedData.date = saveDate;
    
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

function updateWorkoutStats() {
    if (!currentWorkout || !savedData.exercises) return;
    
    let completedExercises = 0;
    let totalSets = 0;
    let completedSets = 0;
    
    currentWorkout.exercises.forEach((exercise, index) => {
        totalSets += exercise.sets;
        const sets = savedData.exercises[`exercise_${index}`]?.sets || [];
        const exerciseCompletedSets = sets.filter(set => set && set.reps && set.weight).length;
        completedSets += exerciseCompletedSets;
        
        if (exerciseCompletedSets === exercise.sets) {
            completedExercises++;
        }
    });
    
    const completedExercisesEl = document.getElementById('completed-exercises');
    const completedSetsEl = document.getElementById('completed-sets');
    
    if (completedExercisesEl) {
        completedExercisesEl.textContent = `${completedExercises}/${currentWorkout.exercises.length}`;
    }
    if (completedSetsEl) {
        completedSetsEl.textContent = `${completedSets}/${totalSets}`;
    }
}

function startRestTimer(exerciseIndex, setIndex) {
    const timerId = `timer-${exerciseIndex}-${setIndex}`;
    const timerElement = document.getElementById(timerId);
    
    if (!timerElement) return;
    
    if (timers[timerId]) {
        clearInterval(timers[timerId]);
    }
    
    let timeLeft = 90; // 90 seconds rest
    timerElement.innerHTML = `<i class="fas fa-clock"></i> <span class="timer-active">${timeLeft}s</span>`;
    
    timers[timerId] = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerElement.innerHTML = `<i class="fas fa-clock"></i> <span class="timer-active">${timeLeft}s</span>`;
        } else {
            timerElement.innerHTML = `<i class="fas fa-check-circle"></i> <span class="timer-complete">Ready!</span>`;
            clearInterval(timers[timerId]);
            
            // Vibrate if supported
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            
            showNotification('Rest period complete!', 'success');
        }
    }, 1000);
}

function checkExerciseCompletion(exerciseIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    const sets = savedData.exercises[`exercise_${exerciseIndex}`]?.sets || [];
    
    const completedSets = sets.filter(set => set && set.reps && set.weight).length;
    const card = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    
    if (card) {
        card.classList.toggle('completed', completedSets === exercise.sets);
    }
}

// History Functions
async function loadRecentWorkouts() {
    if (!currentUser) return;
    
    try {
        const workoutsRef = collection(db, "users", currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        const container = document.getElementById('recent-workouts-list');
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No previous workouts found. Start your first workout today!</p>
                </div>
            `;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.workoutType && data.workoutType !== 'none') {
                const item = createRecentWorkoutItem(doc.id, data);
                container.appendChild(item);
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading recent workouts:', error);
        document.getElementById('recent-workouts-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading workout history</p>
            </div>
        `;
    }
}

function createRecentWorkoutItem(docId, data) {
    const item = document.createElement('div');
    item.className = 'recent-workout-item';
    item.dataset.docId = docId;
    
    const date = new Date(data.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    
    const duration = data.totalDuration ? 
        `${Math.floor(data.totalDuration / 60)}:${(data.totalDuration % 60).toString().padStart(2, '0')}` : 
        'In Progress';
    
    // Count completed exercises
    let completedExercises = 0;
    let totalExercises = 0;
    
    if (data.exercises) {
        Object.keys(data.exercises).forEach(key => {
            if (key.startsWith('exercise_')) {
                totalExercises++;
                const sets = data.exercises[key].sets || [];
                const completedSets = sets.filter(set => set && set.reps && set.weight).length;
                if (completedSets > 0) completedExercises++;
            }
        });
    }
    
    item.innerHTML = `
        <div class="recent-workout-info">
            <h4>${data.workoutType}</h4>
            <p>${date} ${data.completedAt ? '• Completed' : '• In Progress'}</p>
        </div>
        <div class="recent-workout-stats">
            <div>${duration}</div>
            <div>${completedExercises}/${totalExercises} exercises</div>
        </div>
    `;
    
    item.addEventListener('click', () => loadHistoryWorkout(docId, data));
    
    return item;
}

async function loadHistoryForDate() {
    const date = document.getElementById('history-date-picker').value;
    if (!date || !currentUser) return;
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", date);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            loadHistoryWorkout(date, data);
        } else {
            showNotification(`No workout found for ${date}`, 'info');
            document.getElementById('history-workout-display').classList.add('hidden');
        }
    } catch (error) {
        console.error('❌ Error loading workout for date:', error);
        showNotification('Error loading workout', 'error');
    }
}

function loadHistoryWorkout(docId, data) {
    document.getElementById('history-workout-display').classList.remove('hidden');
    document.getElementById('history-workout-title').textContent = 
        `${data.workoutType} - ${new Date(data.date).toLocaleDateString()}`;
    
    const container = document.getElementById('history-workout-content');
    container.innerHTML = '';
    
    // Find the workout plan
    const workout = workoutPlans.find(w => w.day === data.workoutType);
    if (!workout) {
        container.innerHTML = '<p>Workout plan not found</p>';
        return;
    }
    
    // Create read-only exercise cards
    workout.exercises.forEach((exercise, index) => {
        const card = createHistoryExerciseCard(exercise, index, data.exercises?.[`exercise_${index}`] || {});
        container.appendChild(card);
    });
    
    // Store current history data for copying
    window.currentHistoryData = data;
}

function createHistoryExerciseCard(exercise, index, exerciseData) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    
    const savedSets = exerciseData.sets || [];
    const savedNotes = exerciseData.notes || '';
    
    const completedSets = savedSets.filter(set => set && set.reps && set.weight).length;
    if (completedSets === exercise.sets) {
        card.classList.add('completed');
    }
    
    card.innerHTML = `
        <div class="exercise-header">
            <h3 class="exercise-title">${exercise.machine}</h3>
            <div class="exercise-actions">
                <button class="btn btn-danger btn-small" onclick="deleteHistoryExercise(${index})" 
                        title="Remove this exercise from this workout">
                    <i class="fas fa-trash"></i> Remove
                </button>
                <button class="btn btn-secondary btn-small" onclick="openSwapModalForHistory(${index})">
                    <i class="fas fa-exchange-alt"></i> Swap
                </button>
            </div>
        </div>

        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Weight (lbs)</th>
                    <th>Target</th>
                </tr>
            </thead>
            <tbody>
                ${generateHistorySetRows(exercise, savedSets)}
            </tbody>
        </table>

        ${savedNotes ? `
            <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: 8px; margin-top: 1rem;">
                <strong>Notes:</strong> ${savedNotes}
            </div>
        ` : ''}
    `;
    
    return card;
}

function generateHistorySetRows(exercise, savedSets) {
    let rows = '';
    for (let i = 0; i < exercise.sets; i++) {
        const savedSet = savedSets[i] || {};
        const completed = savedSet.reps && savedSet.weight;
        
        rows += `
            <tr${completed ? ' style="background: rgba(35, 134, 54, 0.1);"' : ''}>
                <td>Set ${i + 1}</td>
                <td>${savedSet.reps || '-'}</td>
                <td>${savedSet.weight || '-'}</td>
                <td>
                    <small style="color: var(--text-secondary);">
                        ${exercise.reps} × ${exercise.weight} lbs
                    </small>
                </td>
            </tr>
        `;
    }
    return rows;
}

async function copyWorkoutToToday() {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const today = getTodayDateString();
    
    // Check if today already has a workout
    try {
        const todayDocRef = doc(db, "users", currentUser.uid, "workouts", today);
        const todayDocSnap = await getDoc(todayDocRef);
        
        if (todayDocSnap.exists() && todayDocSnap.data().workoutType) {
            const confirm = window.confirm('You already have a workout for today. Replace it?');
            if (!confirm) return;
        }
        
        // Copy the workout but reset the exercise data
        const newWorkoutData = {
            workoutType: historyData.workoutType,
            date: today,
            startTime: new Date().toISOString(),
            exercises: {}
        };
        
        await setDoc(todayDocRef, newWorkoutData);
        showNotification(`${historyData.workoutType} copied to today!`, 'success');
        
        // Switch to today tab and load the workout
        switchTab('today');
        await loadTodaysWorkout();
        
    } catch (error) {
        console.error('❌ Error copying workout:', error);
        showNotification('Failed to copy workout', 'error');
    }
}

// Exercise swapping (same as before)
function openSwapModal(exerciseIndex) {
    window.currentSwapIndex = exerciseIndex;
    document.getElementById('swap-modal').classList.remove('hidden');
    document.getElementById('exercise-search').value = '';
    searchExercises();
}

function closeSwapModal() {
    document.getElementById('swap-modal').classList.add('hidden');
    document.getElementById('exercise-search').value = '';
    
    // Reset history swap flag
    window.isHistorySwap = false;
}

function searchExercises() {
    const query = document.getElementById('exercise-search').value.toLowerCase();
    const container = document.getElementById('exercise-options');
    
    const filtered = exerciseDatabase.filter(exercise => 
        exercise.machine?.toLowerCase().includes(query) ||
        exercise.bodyPart?.toLowerCase().includes(query) ||
        exercise.equipmentType?.toLowerCase().includes(query) ||
        (exercise.tags && exercise.tags.some(tag => tag.toLowerCase().includes(query)))
    );

    container.innerHTML = '';
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No exercises found${query ? ` matching "${query}"` : ''}</p>
            </div>
        `;
        return;
    }

    filtered.forEach(exercise => {
        const option = document.createElement('div');
        option.className = 'exercise-option';
        option.innerHTML = `
            <div class="option-title">${exercise.machine || exercise.name}</div>
            <div class="option-details">
                ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'} • 
                ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
            </div>
        `;
        option.addEventListener('click', () => swapExercise(exercise));
        container.appendChild(option);
    });
}

function swapExercise(newExercise) {
    const exerciseIndex = window.currentSwapIndex;
    
    if (window.isHistorySwap && window.currentHistoryData) {
        // Swapping in history view
        const historyData = window.currentHistoryData;
        const workout = workoutPlans.find(w => w.day === historyData.workoutType);
        if (!workout) return;
        
        // Update the workout template for this viewing
        workout.exercises[exerciseIndex] = {
            machine: newExercise.machine || newExercise.name,
            sets: newExercise.sets || 3,
            reps: newExercise.reps || 10,
            weight: newExercise.weight || 50,
            video: newExercise.video || ''
        };
        
        // Clear any existing data for this exercise since it's a different exercise now
        if (historyData.exercises && historyData.exercises[`exercise_${exerciseIndex}`]) {
            historyData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
        }
        
        // Save and reload
        saveHistoryWorkoutData(historyData).then(() => {
            loadHistoryWorkout(historyData.date, historyData);
            showNotification(`Exercise swapped to ${newExercise.machine || newExercise.name}`, 'success');
        });
        
    } else {
        // Normal current workout swap
        currentWorkout.exercises[exerciseIndex] = {
            machine: newExercise.machine || newExercise.name,
            sets: newExercise.sets || 3,
            reps: newExercise.reps || 10,
            weight: newExercise.weight || 50,
            video: newExercise.video || ''
        };
        
        renderWorkout();
        showNotification(`Exercise swapped to ${newExercise.machine || newExercise.name}`, 'success');
    }
    
    closeSwapModal();
}

async function saveHistoryWorkoutData(historyData) {
    if (!currentUser) return;
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", historyData.date);
        await setDoc(docRef, {
            ...historyData,
            lastUpdated: new Date().toISOString()
        });
        console.log('💾 History workout data saved successfully');
    } catch (error) {
        console.error('❌ Error saving history workout data:', error);
        showNotification('Failed to save workout changes', 'error');
    }
}

// Exercise management functions
async function deleteExercise(exerciseIndex) {
    console.log(`Attempting to delete exercise ${exerciseIndex}`);
    
    if (!currentWorkout || !currentUser) {
        console.log('No current workout or user');
        return;
    }
    
    const exercise = currentWorkout.exercises[exerciseIndex];
    if (!exercise) {
        console.log('Exercise not found at index', exerciseIndex);
        return;
    }
    
    const confirmDelete = window.confirm(`Remove "${exercise.machine}" from this workout?`);
    
    if (!confirmDelete) {
        console.log('User cancelled deletion');
        return;
    }
    
    console.log('Deleting exercise:', exercise.machine);
    
    // Remove from current workout
    currentWorkout.exercises.splice(exerciseIndex, 1);
    
    // Clean up saved data - shift indices down
    const newExercises = {};
    
    Object.keys(savedData.exercises || {}).forEach(key => {
        if (key.startsWith('exercise_')) {
            const oldIndex = parseInt(key.split('_')[1]);
            if (oldIndex < exerciseIndex) {
                // Keep exercises before deleted one
                newExercises[`exercise_${oldIndex}`] = savedData.exercises[key];
            } else if (oldIndex > exerciseIndex) {
                // Shift exercises after deleted one down by 1
                newExercises[`exercise_${oldIndex - 1}`] = savedData.exercises[key];
            }
            // Skip the deleted exercise (oldIndex === exerciseIndex)
        }
    });
    
    savedData.exercises = newExercises;
    
    // Save updated data
    await saveWorkoutData();
    
    // Re-render workout
    renderWorkout();
    
    showNotification(`"${exercise.machine}" removed from workout`, 'success');
}

async function editHistoryWorkout() {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const date = historyData.date;
    
    // Switch to today tab and load this workout for editing
    switchTab('today');
    
    // Find the workout plan
    const workout = workoutPlans.find(w => w.day === historyData.workoutType);
    if (!workout) {
        showNotification('Workout plan not found', 'error');
        return;
    }
    
    currentWorkout = workout;
    savedData = historyData;
    workoutStartTime = historyData.startTime ? new Date(historyData.startTime) : new Date();
    
    // Update UI to show we're editing a past workout
    document.getElementById('workout-selector').classList.add('hidden');
    document.getElementById('active-workout').classList.remove('hidden');
    document.getElementById('current-workout-title').textContent = `${historyData.workoutType} (${date})`;
    document.getElementById('current-workout-date').textContent = `Editing workout from ${new Date(date).toLocaleDateString()}`;
    
    // Don't start duration timer for past workouts
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
    
    // Show total duration if completed
    if (historyData.totalDuration) {
        const minutes = Math.floor(historyData.totalDuration / 60);
        const seconds = historyData.totalDuration % 60;
        document.getElementById('workout-duration').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')} (completed)`;
    } else {
        document.getElementById('workout-duration').textContent = 'In Progress';
    }
    
    // Render the workout
    renderWorkout();
    updateWorkoutStats();
    
    showNotification(`Now editing ${historyData.workoutType} from ${date}`, 'info');
}

// Add Missing Day functionality
async function addMissingDay() {
    if (!currentUser) {
        showNotification('Please sign in to add missing workouts', 'warning');
        return;
    }
    
    const selectedDate = document.getElementById('history-date-picker').value;
    if (!selectedDate) {
        showNotification('Please select a date first', 'warning');
        return;
    }
    
    // Check if workout already exists for this date
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", selectedDate);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().workoutType) {
            const confirm = window.confirm(`A workout already exists for ${selectedDate}. Replace it?`);
            if (!confirm) return;
        }
        
        // Switch to today tab and set up for this date
        switchTab('today');
        
        // Update the header to show we're adding for a different date
        document.getElementById('today-date-display').textContent = 
            `Adding Workout - ${new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}`;
        
        // Reset state
        currentWorkout = null;
        savedData = {};
        workoutStartTime = null;
        
        // Show workout selector
        showWorkoutSelector();
        
        // Override the date for saving
        window.addingForDate = selectedDate;
        
        showNotification(`Ready to add workout for ${selectedDate}`, 'success');
        
    } catch (error) {
        console.error('❌ Error checking existing workout:', error);
        showNotification('Error checking existing workout', 'error');
    }
}

// Add New Exercise functionality
function openAddExerciseModal() {
    console.log('Opening add exercise modal');
    const modal = document.getElementById('add-exercise-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const nameInput = document.getElementById('exercise-name');
        if (nameInput) {
            nameInput.focus();
        }
    } else {
        console.error('Add exercise modal not found');
    }
}

function closeAddExerciseModal() {
    console.log('Closing add exercise modal');
    const modal = document.getElementById('add-exercise-modal');
    if (modal) {
        modal.classList.add('hidden');
        const form = document.getElementById('add-exercise-form');
        if (form) {
            form.reset();
        }
    }
}

async function addNewExercise(event) {
    event.preventDefault();
    console.log('Adding new exercise');
    
    const exerciseName = document.getElementById('exercise-name').value.trim();
    console.log('Exercise name:', exerciseName);
    
    if (!exerciseName) {
        showNotification('Exercise name is required', 'error');
        return;
    }
    
    const newExercise = {
        name: exerciseName,
        machine: exerciseName,
        bodyPart: document.getElementById('exercise-body-part').value,
        equipmentType: document.getElementById('exercise-equipment').value,
        tags: [
            document.getElementById('exercise-body-part').value.toLowerCase(),
            document.getElementById('exercise-equipment').value.toLowerCase()
        ],
        sets: parseInt(document.getElementById('exercise-sets').value),
        reps: parseInt(document.getElementById('exercise-reps').value),
        weight: parseInt(document.getElementById('exercise-weight').value),
        video: document.getElementById('exercise-video').value || ''
    };
    
    console.log('New exercise object:', newExercise);
    
    // Add to exercise database
    exerciseDatabase.push(newExercise);
    console.log('Added to database, new length:', exerciseDatabase.length);
    
    // Save to Firebase (custom exercises collection)
    if (currentUser) {
        try {
            const customExerciseRef = doc(db, "users", currentUser.uid, "customExercises", exerciseName.replace(/[^a-zA-Z0-9]/g, '_'));
            await setDoc(customExerciseRef, newExercise);
            console.log('✅ Custom exercise saved to Firebase');
        } catch (error) {
            console.error('❌ Error saving custom exercise:', error);
            // Still continue - it's in memory for this session
        }
    }
    
    closeAddExerciseModal();
    showNotification(`"${exerciseName}" added to exercise library!`, 'success');
}

async function addAndUseExercise(event) {
    event.preventDefault();
    
    // First add the exercise
    await addNewExercise(event);
    
    // Then add it to current workout if we have one
    if (currentWorkout && currentUser) {
        const exerciseName = document.getElementById('exercise-name').value.trim();
        const newExercise = exerciseDatabase.find(ex => ex.name === exerciseName);
        
        if (newExercise) {
            // Add to current workout
            currentWorkout.exercises.push({
                machine: newExercise.machine,
                sets: newExercise.sets,
                reps: newExercise.reps,
                weight: newExercise.weight,
                video: newExercise.video
            });
            
            // Save and re-render
            await saveWorkoutData();
            renderWorkout();
            
            showNotification(`"${exerciseName}" added to today's workout!`, 'success');
        }
    }
}

// Plans functionality
function loadWorkoutPlans() {
    const container = document.getElementById('plans-list');
    container.innerHTML = '';
    
    if (workoutPlans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No Workout Plans</h3>
                <p>Create your first custom workout plan to get started.</p>
            </div>
        `;
        return;
    }
    
    workoutPlans.forEach((plan, index) => {
        const card = createPlanCard(plan, index);
        container.appendChild(card);
    });
}

function createPlanCard(plan, index) {
    const card = document.createElement('div');
    card.className = 'plan-card';
    
    const exerciseCount = plan.exercises.length;
    const exerciseNames = plan.exercises.slice(0, 3).map(ex => ex.machine).join(', ');
    const moreText = exerciseCount > 3 ? ` and ${exerciseCount - 3} more...` : '';
    
    card.innerHTML = `
        <h4>${plan.day}</h4>
        <div class="plan-exercises">
            ${exerciseCount} exercises: ${exerciseNames}${moreText}
        </div>
        <div class="plan-actions">
            <button class="btn btn-primary btn-small" onclick="usePlan(${index})">
                <i class="fas fa-play"></i> Use Today
            </button>
            <button class="btn btn-secondary btn-small" onclick="editPlan(${index})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-small" onclick="deletePlan(${index})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

function createNewPlan() {
    const planName = window.prompt('Enter workout plan name:', 'My Custom Workout');
    if (!planName) return;
    
    const newPlan = {
        day: planName,
        exercises: []
    };
    
    workoutPlans.push(newPlan);
    loadWorkoutPlans();
    
    showNotification(`"${planName}" plan created! Click Edit to add exercises.`, 'success');
}

function usePlan(planIndex) {
    const plan = workoutPlans[planIndex];
    if (!plan) return;
    
    // Switch to today tab and select this workout
    switchTab('today');
    selectWorkout(plan.day);
}

function editPlan(planIndex) {
    showNotification('Plan editing feature coming soon! For now, you can use the exercise swap feature during workouts.', 'info');
}

function deletePlan(planIndex) {
    const plan = workoutPlans[planIndex];
    if (!plan) return;
    
    const confirmDelete = window.confirm(`Delete "${plan.day}" workout plan? This cannot be undone.`);
    if (!confirmDelete) return;
    
    workoutPlans.splice(planIndex, 1);
    loadWorkoutPlans();
    
    showNotification(`"${plan.day}" plan deleted`, 'success');
}

// History exercise management
async function deleteHistoryExercise(exerciseIndex) {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const workout = workoutPlans.find(w => w.day === historyData.workoutType);
    if (!workout) return;
    
    const exercise = workout.exercises[exerciseIndex];
    const confirmDelete = window.confirm(`Remove "${exercise.machine}" from this workout?`);
    
    if (!confirmDelete) return;
    
    // Remove from workout plan (this modifies the template, which might not be ideal)
    // Better to modify the saved data structure
    
    // Remove the exercise data from saved history
    if (historyData.exercises) {
        delete historyData.exercises[`exercise_${exerciseIndex}`];
        
        // Shift remaining exercises down
        const newExercises = {};
        let newIndex = 0;
        
        Object.keys(historyData.exercises).forEach(key => {
            if (key.startsWith('exercise_')) {
                const oldIndex = parseInt(key.split('_')[1]);
                if (oldIndex < exerciseIndex) {
                    newExercises[`exercise_${oldIndex}`] = historyData.exercises[key];
                } else if (oldIndex > exerciseIndex) {
                    newExercises[`exercise_${oldIndex - 1}`] = historyData.exercises[key];
                }
            }
        });
        
        historyData.exercises = newExercises;
    }
    
    // Remove from the workout template for this viewing
    workout.exercises.splice(exerciseIndex, 1);
    
    // Save the updated history data
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", historyData.date);
        await setDoc(docRef, historyData);
        
        // Reload the history display
        loadHistoryWorkout(historyData.date, historyData);
        
        showNotification(`"${exercise.machine}" removed from workout`, 'success');
        
    } catch (error) {
        console.error('❌ Error updating history workout:', error);
        showNotification('Failed to update workout', 'error');
    }
}

function openSwapModalForHistory(exerciseIndex) {
    if (!window.currentHistoryData) return;
    
    window.currentSwapIndex = exerciseIndex;
    window.isHistorySwap = true; // Flag to know we're swapping in history
    
    document.getElementById('swap-modal').classList.remove('hidden');
    document.getElementById('exercise-search').value = '';
    searchExercises();
}

async function viewHistory(exerciseName) {
    if (!currentUser) {
        showNotification('Please sign in to view history', 'warning');
        return;
    }
    
    // For now, just show a placeholder. This would require more complex querying
    showModal('Exercise History', `
        <h4 style="margin-top: 0;">${exerciseName}</h4>
        <p>Exercise history feature coming soon! For now, you can view your complete workout history in the History tab.</p>
    `);
}

// UI Helper functions
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${content}
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'primary'});
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
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
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Default data functions (same as before)
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

// Make functions globally accessible
window.openSwapModal = openSwapModal;
window.viewHistory = viewHistory;
window.saveSet = saveSet;
window.saveNote = saveNote;
window.handleSetChange = handleSetChange;
window.handleNoteChange = handleNoteChange;
window.switchTab = switchTab;
window.signOutUser = signOutUser;
window.deleteExercise = deleteExercise;
window.openAddExerciseModal = openAddExerciseModal;
window.closeAddExerciseModal = closeAddExerciseModal;
window.usePlan = usePlan;
window.editPlan = editPlan;
window.deletePlan = deletePlan;
window.deleteHistoryExercise = deleteHistoryExercise;
window.openSwapModalForHistory = openSwapModalForHistory;

console.log('✅ Big Surf Workout Tracker loaded successfully!');