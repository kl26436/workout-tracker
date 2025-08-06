// Enhanced Data Manager - core/data-manager.js
import { db, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from './firebase-config.js';
import { showNotification, convertWeight } from './ui-helpers.js';

export async function saveWorkoutData(state) {
    if (!state.currentUser) return;
    
    const saveDate = state.savedData.date || state.getTodayDateString();
    state.savedData.date = saveDate;
    state.savedData.exerciseUnits = state.exerciseUnits;
    
    // CRITICAL: Store exercise names and workout structure for proper history display
    if (state.currentWorkout) {
        const exerciseNames = {};
        state.currentWorkout.exercises.forEach((exercise, index) => {
            exerciseNames[`exercise_${index}`] = exercise.machine;
        });
        state.savedData.exerciseNames = exerciseNames;
        
        // Store the complete workout structure for reconstruction
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
        
        // Store total exercise count for progress tracking
        state.savedData.totalExercises = state.currentWorkout.exercises.length;
    }
    
    // Convert all weights to pounds for storage (baseline for future analysis)
    const normalizedData = { ...state.savedData };
    if (normalizedData.exercises) {
        Object.keys(normalizedData.exercises).forEach(exerciseKey => {
            const exerciseData = normalizedData.exercises[exerciseKey];
            const exerciseIndex = parseInt(exerciseKey.split('_')[1]);
            const currentUnit = state.exerciseUnits[exerciseIndex] || state.globalUnit;
            
            if (exerciseData.sets) {
                exerciseData.sets = exerciseData.sets.map(set => {
                    if (set.weight && currentUnit === 'kg') {
                        // Convert kg to lbs for storage
                        return {
                            ...set,
                            weight: Math.round(set.weight * 2.20462),
                            originalUnit: 'kg' // Track what user entered
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
            lastUpdated: new Date().toISOString(),
            version: '2.0' // Mark enhanced data format
        });
        
        console.log('💾 Enhanced workout data saved for', saveDate, '(weights normalized to lbs)');
        return true;
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Failed to save workout data', 'error');
        return false;
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
                !data.completedAt &&
                !data.cancelledAt) {
                console.log('📅 Loading today\'s in-progress workout:', data.workoutType);
                
                // Validate that the workout plan still exists
                const workoutPlan = state.workoutPlans?.find(w => w.day === data.workoutType);
                if (!workoutPlan) {
                    console.warn('⚠️ Workout plan not found for:', data.workoutType);
                    // Don't load invalid workout
                    return null;
                }
                
                return data; // Return data to be handled by workout manager
            } else {
                if (data.completedAt) {
                    console.log('✅ Previous workout was completed, starting fresh');
                } else if (data.cancelledAt) {
                    console.log('❌ Previous workout was cancelled, starting fresh');
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
        
        // Your existing workout loading code...
        const workoutResponse = await fetch('./workouts.json');
        if (workoutResponse.ok) {
            state.workoutPlans = await workoutResponse.json();
            console.log('✅ Workout plans loaded:', state.workoutPlans.length);
        }
        
        // Load exercise database
        const exerciseResponse = await fetch('./exercises.json');
        if (exerciseResponse.ok) {
            state.exerciseDatabase = await exerciseResponse.json();
            console.log('✅ Exercise database loaded:', state.exerciseDatabase.length);
        }
        
        // CRITICAL: If user is signed in, refresh with custom exercises
        if (state.currentUser) {
            console.log('👤 User signed in, refreshing with custom exercises...');
            await refreshExerciseDatabase();
        }
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showNotification('Error loading workout data. Using defaults.', 'error');
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
            
            // Check if this workout has exercise names stored (enhanced format)
            if (data.exerciseNames && data.exercises) {
                // Enhanced format - use stored exercise names
                Object.keys(data.exerciseNames).forEach(key => {
                    if (data.exerciseNames[key] === exerciseName && data.exercises[key] && data.exercises[key].sets) {
                        const completedSets = data.exercises[key].sets.filter(set => set && set.reps && set.weight);
                        if (completedSets.length > 0) {
                            lastWorkout = data;
                            lastExerciseData = data.exercises[key];
                            workoutDate = data.date;
                        }
                    }
                });
            } else if (data.exercises) {
                // Legacy format - try to match by workout plan
                Object.keys(data.exercises).forEach(key => {
                    if (key.startsWith('exercise_')) {
                        const exerciseData = data.exercises[key];
                        // Try to find the exercise by matching the workout plan
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

// Enhanced function to load workout history for display
export async function loadWorkoutHistory(state, limitCount = 50) {
    if (!state.currentUser) return [];
    
    try {
        const workoutsRef = collection(db, "users", state.currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        
        const workouts = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Enhanced workout data with proper exercise names
            const workout = {
                id: doc.id,
                date: data.date,
                workoutType: data.workoutType,
                startTime: data.startTime,
                completedAt: data.completedAt,
                cancelledAt: data.cancelledAt,
                totalDuration: data.totalDuration,
                exercises: data.exercises || {},
                exerciseNames: data.exerciseNames || {},
                exerciseUnits: data.exerciseUnits || {},
                originalWorkout: data.originalWorkout,
                totalExercises: data.totalExercises || 0,
                addedManually: data.addedManually || false,
                manualNotes: data.manualNotes || '',
                version: data.version || '1.0'
            };
            
            // Calculate progress
            let completedSets = 0;
            let totalSets = 0;
            
            if (workout.originalWorkout && workout.exercises) {
                workout.originalWorkout.exercises.forEach((exercise, index) => {
                    totalSets += exercise.sets;
                    const exerciseData = workout.exercises[`exercise_${index}`];
                    if (exerciseData && exerciseData.sets) {
                        const completed = exerciseData.sets.filter(set => set && set.reps && set.weight).length;
                        completedSets += completed;
                    }
                });
            }
            
            workout.progress = {
                completedSets,
                totalSets,
                percentage: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
            };
            
            // Determine status
            if (workout.completedAt) {
                workout.status = 'completed';
            } else if (workout.cancelledAt) {
                workout.status = 'cancelled';
            } else {
                workout.status = 'incomplete';
            }
            
            workouts.push(workout);
        });
        
        console.log(`📊 Loaded ${workouts.length} workout history entries`);
        return workouts;
        
    } catch (error) {
        console.error('❌ Error loading workout history:', error);
        return [];
    }
}

// Function to migrate old workout data to new format
export async function migrateWorkoutData(state) {
    if (!state.currentUser) return;
    
    console.log('🔄 Checking for workout data migration...');
    
    try {
        const workoutsRef = collection(db, "users", state.currentUser.uid, "workouts");
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        let migrationCount = 0;
        
        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            
            // Check if this is old format (no version or version 1.0)
            if (!data.version || data.version === '1.0') {
                console.log('🔄 Migrating workout:', data.date, data.workoutType);
                
                // Find the original workout plan
                const workoutPlan = state.workoutPlans?.find(w => w.day === data.workoutType);
                if (workoutPlan && data.exercises) {
                    // Add missing fields
                    const exerciseNames = {};
                    workoutPlan.exercises.forEach((exercise, index) => {
                        exerciseNames[`exercise_${index}`] = exercise.machine;
                    });
                    
                    const updatedData = {
                        ...data,
                        exerciseNames,
                        originalWorkout: {
                            day: workoutPlan.day,
                            exercises: workoutPlan.exercises
                        },
                        totalExercises: workoutPlan.exercises.length,
                        version: '2.0'
                    };
                    
                    // Save updated data
                    await setDoc(doc(db, "users", state.currentUser.uid, "workouts", data.date), updatedData);
                    migrationCount++;
                }
            }
        }
        
        if (migrationCount > 0) {
            console.log(`✅ Migrated ${migrationCount} workout entries to new format`);
            showNotification(`Updated ${migrationCount} workout entries`, 'info');
        }
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
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
                    "machine": "Pec Deck",
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