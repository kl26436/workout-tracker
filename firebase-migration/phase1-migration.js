// Fixed Phase 1 Migration Script - firebase-migration/phase1-migration.js
// Run this ONCE to migrate your current data

// FIXED: Correct import path from firebase-migration/ to js/core/
import { 
    db, doc, setDoc, getDoc, collection
} from '../js/core/firebase-config.js';

// Import writeBatch directly from Firebase CDN
import { writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class Phase1Migration {
    constructor() {
        this.db = db;
    }

    // Step 1: Backup current data
    async createBackups() {
        console.log('📁 Creating backups...');
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        
        try {
            // Load current data - adjust paths since we're in firebase-migration/
            const [exerciseResponse, workoutResponse] = await Promise.all([
                fetch('../exercises.json'),  // Go up one level to root
                fetch('../workouts.json')    // Go up one level to root
            ]);
            
            const exercises = await exerciseResponse.json();
            const workouts = await workoutResponse.json();
            
            // Create downloadable backups
            this.downloadJSON(exercises, `exercises-backup-${timestamp}.json`);
            this.downloadJSON(workouts, `workouts-backup-${timestamp}.json`);
            
            console.log('✅ Backups created and downloaded');
            return { exercises, workouts };
            
        } catch (error) {
            console.error('❌ Error creating backups:', error);
            throw error;
        }
    }

    // Step 2: FIXED - Migrate exercises to ROOT collection (not nested)
    async migrateExercises(exercises) {
        console.log('🔄 Migrating exercises to Firebase (CORRECTED PATH)...');
        
        try {
            const batch = writeBatch(this.db);
            let migratedCount = 0;
            
            for (const exercise of exercises) {
                const exerciseId = this.generateExerciseId(exercise.name || exercise.machine || 'unknown');
                
                // FIXED: Save to root exercises collection
                const docRef = doc(this.db, 'exercises', exerciseId);
                
                const exerciseData = {
                    ...exercise,
                    id: exerciseId,
                    isDefault: true,
                    isCustom: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    // Ensure required fields exist
                    name: exercise.name || exercise.machine || 'Unknown Exercise',
                    machine: exercise.machine || exercise.name || 'Unknown Exercise',
                    bodyPart: exercise.bodyPart || 'other',
                    equipmentType: exercise.equipmentType || 'other',
                    sets: exercise.sets || 3,
                    reps: exercise.reps || 10,
                    weight: exercise.weight || 50,
                    video: exercise.video || ''
                };
                
                console.log(`➕ Adding exercise: ${exerciseData.name} (ID: ${exerciseId})`);
                batch.set(docRef, exerciseData);
                migratedCount++;
                
                // Firebase has a 500 operation limit per batch
                if (migratedCount % 400 === 0) {
                    await batch.commit();
                    console.log(`📦 Committed batch of ${migratedCount} exercises`);
                    // Create new batch for remaining items
                    const newBatch = writeBatch(this.db);
                    batch = newBatch;
                }
            }
            
            // Commit any remaining operations
            if (migratedCount % 400 !== 0) {
                await batch.commit();
            }
            
            // Set migration metadata in 'default' document
            await setDoc(doc(this.db, 'exercises', 'default'), {
                lastUpdated: new Date().toISOString(),
                exerciseCount: migratedCount,
                migratedFrom: 'exercises.json',
                migrationVersion: '2.0',
                note: 'Metadata document - actual exercises are separate docs in this collection'
            });
            
            console.log(`✅ Migrated ${migratedCount} exercises to Firebase`);
            return migratedCount;
            
        } catch (error) {
            console.error('❌ Error migrating exercises:', error);
            throw error;
        }
    }

    // Step 3: Migrate workouts to Firebase  
    async migrateWorkouts(workouts) {
        console.log('🔄 Migrating workouts to Firebase...');
        
        try {
            const batch = writeBatch(this.db);
            let migratedCount = 0;
            
            for (const workout of workouts) {
                const workoutId = this.generateWorkoutId(workout.name || workout.day || 'unknown');
                
                // Save to root workouts collection
                const docRef = doc(this.db, 'workouts', workoutId);
                
                const workoutData = {
                    ...workout,
                    id: workoutId,
                    isDefault: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    // Ensure required fields
                    name: workout.name || workout.day || 'Unknown Workout',
                    day: workout.day || workout.name || 'General',
                    category: workout.category || this.getWorkoutCategory(workout.day || workout.name),
                    exercises: workout.exercises || []
                };
                
                console.log(`➕ Adding workout: ${workoutData.name} (ID: ${workoutId})`);
                batch.set(docRef, workoutData);
                migratedCount++;
                
                if (migratedCount % 400 === 0) {
                    await batch.commit();
                    console.log(`📦 Committed batch of ${migratedCount} workouts`);
                    const newBatch = writeBatch(this.db);
                    batch = newBatch;
                }
            }
            
            // Commit any remaining operations
            if (migratedCount % 400 !== 0) {
                await batch.commit();
            }
            
            // Set migration metadata
            await setDoc(doc(this.db, 'workouts', 'default'), {
                lastUpdated: new Date().toISOString(),
                templateCount: migratedCount,
                migratedFrom: 'workouts.json',
                migrationVersion: '2.0',
                note: 'Metadata document - actual workouts are separate docs in this collection'
            });
            
            console.log(`✅ Migrated ${migratedCount} workouts to Firebase`);
            return migratedCount;
            
        } catch (error) {
            console.error('❌ Error migrating workouts:', error);
            throw error;
        }
    }

    // Helper to determine workout category
    getWorkoutCategory(day) {
        if (!day) return 'general';
        const dayLower = day.toLowerCase();
        if (dayLower.includes('chest') || dayLower.includes('push')) return 'push';
        if (dayLower.includes('back') || dayLower.includes('pull')) return 'pull';
        if (dayLower.includes('leg') || dayLower.includes('lower')) return 'legs';
        if (dayLower.includes('shoulder') || dayLower.includes('arm')) return 'push';
        if (dayLower.includes('cardio') || dayLower.includes('hiit')) return 'cardio';
        return 'general';
    }

    // Step 4: Set migration flag
    async setMigrationFlag() {
        try {
            // Store migration flag in user's own document instead of admin collection
            if (this.db && window.AppState?.currentUser) {
                await setDoc(doc(this.db, 'users', window.AppState.currentUser.uid, 'migration', 'phase1'), {
                    phase1MigrationCompleted: true,
                    migrationDate: new Date().toISOString(),
                    version: '2.0',
                    dataSource: 'firebase',
                    exercisesPath: 'exercises/{exerciseId}',
                    workoutsPath: 'workouts/{workoutId}'
                });
                
                console.log('✅ Migration flag set in user document');
            } else {
                console.log('⚠️ Could not set migration flag - storing in localStorage as backup');
                localStorage.setItem('phase1MigrationCompleted', JSON.stringify({
                    completed: true,
                    date: new Date().toISOString(),
                    version: '2.0'
                }));
            }
            
        } catch (error) {
            console.warn('⚠️ Could not set migration flag in Firebase, using localStorage:', error.message);
            localStorage.setItem('phase1MigrationCompleted', JSON.stringify({
                completed: true,
                date: new Date().toISOString(),
                version: '2.0'
            }));
        }
    }

    // Helper: Generate consistent exercise ID
    generateExerciseId(name) {
        if (!name || typeof name !== 'string') {
            console.warn('⚠️ Invalid exercise name:', name, 'using fallback');
            name = 'unknown_exercise_' + Date.now();
        }
        
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50); // Firebase document ID limit
    }

    // Helper: Generate consistent workout ID
    generateWorkoutId(name) {
        if (!name || typeof name !== 'string') {
            console.warn('⚠️ Invalid workout name:', name, 'using fallback');
            name = 'unknown_workout_' + Date.now();
        }
        
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
    }

    // Helper: Download JSON file
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Main migration function
    async runMigration() {
        try {
            console.log('🚀 Starting Phase 1 Migration (FIXED VERSION)...');
            
            // Check if user is signed in - try both AppState and direct auth check
            let currentUser = window.AppState?.currentUser;
            
            if (!currentUser) {
                // Try to get from Firebase auth directly
                const { auth } = await import('../js/core/firebase-config.js');
                currentUser = auth.currentUser;
            }
            
            if (!currentUser) {
                throw new Error('Please sign in to your workout tracker before running the migration');
            }
            
            console.log(`👤 Running migration for user: ${currentUser.email || currentUser.uid}`);
            
            // Step 1: Create backups
            const { exercises, workouts } = await this.createBackups();
            
            // Step 2: Migrate exercises to ROOT collection
            const exerciseCount = await this.migrateExercises(exercises);
            
            // Step 3: Migrate workouts to ROOT collection
            const workoutCount = await this.migrateWorkouts(workouts);
            
            // Step 4: Set migration flag
            await this.setMigrationFlag();
            
            console.log('🎉 Phase 1 Migration completed successfully!');
            console.log(`📊 Summary: ${exerciseCount} exercises, ${workoutCount} workouts`);
            console.log('📍 Data saved to ROOT collections (exercises/ and workouts/)');
            
            // Show success message to user
            if (typeof alert !== 'undefined') {
                alert(`Migration completed successfully!\n\nMigrated:\n- ${exerciseCount} exercises to exercises/ collection\n- ${workoutCount} workouts to workouts/ collection\n\nBackup files have been downloaded for safety.\n\nYour app should now load default exercises correctly!`);
            }
            
            return {
                success: true,
                exerciseCount,
                workoutCount,
                version: '2.0'
            };
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            
            if (typeof alert !== 'undefined') {
                alert(`Migration failed: ${error.message}\n\nPlease check the console for details.`);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Check if migration has been completed
    async checkMigrationStatus() {
        try {
            // Try to check user's migration document first
            if (this.db && window.AppState?.currentUser) {
                const migrationDoc = await getDoc(doc(this.db, 'users', window.AppState.currentUser.uid, 'migration', 'phase1'));
                
                if (migrationDoc.exists()) {
                    const data = migrationDoc.data();
                    return {
                        completed: data.phase1MigrationCompleted || false,
                        date: data.migrationDate,
                        version: data.version || '1.0'
                    };
                }
            }
            
            // Check if exercises exist in root collection
            try {
                const exercisesRef = collection(this.db, 'exercises');
                const exercisesSnapshot = await getDocs(exercisesRef);
                const actualExercises = exercisesSnapshot.docs.filter(doc => doc.id !== 'default');
                
                if (actualExercises.length > 0) {
                    return {
                        completed: true,
                        date: 'Unknown',
                        version: 'Detected from data',
                        exerciseCount: actualExercises.length
                    };
                }
            } catch (error) {
                console.warn('Could not check exercise collection:', error);
            }
            
            // Fallback: check localStorage
            const localStatus = localStorage.getItem('phase1MigrationCompleted');
            if (localStatus) {
                const data = JSON.parse(localStatus);
                return {
                    completed: data.completed || false,
                    date: data.date,
                    version: data.version || '1.0'
                };
            }
            
            return { completed: false };
            
        } catch (error) {
            console.warn('⚠️ Error checking migration status, assuming not completed:', error.message);
            return { completed: false, error: error.message };
        }
    }

    // NEW: Test function to verify current state
    async testCurrentState() {
        try {
            console.log('🔍 Testing current Firebase state...');
            
            // Check exercises
            const exercisesRef = collection(this.db, 'exercises');
            const exercisesSnapshot = await getDocs(exercisesRef);
            const exercises = exercisesSnapshot.docs.filter(doc => doc.id !== 'default');
            
            console.log(`📚 Found ${exercises.length} exercises in root collection`);
            
            // Check workouts
            const workoutsRef = collection(this.db, 'workouts');
            const workoutsSnapshot = await getDocs(workoutsRef);
            const workouts = workoutsSnapshot.docs.filter(doc => doc.id !== 'default');
            
            console.log(`💪 Found ${workouts.length} workouts in root collection`);
            
            return {
                exerciseCount: exercises.length,
                workoutCount: workouts.length,
                needsMigration: exercises.length === 0
            };
            
        } catch (error) {
            console.error('❌ Error testing current state:', error);
            return { error: error.message };
        }
    }
}

// Make functions available globally for HTML buttons
if (typeof window !== 'undefined') {
    window.Phase1Migration = Phase1Migration;
    
    // Helper functions for HTML interface
    window.runPhase1Migration = async function() {
        const migration = new Phase1Migration();
        return await migration.runMigration();
    };
    
    window.checkMigrationStatus = async function() {
        const migration = new Phase1Migration();
        return await migration.checkMigrationStatus();
    };
    
    window.testCurrentState = async function() {
        const migration = new Phase1Migration();
        return await migration.testCurrentState();
    };
    
    console.log('📦 Phase 1 Migration script loaded (FIXED VERSION)');
    console.log('💡 Run migration with: runPhase1Migration()');
    console.log('💡 Check status with: checkMigrationStatus()');
    console.log('💡 Test current state with: testCurrentState()');
}