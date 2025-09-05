// Enhanced Data Manager - core/data-manager.js
import { db, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from './firebase-config.js';
import { showNotification, convertWeight } from './ui-helpers.js';

export async function saveWorkoutData(state) {
    if (!state.currentUser) return;
    
    // 🔧 BUG-031 FIX: Ensure proper date handling
    let saveDate = state.savedData.date || state.getTodayDateString();
    
    // Validate and clean the date to prevent timezone issues
    if (saveDate && typeof saveDate === 'string') {
        // If it's an ISO string, extract just the date part
        if (saveDate.includes('T')) {
            saveDate = saveDate.split('T')[0];
            console.log('🔧 BUG-031: Cleaned ISO date string:', saveDate);
        }
        
        // Validate YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(saveDate)) {
            console.warn('⚠️ BUG-031: Invalid date format detected, using today:', saveDate);
            saveDate = state.getTodayDateString();
        }
    } else {
        console.warn('⚠️ BUG-031: No valid date provided, using today');
        saveDate = state.getTodayDateString();
    }
    
    console.log('🔧 BUG-031 DEBUG: Final save date:', saveDate);
    
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
    
    // Convert weights to pounds for storage - FIXED to prevent corruption
    const normalizedData = { ...state.savedData };
    if (normalizedData.exercises) {
        Object.keys(normalizedData.exercises).forEach(exerciseKey => {
            const exerciseData = normalizedData.exercises[exerciseKey];
            const exerciseIndex = parseInt(exerciseKey.split('_')[1]);
            const currentUnit = state.exerciseUnits[exerciseIndex] || state.globalUnit;
            
            if (exerciseData.sets) {
                exerciseData.sets = exerciseData.sets.map(set => {
                    // CRITICAL FIX: Don't convert if already converted or corrupted
                    if (set.weight && currentUnit === 'kg' && 
                        !set.alreadyConverted && 
                        set.weight < 500) { // Reasonable weight check
                        
                        return {
                            ...set,
                            weight: Math.round(set.weight * 2.20462),
                            originalUnit: 'kg',
                            alreadyConverted: true // Prevent double conversion
                        };
                    } else if (set.alreadyConverted || set.weight >= 500) {
                        // Don't touch already converted or corrupted weights
                        return {
                            ...set,
                            originalUnit: set.originalUnit || 'kg'
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
            version: '2.0'
        });
        
        console.log('💾 Enhanced workout data saved for', saveDate);
        return true;
    } catch (error) {
        console.error('❌ Error saving workout data:', error);
        showNotification('Failed to save workout data', 'error');
        return false;
    }
}

export async function loadTodaysWorkout(state) {
    if (!state.currentUser) return null;

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
import { FirebaseWorkoutManager } from './firebase-workout-manager.js';

export async function loadWorkoutPlans(state) {
    try {
        console.log('📥 Loading workout data from Firebase...');
        
        // Import the Firebase workout manager
        const { FirebaseWorkoutManager } = await import('./firebase-workout-manager.js');
        const workoutManager = new FirebaseWorkoutManager(state);
        
        // Load workout templates from Firebase
        state.workoutPlans = await workoutManager.getWorkoutTemplates();
        console.log('✅ Workout plans loaded from Firebase:', state.workoutPlans.length);
        
        // Load exercise database from Firebase
        state.exerciseDatabase = await workoutManager.getExerciseLibrary();
        console.log('✅ Exercise database loaded from Firebase:', state.exerciseDatabase.length);
        
    } catch (error) {
        console.error('❌ Error loading data from Firebase:', error);
        showNotification('Error loading workout data from Firebase. Using fallback.', 'warning');
        
        // Fallback to JSON files if Firebase fails
        try {
            const workoutResponse = await fetch('./workouts.json');
            if (workoutResponse.ok) {
                state.workoutPlans = await workoutResponse.json();
                console.log('✅ Fallback workout plans loaded:', state.workoutPlans.length);
            } else {
                state.workoutPlans = getDefaultWorkouts();
            }
            
            const exerciseResponse = await fetch('./exercises.json');
            if (exerciseResponse.ok) {
                state.exerciseDatabase = await exerciseResponse.json();
                console.log('✅ Fallback exercise database loaded:', state.exerciseDatabase.length);
            } else {
                state.exerciseDatabase = getDefaultExercises();
            }
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
            showNotification('Error loading workout data. Please check your connection.', 'error');
            state.workoutPlans = getDefaultWorkouts();
            state.exerciseDatabase = getDefaultExercises();
        }
    }
}

// FIXED loadExerciseHistory function for data-manager.js
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
        const q = query(workoutsRef, orderBy("lastUpdated", "desc"), limit(50)); // Increased limit
        const querySnapshot = await getDocs(q);
        
        let lastWorkout = null;
        let lastExerciseData = null;
        let workoutDate = null;
        
        // Find the most recent workout with this exercise (excluding today)
        const today = state.getTodayDateString();
        let allMatches = []; // Collect ALL matches, then pick the most recent by date
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Skip today's workout
            if (data.date === today) return;
            
            // FIX: Search through ALL exercises in the workout for a name match
            // This searches across different workout templates
            let foundExerciseKey = null;
            let foundExerciseData = null;
            
            // Method 1: Check exerciseNames mapping
            if (data.exerciseNames) {
                for (const [key, name] of Object.entries(data.exerciseNames)) {
                    if (name === exerciseName) {
                        foundExerciseKey = key;
                        break;
                    }
                }
            }
            
            // Method 2: Check originalWorkout exercises if exerciseNames didn't work
            if (!foundExerciseKey && data.originalWorkout && data.originalWorkout.exercises) {
                data.originalWorkout.exercises.forEach((exercise, index) => {
                    if (exercise.machine === exerciseName) {
                        foundExerciseKey = `exercise_${index}`;
                    }
                });
            }
            
            // Method 3: Search through exercises object directly for machine names
            if (!foundExerciseKey && data.exercises) {
                for (const [key, exerciseData] of Object.entries(data.exercises)) {
                    // Check if this exercise has sets data (meaning it was actually done)
                    if (exerciseData && exerciseData.sets && exerciseData.sets.length > 0) {
                        // Get the corresponding exercise name
                        const exerciseIndex = key.replace('exercise_', '');
                        const exerciseName_check = data.exerciseNames?.[key] || 
                                                 data.originalWorkout?.exercises?.[exerciseIndex]?.machine;
                        
                        if (exerciseName_check === exerciseName) {
                            foundExerciseKey = key;
                            break;
                        }
                    }
                }
            }
            
            // If we found a matching exercise, collect this workout
            if (foundExerciseKey && data.exercises?.[foundExerciseKey]) {
                const exerciseData = data.exercises[foundExerciseKey];
                
                // Only use if it has actual set data
                if (exerciseData.sets && exerciseData.sets.length > 0) {
                    allMatches.push({
                        workout: data,
                        exerciseData: exerciseData,
                        date: data.date
                    });
                    
                    console.log(`✅ Found exercise history for "${exerciseName}" in workout from ${data.date}`);
                }
            }
        });
        
        // Sort matches by date (most recent first) and pick the most recent
        if (allMatches.length > 0) {
            allMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const mostRecent = allMatches[0];
            lastWorkout = mostRecent.workout;
            lastExerciseData = mostRecent.exerciseData;
            workoutDate = mostRecent.date;
            
            console.log(`🎯 Using most recent match from ${workoutDate}`);
            console.log('Exercise data:', lastExerciseData);
        }
        
        // Display the results
        if (lastExerciseData && lastExerciseData.sets) {
            const displayDate = new Date(workoutDate + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
            
            const unit = state.exerciseUnits[exerciseIndex] || state.globalUnit;
            
            let historyHTML = `
                <div class="exercise-history-content" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                    <h5 style="margin: 0 0 0.5rem 0; color: var(--primary);">Last Workout (${displayDate}):</h5>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            
            lastExerciseData.sets.forEach((set, index) => {
                if (set.reps && set.weight) {
                    let displayWeight;
                    
                    // Use originalWeights if available (most reliable)
                    if (set.originalWeights && set.originalWeights[unit]) {
                        displayWeight = set.originalWeights[unit];
                    } else if (set.originalWeights) {
                        // Use whichever originalWeight exists and convert
                        const availableUnit = set.originalWeights.kg ? 'kg' : 'lbs';
                        const availableWeight = set.originalWeights[availableUnit];
                        displayWeight = convertWeight(availableWeight, availableUnit, unit);
                    } else {
                        // Fallback: check originalUnit and handle corrupted data
                        const storedUnit = set.originalUnit || 'lbs';
                        if (set.weight > 500) {
                            // Corrupted weight - show placeholder
                            displayWeight = '??';
                        } else {
                            displayWeight = convertWeight(set.weight, storedUnit, unit);
                        }
                    }
                    
                    historyHTML += `
                        <div style="background: var(--bg-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                            Set ${index + 1}: ${set.reps} × ${displayWeight} ${unit}
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
// RECOVERY FUNCTION: Fix corrupted weight data
async function recoverCorruptedWeights(state) {
    if (!state.currentUser) return;
    
    console.log('🔧 Starting weight corruption recovery...');
    
    let fixedCount = 0;
    
    // Get all workout data
    const workoutsRef = collection(db, "users", state.currentUser.uid, "workouts");
    const snapshot = await getDocs(workoutsRef);
    
    for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let needsUpdate = false;
        
        if (data.exercises) {
            Object.keys(data.exercises).forEach(exerciseKey => {
                const exerciseData = data.exercises[exerciseKey];
                if (exerciseData.sets) {
                    exerciseData.sets.forEach(set => {
                        // Check if weight is corrupted (unreasonably high)
                        if (set.weight && set.weight > 500 && set.originalWeights) {
                            console.log(`🔧 Fixing corrupted weight: ${set.weight} -> using originalWeights`);
                            
                            // Use the original kg value if available
                            if (set.originalWeights.kg && set.originalUnit === 'kg') {
                                set.weight = Math.round(set.originalWeights.kg * 2.20462);
                            } else if (set.originalWeights.lbs) {
                                set.weight = set.originalWeights.lbs;
                            }
                            
                            set.alreadyConverted = true;
                            needsUpdate = true;
                            fixedCount++;
                        }
                    });
                }
            });
        }
        
        // Update the document if we made changes
        if (needsUpdate) {
            await setDoc(doc(db, "users", state.currentUser.uid, "workouts", docSnapshot.id), data);
            console.log(`✅ Fixed corrupted weights in workout ${docSnapshot.id}`);
        }
    }
    
    console.log(`🎉 Recovery complete! Fixed ${fixedCount} corrupted weight entries.`);
    showNotification(`Recovered ${fixedCount} corrupted weights!`, 'success');
}