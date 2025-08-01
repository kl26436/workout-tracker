// Data management for workouts
import { db, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from './firebase-config.js';
import { showNotification } from './ui-helpers.js';

export async function saveWorkoutData(state) {
    if (!state.currentUser) return;
    
    const saveDate = state.savedData.date || state.getTodayDateString();
    state.savedData.date = saveDate;
    state.savedData.exerciseUnits = state.exerciseUnits;
    
    try {
        const docRef = doc(db, "users", state.currentUser.uid, "workouts", saveDate);
        await setDoc(docRef, {
            ...state.savedData,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('💾 Workout data saved successfully for', saveDate);
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Failed to save workout data', 'error');
    }
}

export async function loadTodaysWorkout(state) {
    if (!state.currentUser) return;

    const today = state.getTodayDateString();
    try {
        const docRef = doc(db, "users", state.currentUser.uid, "workouts", today);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only load if it's actually today's workout AND not completed
            if (data.workoutType && 
                data.workoutType !== 'none' && 
                data.date === today && 
                !data.completedAt) {
                console.log('📅 Loading today\'s in-progress workout:', data.workoutType);
                return data; // Return data to be handled by workout manager
            } else {
                if (data.completedAt) {
                    console.log('✅ Previous workout was completed, starting fresh');
                }
                return null; // No valid workout to load
            }
        } else {
            return null; // No workout exists
        }
    } catch (error) {
        console.error('❌ Error loading today\'s workout:', error);
        return null;
    }
}

export async function loadWorkoutPlans(state) {
    try {
        console.log('📥 Loading workout data...');
        
        // Load workout plans
        const workoutResponse = await fetch('./workouts.json');
        if (workoutResponse.ok) {
            state.workoutPlans = await workoutResponse.json();
            console.log('✅ Workout plans loaded:', state.workoutPlans.length);
        } else {
            console.error('❌ Failed to load workouts.json');
            state.workoutPlans = getDefaultWorkouts();
        }
        
        // Load exercise database
        const exerciseResponse = await fetch('./exercises.json');
        if (exerciseResponse.ok) {
            state.exerciseDatabase = await exerciseResponse.json();
            console.log('✅ Exercise database loaded:', state.exerciseDatabase.length);
        } else {
            console.error('❌ Failed to load exercises.json');
            state.exerciseDatabase = getDefaultExercises();
        }
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showNotification('Error loading workout data. Using defaults.', 'error');
        state.workoutPlans = getDefaultWorkouts();
        state.exerciseDatabase = getDefaultExercises();
    }
}

export async function loadExerciseHistory(exerciseName, exerciseIndex, state) {
    if (!state.currentUser) return;
    
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
        const workoutsRef = collection(db, "users", state.currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(15));
        const querySnapshot = await getDocs(q);
        
        let lastWorkout = null;
        let lastExerciseData = null;
        let workoutDate = null;
        
        // Find the most recent workout with this exercise (excluding today)
        const today = state.getTodayDateString();
        
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
                        const workout = state.workoutPlans.find(w => w.day === data.workoutType);
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
            const unit = state.exerciseUnits[exerciseIndex] || state.globalUnit;
            
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