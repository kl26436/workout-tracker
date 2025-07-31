// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit, deleteDoc
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
let workoutState = 'ready';
let totalPausedTime = 0;
let lastPauseTime = null;
let globalRestTimer = null;
let globalRestTimeLeft = 0;
let globalRestTimerActive = false;
let activeExercises = new Set();
let firstExerciseStarted = false;
let useKilograms = false;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Big Surf Workout Tracker...');
    initializeWorkoutApp();
    setupEventListeners();
    setTodayDisplay();
    loadData();
    setTimeout(addBackupButtons, 1000);
});

function initializeWorkoutApp() {
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
    const startPauseBtn = document.getElementById('start-pause-btn');
    const completeWorkoutBtn = document.getElementById('complete-workout-btn');
    const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');
    
    if (changeWorkoutBtn) {
        changeWorkoutBtn.addEventListener('click', showWorkoutSelector);
    }
    if (startPauseBtn) {
        startPauseBtn.addEventListener('click', toggleWorkoutPause);
    }
    if (completeWorkoutBtn) {
        completeWorkoutBtn.addEventListener('click', completeWorkout);
    }
    if (cancelWorkoutBtn) {
        cancelWorkoutBtn.addEventListener('click', cancelWorkout);
    }

    // History
    const loadHistoryBtn = document.getElementById('load-history-btn');
    const copyTodayBtn = document.getElementById('copy-to-today-btn');
    const editHistoryBtn = document.getElementById('edit-history-btn');
    const addMissingDayBtn = document.getElementById('add-missing-day-btn');
    const deleteWorkoutBtn = document.getElementById('delete-workout-btn');
    
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
    if (deleteWorkoutBtn) {
        deleteWorkoutBtn.addEventListener('click', deleteEntireWorkout);
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
        
        const workoutResponse = await fetch('./workouts.json');
        if (workoutResponse.ok) {
            workoutPlans = await workoutResponse.json();
            console.log('✅ Workout plans loaded:', workoutPlans.length);
        } else {
            console.error('❌ Failed to load workouts.json');
            workoutPlans = getDefaultWorkouts();
        }
        
        const exerciseResponse = await fetch('./exercises.json');
        if (exerciseResponse.ok) {
            exerciseDatabase = await exerciseResponse.json();
            console.log('✅ Exercise database loaded:', exerciseDatabase.length);
        } else {
            console.error('❌ Failed to load exercises.json');
            exerciseDatabase = getDefaultExercises();
        }
        
        if (currentUser) {
            loadRecentWorkouts();
        }
        
    } catch (error) {
        console.error('CSV export error:', error);
        showNotification('CSV export failed', 'error');
    }
}

function addBackupButtons() {
    const plansTab = document.getElementById('plans-tab');
    if (plansTab && !document.getElementById('backup-section')) {
        const backupSection = document.createElement('div');
        backupSection.id = 'backup-section';
        backupSection.className = 'workout-controls';
        backupSection.style.marginTop = '2rem';
        backupSection.innerHTML = `
            <h3>Data Backup & Export</h3>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="exportAllData()">
                    <i class="fas fa-download"></i> Export All Data (JSON)
                </button>
                <button class="btn btn-secondary" onclick="exportWorkoutsCSV()">
                    <i class="fas fa-file-csv"></i> Export CSV
                </button>
            </div>
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                Backup your data regularly to avoid losing progress!
            </p>
        `;
        plansTab.appendChild(backupSection);
    }
}

// Utility Functions
async function viewHistory(exerciseName) {
    if (!currentUser) {
        showNotification('Please sign in to view history', 'warning');
        return;
    }
    
    showModal('Exercise History', `
        <h4 style="margin-top: 0;">${exerciseName}</h4>
        <p>Exercise history feature coming soon! For now, you can view your complete workout history in the History tab.</p>
    `);
}

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

// Make functions globally accessible
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
window.deleteEntireWorkout = deleteEntireWorkout;
window.toggleWorkoutPause = toggleWorkoutPause;
window.completeWorkout = completeWorkout;
window.cancelWorkout = cancelWorkout;
window.loadLastWorkout = loadLastWorkout;
window.adjustSetValue = adjustSetValue;
window.startNewWorkout = startNewWorkout;
window.goToHistory = goToHistory;
window.goToHome = goToHome;
window.addExerciseFromLibrary = addExerciseFromLibrary;
window.searchLibraryExercises = searchLibraryExercises;
window.addExerciseToWorkout = addExerciseToWorkout;
window.toggleExerciseExpansion = toggleExerciseExpansion;
window.startRestTimer = startRestTimer;
window.renderSingleExercise = renderSingleExercise;
window.exportAllData = exportAllData;
window.exportWorkoutsCSV = exportWorkoutsCSV;
window.startExercise = startExercise;
window.pauseExercise = pauseExercise;
window.markExerciseComplete = markExerciseComplete;
window.reopenExercise = reopenExercise;
window.toggleUnits = toggleUnits;
window.openSwapModal = openSwapModal;
window.closeSwapModal = closeSwapModal;
window.searchExercises = searchExercises;
window.swapExercise = swapExercise;
window.loadHistoryForDate = loadHistoryForDate;
window.copyWorkoutToToday = copyWorkoutToToday;
window.editHistoryWorkout = editHistoryWorkout;
window.addMissingDay = addMissingDay;
window.addNewExercise = addNewExercise;
window.addAndUseExercise = addAndUseExercise;
window.createNewPlan = createNewPlan;

console.log('✅ Big Surf Workout Tracker loaded successfully!');
        showNotification('Error loading workout data. Using defaults.', 'error');
        workoutPlans = getDefaultWorkouts();
        exerciseDatabase = getDefaultExercises();
    

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
    
    const historyDatePicker = document.getElementById('history-date-picker');
    if (historyDatePicker) {
        historyDatePicker.value = today.toISOString().split('T')[0];
    }
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', !content.id.startsWith(tabName));
    });

    if (tabName === 'history' && currentUser) {
        loadRecentWorkouts();
    } else if (tabName === 'plans' && currentUser) {
        loadWorkoutPlans();
    }
}

async function loadTodaysWorkout() {
    if (!currentUser) return;
    showWorkoutSelector();
    
    const today = getTodayDateString();
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", today);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.workoutType && data.workoutType !== 'none') {
                showNotification(`You have a saved ${data.workoutType} workout from today`, 'info');
            }
        }
    } catch (error) {
        console.error('❌ Error checking today\'s workout:', error);
    }
}

function showWorkoutSelector() {
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const addExerciseSection = document.getElementById('add-exercise-section');
    
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (addExerciseSection) addExerciseSection.classList.add('hidden');
    
    // Clear workout state
    activeExercises.clear();
    firstExerciseStarted = false;
    workoutState = 'ready';
    totalPausedTime = 0;
    lastPauseTime = null;
    
    // Clear rest timer
    if (globalRestTimer) {
        clearInterval(globalRestTimer);
        globalRestTimer = null;
        globalRestTimerActive = false;
        globalRestTimeLeft = 0;
    }
    
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
    
    document.querySelectorAll('.workout-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (window.addingForDate) {
        window.addingForDate = null;
        setTodayDisplay();
    }
}

async function selectWorkout(workoutType, existingData = null) {
    if (!currentUser) {
        showNotification('Please sign in to select a workout', 'warning');
        return;
    }

    const workout = workoutPlans.find(w => w.day === workoutType);
    if (!workout) {
        showNotification('Workout plan not found', 'error');
        return;
    }

    currentWorkout = workout;
    
    const workoutDate = window.addingForDate || (existingData ? existingData.date : getTodayDateString());
    
    if (existingData) {
        savedData = existingData;
        workoutStartTime = existingData.startTime ? new Date(existingData.startTime) : new Date();
        workoutState = existingData.workoutState || 'ready';
        totalPausedTime = existingData.totalPausedTime || 0;
    } else {
        savedData = {
            workoutType: workoutType,
            date: workoutDate,
            startTime: new Date().toISOString(),
            exercises: {},
            workoutState: 'ready',
            totalPausedTime: 0
        };
        workoutStartTime = new Date();
        workoutState = 'ready';
        totalPausedTime = 0;
    }

    await saveWorkoutData();

    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const addExerciseSection = document.getElementById('add-exercise-section');
    const currentWorkoutTitle = document.getElementById('current-workout-title');
    
    if (workoutSelector) workoutSelector.classList.add('hidden');
    if (activeWorkout) activeWorkout.classList.remove('hidden');
    if (addExerciseSection) addExerciseSection.classList.remove('hidden');
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

    if (!window.addingForDate) {
        startWorkoutDurationTimer();
    } else {
        const workoutDuration = document.getElementById('workout-duration');
        if (workoutDuration) {
            workoutDuration.textContent = 'Adding Missing Day';
        }
    }

    addUnitsToggle();
    renderWorkout();
    updateWorkoutStats();

    showNotification(`${workoutType} workout loaded!`, 'success');
}

// Workout State Management
function updateWorkoutStateUI() {
    const statusEl = document.getElementById('workout-status');
    const pauseBtn = document.getElementById('pause-workout-btn');
    const completeBtn = document.getElementById('complete-workout-btn');
    
    if (!statusEl) return;
    
    if (workoutState !== 'started' && globalRestTimer) {
        clearInterval(globalRestTimer);
        globalRestTimer = null;
        globalRestTimerActive = false;
        globalRestTimeLeft = 0;
    }
    
    statusEl.className = `workout-status ${workoutState}`;
    
    switch (workoutState) {
        case 'ready':
            statusEl.textContent = 'Ready - Start any exercise to begin';
            if (pauseBtn) pauseBtn.classList.add('hidden');
            if (completeBtn) completeBtn.classList.add('hidden');
            break;
            
        case 'started':
            statusEl.textContent = 'Workout in Progress';
            if (pauseBtn) {
                pauseBtn.classList.remove('hidden');
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Workout';
                pauseBtn.className = 'btn btn-warning';
            }
            if (completeBtn) completeBtn.classList.remove('hidden');
            break;
            
        case 'paused':
            statusEl.textContent = 'Workout Paused';
            if (pauseBtn) {
                pauseBtn.classList.remove('hidden');
                pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume Workout';
                pauseBtn.className = 'btn btn-success';
            }
            if (completeBtn) completeBtn.classList.remove('hidden');
            break;
            
        case 'completed':
            statusEl.textContent = 'Workout Completed!';
            if (pauseBtn) pauseBtn.classList.add('hidden');
            if (completeBtn) completeBtn.classList.add('hidden');
            break;
    }
    
    if (currentWorkout) {
        renderWorkout();
    }
}

function toggleWorkoutPause() {
    if (workoutState === 'started') {
        pauseWorkout();
    } else if (workoutState === 'paused') {
        resumeWorkout();
    }
}

function pauseWorkout() {
    workoutState = 'paused';
    lastPauseTime = new Date();
    savedData.workoutState = workoutState;
    
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
    
    if (globalRestTimer) {
        clearInterval(globalRestTimer);
        globalRestTimer = null;
    }
    
    updateWorkoutStateUI();
    saveWorkoutData();
    
    showNotification('Workout paused - all timers stopped', 'info');
}

function resumeWorkout() {
    if (lastPauseTime) {
        const pauseDuration = new Date() - lastPauseTime;
        totalPausedTime += pauseDuration;
        savedData.totalPausedTime = totalPausedTime;
    }
    
    workoutState = 'started';
    savedData.workoutState = workoutState;
    
    startWorkoutDurationTimer();
    
    if (globalRestTimeLeft > 0 && !globalRestTimerActive) {
        globalRestTimerActive = true;
        globalRestTimer = setInterval(() => {
            globalRestTimeLeft--;
            updateGlobalTimerDisplay();
            
            if (globalRestTimeLeft <= 0) {
                clearInterval(globalRestTimer);
                globalRestTimerActive = false;
                
                if ('vibrate' in navigator) {
                    navigator.vibrate([200, 100, 200, 100, 200]);
                }
                
                showNotification('Rest complete! Ready for next set! 💪', 'success');
                updateGlobalTimerDisplay();
            }
        }, 1000);
    }
    
    updateWorkoutStateUI();
    saveWorkoutData();
    
    showNotification('Workout resumed', 'success');
}

async function completeWorkout() {
    let hasAnyProgress = false;
    let totalSetsCompleted = 0;
    let totalPossibleSets = 0;
    
    if (currentWorkout && savedData.exercises) {
        currentWorkout.exercises.forEach((exercise, index) => {
            totalPossibleSets += exercise.sets;
            const sets = savedData.exercises[`exercise_${index}`]?.sets || [];
            const completedSets = sets.filter(set => set && set.reps && set.weight).length;
            totalSetsCompleted += completedSets;
            if (completedSets > 0) hasAnyProgress = true;
        });
    }
    
    if (!hasAnyProgress) {
        const confirmEmpty = window.confirm('You haven\'t completed any sets yet. Are you sure you want to finish this workout?');
        if (!confirmEmpty) return;
    } else if (totalSetsCompleted < totalPossibleSets) {
        const completionRate = Math.round((totalSetsCompleted / totalPossibleSets) * 100);
        const confirmEarly = window.confirm(`You've completed ${totalSetsCompleted}/${totalPossibleSets} sets (${completionRate}%). Finish workout now?`);
        if (!confirmEarly) return;
    } else {
        const confirmComplete = window.confirm('Complete this workout? This will mark it as finished.');
        if (!confirmComplete) return;
    }
    
    workoutState = 'completed';
    
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
    
    if (globalRestTimer) {
        clearInterval(globalRestTimer);
        globalRestTimer = null;
        globalRestTimerActive = false;
        globalRestTimeLeft = 0;
    }

    const now = new Date();
    const totalDuration = workoutStartTime ? Math.floor((now - workoutStartTime - totalPausedTime) / 1000) : 0;
    
    activeExercises.clear();
    
    savedData.completedAt = now.toISOString();
    savedData.totalDuration = totalDuration;
    savedData.workoutState = workoutState;
    savedData.completionRate = totalPossibleSets > 0 ? Math.round((totalSetsCompleted / totalPossibleSets) * 100) : 0;
    
    await saveWorkoutData();
    
    updateWorkoutStateUI();
    showCompletionModal();
}

async function cancelWorkout() {
    const confirmCancel = window.confirm('Cancel this workout? This will delete it completely and it will not be saved in your history.');
    if (!confirmCancel) return;
    
    try {
        if (currentUser && savedData.date) {
            const docRef = doc(db, "users", currentUser.uid, "workouts", savedData.date);
            await deleteDoc(docRef);
            console.log('Workout deleted from Firebase');
        }
        
        showNotification('Workout cancelled and deleted', 'info');
        showWorkoutSelector();
        
        currentWorkout = null;
        savedData = {};
        workoutStartTime = null;
        workoutState = 'ready';
        totalPausedTime = 0;
        lastPauseTime = null;
        
    } catch (error) {
        console.error('Error cancelling workout:', error);
        showNotification('Error cancelling workout', 'error');
    }
}

// Timer Functions
function startWorkoutDurationTimer() {
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }

    workoutDurationTimer = setInterval(() => {
        if (workoutState !== 'started') return;
        
        if (!globalRestTimerActive) {
            updateWorkoutDurationDisplay();
        }
    }, 1000);
}

function updateWorkoutDurationDisplay() {
    if (workoutState !== 'started' || !workoutStartTime) return;
    
    const now = new Date();
    const elapsed = Math.floor((now - workoutStartTime - totalPausedTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const workoutDuration = document.getElementById('workout-duration');
    if (workoutDuration) {
        workoutDuration.innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function startRestTimer() {
    if (globalRestTimer) {
        clearInterval(globalRestTimer);
    }
    
    globalRestTimeLeft = 60;
    globalRestTimerActive = true;
    updateGlobalTimerDisplay();
    
    showNotification('Rest timer started - 60 seconds', 'info');
    
    globalRestTimer = setInterval(() => {
        globalRestTimeLeft--;
        updateGlobalTimerDisplay();
        
        if (globalRestTimeLeft <= 0) {
            clearInterval(globalRestTimer);
            globalRestTimerActive = false;
            
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
            
            showNotification('Rest complete! Ready for next set! 💪', 'success');
            updateGlobalTimerDisplay();
        }
    }, 1000);
}

function updateGlobalTimerDisplay() {
    const workoutDuration = document.getElementById('workout-duration');
    if (!workoutDuration) return;
    
    if (globalRestTimerActive && globalRestTimeLeft > 0) {
        const minutes = Math.floor(globalRestTimeLeft / 60);
        const seconds = globalRestTimeLeft % 60;
        workoutDuration.innerHTML = `
            <span style="color: var(--warning); font-weight: bold;">
                <i class="fas fa-clock"></i> Rest: ${minutes}:${seconds.toString().padStart(2, '0')}
            </span>
        `;
    } else if (!globalRestTimerActive && globalRestTimeLeft === 0 && globalRestTimer) {
        workoutDuration.innerHTML = `
            <span style="color: var(--success); font-weight: bold;">
                <i class="fas fa-check-circle"></i> Rest Complete!
            </span>
        `;
        setTimeout(() => {
            if (!globalRestTimerActive) {
                updateWorkoutDurationDisplay();
            }
        }, 3000);
    } else {
        updateWorkoutDurationDisplay();
    }
}

// Exercise Management
async function startExercise(exerciseIndex) {
    console.log(`Starting exercise ${exerciseIndex}`);
    
    activeExercises.add(exerciseIndex);
    
    if (!firstExerciseStarted) {
        firstExerciseStarted = true;
        workoutState = 'started';
        workoutStartTime = new Date();
        savedData.workoutState = workoutState;
        savedData.actualStartTime = workoutStartTime.toISOString();
        
        startWorkoutDurationTimer();
        updateWorkoutStateUI();
        showNotification('Workout started! 💪', 'success');
    }
    
    await saveWorkoutData();
    renderSingleExercise(exerciseIndex);
    
    setTimeout(() => {
        const card = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
        if (card) {
            const content = card.querySelector('.exercise-content');
            const icon = card.querySelector('.collapse-icon');
            if (content && icon && content.style.display === 'none') {
                content.style.display = 'block';
                icon.className = 'fas fa-chevron-up collapse-icon';
            }
        }
    }, 100);
    
    showNotification(`${currentWorkout.exercises[exerciseIndex].machine} started!`, 'success');
}

function pauseExercise(exerciseIndex) {
    activeExercises.delete(exerciseIndex);
    renderSingleExercise(exerciseIndex);
    showNotification('Exercise paused - you can resume anytime', 'info');
}

function markExerciseComplete(exerciseIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    const sets = savedData.exercises[`exercise_${exerciseIndex}`]?.sets || [];
    const completedSets = sets.filter(set => set && set.reps && set.weight).length;
    
    if (completedSets === 0) {
        showNotification('Complete at least one set before marking as done', 'warning');
        return;
    }
    
    activeExercises.delete(exerciseIndex);
    renderSingleExercise(exerciseIndex);
    checkWorkoutCompletion();
    
    showNotification(`${exercise.machine} marked complete!`, 'success');
}

function reopenExercise(exerciseIndex) {
    activeExercises.add(exerciseIndex);
    renderSingleExercise(exerciseIndex);
    
    setTimeout(() => {
        const card = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
        if (card) {
            const content = card.querySelector('.exercise-content');
            const icon = card.querySelector('.collapse-icon');
            if (content && icon) {
                content.style.display = 'block';
                icon.className = 'fas fa-chevron-up collapse-icon';
            }
        }
    }, 100);
    
    showNotification('Exercise reopened for editing', 'info');
}

function checkWorkoutCompletion() {
    if (!currentWorkout) return;
    
    let allExercisesCompleted = true;
    
    currentWorkout.exercises.forEach((exercise, index) => {
        const sets = savedData.exercises[`exercise_${index}`]?.sets || [];
        const completedSets = sets.filter(set => set && set.reps && set.weight).length;
        
        if (completedSets === 0) {
            allExercisesCompleted = false;
        }
    });
    
    if (allExercisesCompleted && activeExercises.size === 0) {
        setTimeout(() => {
            const shouldAutoComplete = window.confirm('All exercises completed! Finish workout?');
            if (shouldAutoComplete) {
                completeWorkout();
            }
        }, 500);
    }
}

// Rendering Functions
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
    const completedSets = savedSets.filter(set => set && set.reps && set.weight).length;
    const isCompleted = completedSets === exercise.sets;
    const isStarted = activeExercises.has(index);
    const hasProgress = completedSets > 0;
    
    let exerciseState = 'ready';
    if (isCompleted) exerciseState = 'completed';
    else if (isStarted || hasProgress) exerciseState = 'active';
    
    const shouldExpand = (exerciseState === 'active');
    
    if (isCompleted) {
        card.classList.add('completed');
    } else if (exerciseState === 'active') {
        card.classList.add('active');
    }

    card.innerHTML = `
        <div class="exercise-header" onclick="toggleExerciseExpansion(${index})">
            <div class="exercise-title-section">
                <h3 class="exercise-title">${exercise.machine}</h3>
                <div class="exercise-progress">
                    <span class="progress-text">${completedSets}/${exercise.sets} sets</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill" style="width: ${(completedSets/exercise.sets)*100}%"></div>
                    </div>
                    <span class="exercise-state-badge ${exerciseState}">${getStateBadgeText(exerciseState)}</span>
                </div>
            </div>
            <div class="exercise-controls">
                <i class="fas fa-chevron-${shouldExpand ? 'up' : 'down'} collapse-icon"></i>
                <div class="exercise-actions">
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteExercise(${index})" 
                            title="Remove this exercise from workout">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>

        ${exercise.video && shouldExpand ? `
            <a href="${exercise.video}" target="_blank" class="video-link">
                <i class="fas fa-play-circle"></i> Watch Form Video
            </a>
        ` : ''}

        <div class="exercise-content" style="display: ${shouldExpand ? 'block' : 'none'};">
            ${exerciseState === 'ready' ? `
                <div class="exercise-start-section">
                    <button class="btn btn-success" onclick="startExercise(${index})" style="width: 100%; margin-bottom: 1rem;">
                        <i class="fas fa-play"></i> Start ${exercise.machine}
                    </button>
                    <div class="exercise-preview">
                        <p><strong>Target:</strong> ${exercise.sets} sets × ${exercise.reps} reps @ ${exercise.weight} ${useKilograms ? 'kg' : 'lbs'}</p>
                        ${exercise.video ? `<p><a href="${exercise.video}" target="_blank">📹 Form video available</a></p>` : ''}
                    </div>
                </div>
            ` : `
                <div class="exercise-tracking">
                    ${exerciseState === 'active' ? `
                        <div class="exercise-controls-bar">
                            <button class="btn btn-warning btn-small" onclick="pauseExercise(${index})">
                                <i class="fas fa-pause"></i> Pause
                            </button>
                            <button class="btn btn-success btn-small" onclick="markExerciseComplete(${index})">
                                <i class="fas fa-check"></i> Mark Complete
                            </button>
                        </div>
                    ` : ''}
                    
                    <table class="exercise-table">
                        <thead>
                            <tr>
                                <th>Set</th>
                                <th>Reps</th>
                                <th>Weight (${useKilograms ? 'kg' : 'lbs'})</th>
                                <th>Previous</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generateSetRows(exercise, index, savedSets)}
                        </tbody>
                    </table>

                    <textarea class="notes-area" placeholder="Exercise notes..." 
                              onchange="handleNoteChange(${index}, this.value)">${savedNotes}</textarea>
                    
                    ${exerciseState === 'completed' ? `
                        <div class="exercise-complete-actions">
                            <button class="btn btn-secondary btn-small" onclick="reopenExercise(${index})">
                                <i class="fas fa-edit"></i> Edit/Fix Mistakes
                            </button>
                        </div>
                    ` : ''}
                </div>
            `}
        </div>
    `;

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
            </tr>
        `;
    }
    return rows;
}


function renderSingleExercise(exerciseIndex) {
    const existingCard = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    if (!existingCard || !currentWorkout) return;
    
    const exercise = currentWorkout.exercises[exerciseIndex];
    const newCard = createExerciseCard(exercise, exerciseIndex);
    
    const wasExpanded = existingCard.querySelector('.exercise-content').style.display === 'block';
    if (wasExpanded) {
        newCard.querySelector('.exercise-content').style.display = 'block';
        newCard.querySelector('.collapse-icon').className = 'fas fa-chevron-up collapse-icon';
    }
    
    existingCard.replaceWith(newCard);
}

// Input handling
async function handleSetChange(exerciseIndex, setIndex, field, value) {
    console.log(`Saving set: exercise ${exerciseIndex}, set ${setIndex}, ${field} = ${value}`);
    await saveSet(exerciseIndex, setIndex, field, value);
}

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
    
    await saveWorkoutData();
    
    const inputs = document.querySelectorAll(`input[onchange*="handleSetChange(${exerciseIndex}, ${setIndex}"]`);
    inputs.forEach(input => {
        if (input.getAttribute('onchange').includes(`'${field}'`)) {
            input.classList.toggle('completed', !!value);
        }
    });
    
    // ADD THIS SECTION - Check if both reps and weight are completed, then start rest timer
    const setData = savedData.exercises[`exercise_${exerciseIndex}`].sets[setIndex];
    if (setData && setData.reps && setData.weight) {
        console.log(`Set completed! Starting rest timer`);
        startRestTimer();
    }
    
    checkExerciseCompletion(exerciseIndex);
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

function checkExerciseCompletion(exerciseIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    const sets = savedData.exercises[`exercise_${exerciseIndex}`]?.sets || [];
    
    const completedSets = sets.filter(set => set && set.reps && set.weight).length;
    const card = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    
    if (card) {
        const wasCompleted = card.classList.contains('completed');
        const isCompleted = completedSets === exercise.sets;
        
        card.classList.toggle('completed', isCompleted);
        
        const progressFill = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${(completedSets/exercise.sets)*100}%`;
        }
        if (progressText) {
            progressText.textContent = `${completedSets}/${exercise.sets} sets`;
        }
        
        if (!wasCompleted && isCompleted) {
            showExerciseCompletion(exerciseIndex, exercise.machine);
            
            setTimeout(() => {
                const content = card.querySelector('.exercise-content');
                const icon = card.querySelector('.collapse-icon');
                if (content && icon) {
                    content.style.display = 'none';
                    icon.className = 'fas fa-chevron-down collapse-icon';
                }
            }, 2000);
        }
    }
}

function showExerciseCompletion(exerciseIndex, exerciseName) {
    showNotification(`💪 ${exerciseName} completed!`, 'success');
    
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 100]);
    }
}

// UI Helper Functions
function toggleExerciseExpansion(exerciseIndex) {
    const card = document.querySelector(`[data-exercise-index="${exerciseIndex}"]`);
    if (!card) return;
    
    const content = card.querySelector('.exercise-content');
    const icon = card.querySelector('.collapse-icon');
    
    if (!content || !icon) return;
    
    const isCurrentlyVisible = content.style.display !== 'none';
    
    if (isCurrentlyVisible) {
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-down collapse-icon';
    } else {
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-up collapse-icon';
    }
}

function getStateBadgeText(state) {
    switch(state) {
        case 'ready': return 'Ready';
        case 'active': return 'In Progress';
        case 'completed': return 'Complete';
        default: return '';
    }
}

// Unit Conversion Functions
function convertWeight(weight, toKg = false) {
    if (!weight) return weight;
    const numWeight = parseFloat(weight);
    if (toKg) {
        return Math.round(numWeight / 2.205 * 10) / 10;
    } else {
        return Math.round(numWeight * 2.205 * 10) / 10;
    }
}

function addUnitsToggle() {
    const workoutHeader = document.querySelector('.workout-header');
    if (workoutHeader && !document.getElementById('units-toggle')) {
        const unitsToggle = document.createElement('div');
        unitsToggle.id = 'units-toggle';
        unitsToggle.className = 'units-toggle';
        unitsToggle.innerHTML = `
            <button class="btn btn-small ${useKilograms ? 'btn-secondary' : 'btn-primary'}" 
                    onclick="toggleUnits('lbs')" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                lbs
            </button>
            <button class="btn btn-small ${useKilograms ? 'btn-primary' : 'btn-secondary'}" 
                    onclick="toggleUnits('kg')" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                kg
            </button>
        `;
        
        const workoutActions = workoutHeader.querySelector('.workout-actions');
        if (workoutActions) {
            workoutActions.appendChild(unitsToggle);
        }
    }
}

function toggleUnits(unit) {
    const wasKg = useKilograms;
    useKilograms = (unit === 'kg');
    
    if (currentWorkout && wasKg !== useKilograms) {
        document.querySelectorAll('.exercise-table').forEach(table => {
            const weightInputs = table.querySelectorAll('input[onchange*="weight"]');
            weightInputs.forEach(input => {
                if (input.value) {
                    const currentValue = parseFloat(input.value);
                    input.value = convertWeight(currentValue, useKilograms);
                }
            });
            
            const placeholders = table.querySelectorAll('input[placeholder]');
            placeholders.forEach(input => {
                if (input.getAttribute('onchange') && input.getAttribute('onchange').includes('weight')) {
                    const placeholder = parseFloat(input.placeholder);
                    if (placeholder) {
                        input.placeholder = convertWeight(placeholder, useKilograms);
                    }
                }
            });
        });
        
        document.querySelectorAll('.exercise-table td small').forEach(small => {
            const text = small.textContent;
            const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(lbs|kg)/);
            if (weightMatch) {
                const weight = parseFloat(weightMatch[1]);
                const newWeight = convertWeight(weight, useKilograms);
                const newUnit = useKilograms ? 'kg' : 'lbs';
                small.textContent = text.replace(weightMatch[0], `${newWeight} ${newUnit}`);
            }
        });
    }
    
    addUnitsToggle();
    showNotification(`Switched to ${unit.toUpperCase()}`, 'info');
}

// Data Management
function saveWorkoutOffline() {
    try {
        localStorage.setItem('bigsurf_offline_workout', JSON.stringify(savedData));
        console.log('💾 Workout saved offline');
    } catch (error) {
        console.error('❌ Error saving offline:', error);
    }
}

function clearOfflineWorkout() {
    try {
        localStorage.removeItem('bigsurf_offline_workout');
        console.log('🗑️ Cleared offline workout data');
    } catch (error) {
        console.error('❌ Error clearing offline data:', error);
    }
}

async function saveWorkoutData() {
    if (!currentUser) return;
    
    const saveDate = window.addingForDate || savedData.date || getTodayDateString();
    savedData.date = saveDate;
    
    saveWorkoutOffline();
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", saveDate);
        await setDoc(docRef, {
            ...savedData,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('💾 Workout data saved successfully for', saveDate);
        clearOfflineWorkout();
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Saved offline (will sync when online)', 'warning');
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
    
    const workout = workoutPlans.find(w => w.day === data.workoutType);
    if (!workout) {
        container.innerHTML = '<p>Workout plan not found</p>';
        return;
    }
    
    workout.exercises.forEach((exercise, index) => {
        const card = createHistoryExerciseCard(exercise, index, data.exercises?.[`exercise_${index}`] || {});
        container.appendChild(card);
    });
    
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
                    <th>Weight (${useKilograms ? 'kg' : 'lbs'})</th>
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
    const unit = useKilograms ? 'kg' : 'lbs';
    const displayWeight = useKilograms ? convertWeight(exercise.weight, true) : exercise.weight;
    
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
                        ${exercise.reps} × ${displayWeight} ${unit}
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
    
    try {
        const todayDocRef = doc(db, "users", currentUser.uid, "workouts", today);
        const todayDocSnap = await getDoc(todayDocRef);
        
        if (todayDocSnap.exists() && todayDocSnap.data().workoutType) {
            const confirm = window.confirm('You already have a workout for today. Replace it?');
            if (!confirm) return;
        }
        
        const newWorkoutData = {
            workoutType: historyData.workoutType,
            date: today,
            startTime: new Date().toISOString(),
            exercises: {}
        };
        
        await setDoc(todayDocRef, newWorkoutData);
        showNotification(`${historyData.workoutType} copied to today!`, 'success');
        
        switchTab('today');
        await loadTodaysWorkout();
        
    } catch (error) {
        console.error('❌ Error copying workout:', error);
        showNotification('Failed to copy workout', 'error');
    }
}

async function editHistoryWorkout() {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const date = historyData.date;
    
    window.addingForDate = date;
    
    switchTab('today');
    
    const workout = workoutPlans.find(w => w.day === historyData.workoutType);
    if (!workout) {
        showNotification('Workout plan not found', 'error');
        return;
    }
    
    currentWorkout = workout;
    savedData = historyData;
    workoutStartTime = historyData.startTime ? new Date(historyData.startTime) : new Date();
    workoutState = historyData.workoutState || 'ready';
    totalPausedTime = historyData.totalPausedTime || 0;
    
    document.getElementById('workout-selector').classList.add('hidden');
    document.getElementById('active-workout').classList.remove('hidden');
    document.getElementById('add-exercise-section').classList.remove('hidden');
    document.getElementById('current-workout-title').textContent = historyData.workoutType;
    document.getElementById('current-workout-date').textContent = `Editing ${new Date(date).toLocaleDateString()}`;
    
    document.getElementById('today-date-display').textContent = 
        `Editing Workout from ${new Date(date).toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`;
    
    if (workoutDurationTimer) {
        clearInterval(workoutDurationTimer);
    }
    
    if (historyData.totalDuration) {
        const minutes = Math.floor(historyData.totalDuration / 60);
        const seconds = historyData.totalDuration % 60;
        document.getElementById('workout-duration').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')} (completed)`;
    } else {
        document.getElementById('workout-duration').textContent = 'In Progress';
    }
    
    updateWorkoutStateUI();
    renderWorkout();
    updateWorkoutStats();
    
    showNotification(`Now editing ${historyData.workoutType} from ${new Date(date).toLocaleDateString()}`, 'info');
}

async function deleteEntireWorkout() {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const workoutName = `${historyData.workoutType} from ${new Date(historyData.date).toLocaleDateString()}`;
    
    const confirmDelete = window.confirm(`Delete "${workoutName}" completely? This cannot be undone.`);
    if (!confirmDelete) return;
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", historyData.date);
        await deleteDoc(docRef);
        
        document.getElementById('history-workout-display').classList.add('hidden');
        loadRecentWorkouts();
        
        showNotification(`"${workoutName}" deleted successfully`, 'success');
        
    } catch (error) {
        console.error('❌ Error deleting workout:', error);
        showNotification('Failed to delete workout', 'error');
    }
}

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
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", selectedDate);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().workoutType) {
            const confirm = window.confirm(`A workout already exists for ${selectedDate}. Replace it?`);
            if (!confirm) return;
        }
        
        window.addingForDate = selectedDate;
        
        switchTab('today');
        
        document.getElementById('today-date-display').textContent = 
            `Adding Workout for ${new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}`;
        
        currentWorkout = null;
        savedData = {};
        workoutStartTime = null;
        workoutState = 'ready';
        totalPausedTime = 0;
        lastPauseTime = null;
        
        showWorkoutSelector();
        
        showNotification(`Choose a workout to add for ${new Date(selectedDate).toLocaleDateString()}`, 'info');
        
    } catch (error) {
        console.error('❌ Error checking existing workout:', error);
        showNotification('Error checking existing workout', 'error');
    }
}

async function deleteHistoryExercise(exerciseIndex) {
    if (!window.currentHistoryData || !currentUser) return;
    
    const historyData = window.currentHistoryData;
    const workout = workoutPlans.find(w => w.day === historyData.workoutType);
    if (!workout) return;
    
    const exercise = workout.exercises[exerciseIndex];
    const confirmDelete = window.confirm(`Remove "${exercise.machine}" from this workout?`);
    
    if (!confirmDelete) return;
    
    if (historyData.exercises) {
        delete historyData.exercises[`exercise_${exerciseIndex}`];
        
        const newExercises = {};
        
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
    
    workout.exercises.splice(exerciseIndex, 1);
    
    try {
        const docRef = doc(db, "users", currentUser.uid, "workouts", historyData.date);
        await setDoc(docRef, historyData);
        
        loadHistoryWorkout(historyData.date, historyData);
        
        showNotification(`"${exercise.machine}" removed from workout`, 'success');
        
    } catch (error) {
        console.error('❌ Error updating history workout:', error);
        showNotification('Failed to update workout', 'error');
    }
}

// Exercise Management Functions
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
    
    currentWorkout.exercises.splice(exerciseIndex, 1);
    
    const newExercises = {};
    
    Object.keys(savedData.exercises || {}).forEach(key => {
        if (key.startsWith('exercise_')) {
            const oldIndex = parseInt(key.split('_')[1]);
            if (oldIndex < exerciseIndex) {
                newExercises[`exercise_${oldIndex}`] = savedData.exercises[key];
            } else if (oldIndex > exerciseIndex) {
                newExercises[`exercise_${oldIndex - 1}`] = savedData.exercises[key];
            }
        }
    });
    
    savedData.exercises = newExercises;
    
    await saveWorkoutData();
    renderWorkout();
    
    showNotification(`"${exercise.machine}" removed from workout`, 'success');
}

// Add Exercise functionality
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
    
    exerciseDatabase.push(newExercise);
    console.log('Added to database, new length:', exerciseDatabase.length);
    
    if (currentUser) {
        try {
            const customExerciseRef = doc(db, "users", currentUser.uid, "customExercises", exerciseName.replace(/[^a-zA-Z0-9]/g, '_'));
            await setDoc(customExerciseRef, newExercise);
            console.log('✅ Custom exercise saved to Firebase');
        } catch (error) {
            console.error('❌ Error saving custom exercise:', error);
        }
    }
    
    closeAddExerciseModal();
    showNotification(`"${exerciseName}" added to exercise library!`, 'success');
}

async function addAndUseExercise(event) {
    event.preventDefault();
    
    await addNewExercise(event);
    
    if (currentWorkout && currentUser) {
        const exerciseName = document.getElementById('exercise-name').value.trim();
        const newExercise = exerciseDatabase.find(ex => ex.name === exerciseName);
        
        if (newExercise) {
            currentWorkout.exercises.push({
                machine: newExercise.machine,
                sets: newExercise.sets,
                reps: newExercise.reps,
                weight: newExercise.weight,
                video: newExercise.video
            });
            
            await saveWorkoutData();
            renderWorkout();
            
            showNotification(`"${exerciseName}" added to today's workout!`, 'success');
        }
    }
}

function addExerciseFromLibrary() {
    if (!currentWorkout) {
        showNotification('Please select a workout first', 'warning');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Add Exercise from Library</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <input type="text" id="library-exercise-search" class="search-input" 
                   placeholder="Search exercises by name, muscle group, or equipment..."
                   oninput="searchLibraryExercises()">
            
            <div id="library-exercise-options">
                <!-- Exercise options will be populated here -->
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    searchLibraryExercises();
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function searchLibraryExercises() {
    const query = document.getElementById('library-exercise-search')?.value.toLowerCase() || '';
    const container = document.getElementById('library-exercise-options');
    
    if (!container) return;
    
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
                ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} ${useKilograms ? 'kg' : 'lbs'}
            </div>
        `;
        option.addEventListener('click', () => addExerciseToWorkout(exercise));
        container.appendChild(option);
    });
}

async function addExerciseToWorkout(exercise) {
    if (!currentWorkout || !currentUser) return;
    
    currentWorkout.exercises.push({
        machine: exercise.machine || exercise.name,
        sets: exercise.sets || 3,
        reps: exercise.reps || 10,
        weight: exercise.weight || 50,
        video: exercise.video || ''
    });
    
    await saveWorkoutData();
    renderWorkout();
    
    document.querySelector('.modal')?.remove();
    
    showNotification(`"${exercise.machine || exercise.name}" added to workout!`, 'success');
}

// Exercise Swapping Modal
function openSwapModal(exerciseIndex) {
    window.currentSwapIndex = exerciseIndex;
    document.getElementById('swap-modal').classList.remove('hidden');
    document.getElementById('exercise-search').value = '';
    searchExercises();
}

function closeSwapModal() {
    document.getElementById('swap-modal').classList.add('hidden');
    document.getElementById('exercise-search').value = '';
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
                ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} ${useKilograms ? 'kg' : 'lbs'}
            </div>
        `;
        option.addEventListener('click', () => swapExercise(exercise));
        container.appendChild(option);
    });
}

function swapExercise(newExercise) {
    const exerciseIndex = window.currentSwapIndex;
    
    if (window.isHistorySwap && window.currentHistoryData) {
        const historyData = window.currentHistoryData;
        const workout = workoutPlans.find(w => w.day === historyData.workoutType);
        if (!workout) return;
        
        workout.exercises[exerciseIndex] = {
            machine: newExercise.machine || newExercise.name,
            sets: newExercise.sets || 3,
            reps: newExercise.reps || 10,
            weight: newExercise.weight || 50,
            video: newExercise.video || ''
        };
        
        if (historyData.exercises && historyData.exercises[`exercise_${exerciseIndex}`]) {
            historyData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
        }
        
        saveHistoryWorkoutData(historyData).then(() => {
            loadHistoryWorkout(historyData.date, historyData);
            showNotification(`Exercise swapped to ${newExercise.machine || newExercise.name}`, 'success');
        });
        
    } else {
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

function openSwapModalForHistory(exerciseIndex) {
    if (!window.currentHistoryData) return;
    
    window.currentSwapIndex = exerciseIndex;
    window.isHistorySwap = true;
    
    document.getElementById('swap-modal').classList.remove('hidden');
    document.getElementById('exercise-search').value = '';
    searchExercises();
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

// Completion and Navigation
async function loadLastWorkout() {
    if (!currentUser) {
        showNotification('Please sign in first', 'warning');
        return;
    }

    try {
        const workoutsRef = collection(db, "users", currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showNotification('No previous workouts found', 'info');
            return;
        }
        
        const lastWorkoutDoc = querySnapshot.docs[0];
        const lastWorkoutData = lastWorkoutDoc.data();
        
        if (!lastWorkoutData.workoutType || lastWorkoutData.workoutType === 'none') {
            showNotification('No valid previous workout found', 'info');
            return;
        }
        
        selectWorkout(lastWorkoutData.workoutType);
        showNotification(`Started ${lastWorkoutData.workoutType} workout (like last time)`, 'success');
        
    } catch (error) {
        console.error('❌ Error loading last workout:', error);
        showNotification('Error loading last workout', 'error');
    }
}

function showCompletionModal() {
    const isHistoryEdit = window.addingForDate || (savedData.date !== getTodayDateString());
    const workoutDate = isHistoryEdit ? new Date(savedData.date).toLocaleDateString() : 'today';
    
    let totalSets = 0;
    let completedSets = 0;
    let totalWeight = 0;
    
    if (savedData.exercises) {
        Object.keys(savedData.exercises).forEach(key => {
            if (key.startsWith('exercise_')) {
                const sets = savedData.exercises[key].sets || [];
                sets.forEach(set => {
                    if (set && set.reps && set.weight) {
                        completedSets++;
                        totalWeight += (parseInt(set.reps) * parseInt(set.weight));
                    }
                });
            }
        });
    }
    
    currentWorkout.exercises.forEach(exercise => {
        totalSets += exercise.sets;
    });
    
    const completionRate = savedData.completionRate || (totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0);
    const duration = savedData.totalDuration ? 
        `${Math.floor(savedData.totalDuration / 60)}:${(savedData.totalDuration % 60).toString().padStart(2, '0')}` : 
        'N/A';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center; max-width: 500px;">
            <div style="color: var(--success); font-size: 3rem; margin-bottom: 1rem;">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 style="color: var(--success); margin: 0 0 1rem 0;">
                ${completionRate >= 100 ? 'Workout Complete! 💪' : 'Good Work! 👍'}
            </h2>
            <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                ${savedData.workoutType} workout ${isHistoryEdit ? `for ${workoutDate}` : ''}
            </p>
            
            <div class="completion-stats">
                <div class="completion-stat">
                    <span class="number">${completedSets}/${totalSets}</span>
                    <span class="label">Sets Completed</span>
                </div>
                <div class="completion-stat">
                    <span class="number">${completionRate}%</span>
                    <span class="label">Completion Rate</span>
                </div>
                <div class="completion-stat">
                    <span class="number">${Math.round(totalWeight).toLocaleString()}</span>
                    <span class="label">Total Volume (${useKilograms ? 'kg' : 'lbs'})</span>
                </div>
                <div class="completion-stat">
                    <span class="number">${duration}</span>
                    <span class="label">Duration</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem;">
                ${!isHistoryEdit ? `
                    <button class="btn btn-primary" onclick="loadLastWorkout(); this.closest('.modal').remove();">
                        <i class="fas fa-redo"></i> Do This Again
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="goToHistory(); this.closest('.modal').remove();">
                    <i class="fas fa-history"></i> View History
                </button>
                <button class="btn btn-secondary" onclick="goToHome(); this.closest('.modal').remove();">
                    <i class="fas fa-home"></i> Back to Home
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
            goToHome();
        }
    }, 15000);
}

function startNewWorkout() {
    currentWorkout = null;
    savedData = {};
    workoutStartTime = null;
    workoutState = 'ready';
    totalPausedTime = 0;
    lastPauseTime = null;
    window.addingForDate = null;
    
    switchTab('today');
    showWorkoutSelector();
    setTodayDisplay();
}

function goToHistory() {
    switchTab('history');
    loadRecentWorkouts();
}

function goToHome() {
    switchTab('today');
    showWorkoutSelector();
    setTodayDisplay();
    
    currentWorkout = null;
    savedData = {};
    workoutStartTime = null;
    workoutState = 'ready';
    totalPausedTime = 0;
    lastPauseTime = null;
    window.addingForDate = null;
}

// Export Functions
async function exportAllData() {
    if (!currentUser) {
        showNotification('Please sign in to export data', 'warning');
        return;
    }
    
    try {
        const workoutsRef = collection(db, "users", currentUser.uid, "workouts");
        const querySnapshot = await getDocs(workoutsRef);
        
        const allWorkouts = [];
        querySnapshot.forEach((doc) => {
            allWorkouts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        const exportData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            exportDate: new Date().toISOString(),
            totalWorkouts: allWorkouts.length,
            workouts: allWorkouts
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `big-surf-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showNotification(`Exported ${allWorkouts.length} workouts successfully!`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export failed', 'error');
    }
}

async function exportWorkoutsCSV() {
    if (!currentUser) {
        showNotification('Please sign in to export data', 'warning');
        return;
    }
    
    try {
        const workoutsRef = collection(db, "users", currentUser.uid, "workouts");
        const querySnapshot = await getDocs(workoutsRef);
        
        let csvContent = "Date,Workout Type,Duration (min),Exercises,Sets Completed,Total Volume (lbs),Completed\n";
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let totalSets = 0;
            let totalVolume = 0;
            let exerciseCount = 0;
            
            if (data.exercises) {
                Object.keys(data.exercises).forEach(key => {
                    if (key.startsWith('exercise_')) {
                        exerciseCount++;
                        const sets = data.exercises[key].sets || [];
                        sets.forEach(set => {
                            if (set && set.reps && set.weight) {
                                totalSets++;
                                totalVolume += (parseInt(set.reps) * parseInt(set.weight));
                            }
                        });
                    }
                });
            }
            
            const duration = data.totalDuration ? Math.round(data.totalDuration / 60) : 0;
            const isCompleted = data.completedAt ? 'Yes' : 'No';
            
            csvContent += `${data.date},${data.workoutType || 'Unknown'},${duration},${exerciseCount},${totalSets},${totalVolume},${isCompleted}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `big-surf-workouts-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showNotification('CSV exported successfully!', 'success');
        
    } catch (error) { }
}

function adjustSetValue(exerciseIndex, setIndex, field, delta) {
    // This function can be empty or just return since we removed the +/- buttons
    // but we need it defined so it doesn't throw errors
    return;
}