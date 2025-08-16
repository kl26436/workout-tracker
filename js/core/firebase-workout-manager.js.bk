// Updated Firebase Workout Manager - js/core/firebase-workout-manager.js
// COMPLETE FILE - REPLACE YOUR ENTIRE firebase-workout-manager.js WITH THIS

import { 
    db, doc, setDoc, getDoc, deleteDoc, collection, query, where, 
    getDocs, orderBy, limit, onSnapshot 
} from './firebase-config.js';
import { writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showNotification } from './ui-helpers.js';

export class FirebaseWorkoutManager {
    constructor(appState) {
        this.appState = appState;
        this.db = db;
        this.exerciseListeners = new Set();
        this.workoutListeners = new Set();
    }

    // ===== EXERCISE MANAGEMENT =====

    // Get all exercises (migrated default + user custom)
    async getExerciseLibrary() {
        try {
            console.log('🔄 Loading exercise library from Firebase...');
            
            // ALWAYS try to load default exercises first (no auth required for public data)
            const defaultExercises = await this.getMigratedDefaultExercises();
            console.log(`📚 Loaded ${defaultExercises.length} default exercises`);
            
            // Load user's custom exercises (requires auth)
            let customExercises = [];
            if (this.appState.currentUser) {
                try {
                    customExercises = await this.getCustomExercises();
                    console.log(`👤 Loaded ${customExercises.length} custom exercises for user`);
                } catch (customError) {
                    console.warn('⚠️ Failed to load custom exercises:', customError);
                    // Continue with just default exercises
                }
            } else {
                console.log('⚠️ No user signed in, using default exercises only');
            }

            const totalExercises = [...defaultExercises, ...customExercises];
            
            // If we have no default exercises, this is a critical error
            if (defaultExercises.length === 0) {
                console.error('❌ CRITICAL: No default exercises loaded from Firebase!');
                console.log('🔄 Attempting JSON fallback...');
                
                const fallbackExercises = await this.fallbackToJSON();
                if (fallbackExercises.length > 0) {
                    console.log(`✅ Fallback successful: loaded ${fallbackExercises.length} exercises from JSON`);
                    return [...fallbackExercises, ...customExercises];
                } else {
                    console.error('❌ Even JSON fallback failed!');
                    return customExercises; // Return at least custom exercises if available
                }
            }
            
            console.log(`✅ Final library: ${defaultExercises.length} default + ${customExercises.length} custom = ${totalExercises.length} total`);
            return totalExercises;
            
        } catch (error) {
            console.error('❌ Complete failure in getExerciseLibrary:', error);
            
            // Try to at least get custom exercises if user is signed in
            if (this.appState.currentUser) {
                try {
                    const customExercises = await this.getCustomExercises();
                    console.log(`⚠️ Returning ${customExercises.length} custom exercises only`);
                    return customExercises;
                } catch (customError) {
                    console.error('❌ Even custom exercises failed:', customError);
                }
            }
            
            // Last resort: JSON fallback
            return await this.fallbackToJSON();
        }
    }

    // Get migrated default exercises from Firebase (ROOT LEVEL)
    async getMigratedDefaultExercises() {
        try {
            console.log('🔍 Loading exercises from root exercises collection...');
            const exercisesRef = collection(this.db, 'exercises');
            
            const querySnapshot = await getDocs(exercisesRef);
            console.log(`📊 Firebase query returned ${querySnapshot.size} documents`);
            
            const exercises = [];
            querySnapshot.forEach((doc) => {
                // Skip the 'default' metadata document
                if (doc.id === 'default') {
                    console.log('⏭️ Skipping metadata document: default');
                    return;
                }
                
                const data = doc.data();
                
                // Validate that this is actually an exercise document
                if (!data.name && !data.machine) {
                    console.log(`⏭️ Skipping invalid exercise document: ${doc.id}`, data);
                    return;
                }
                
                exercises.push({ 
                    id: doc.id, 
                    ...data,
                    isDefault: true,
                    isCustom: false
                });
            });
            
            console.log(`✅ Successfully loaded ${exercises.length} valid exercises from root collection`);
            
            // Debug: Log first few exercise names
            if (exercises.length > 0) {
                exercises.slice(0, 5).forEach(ex => {
                    console.log(`  - ${ex.name || ex.machine || 'Unknown'} (${ex.bodyPart || 'Unknown'})`);
                });
            } else {
                console.error('❌ No valid exercises found in Firebase!');
            }
            
            return exercises;
            
        } catch (error) {
            console.error('❌ Error loading exercises from root collection:', error);
            console.error('Error details:', error.message);
            console.error('Error code:', error.code);
            
            // Return empty array instead of throwing
            return [];
        }
    }

    // Get user's custom exercises
    async getCustomExercises() {
        if (!this.appState.currentUser) {
            return [];
        }
        
        try {
            const customRef = collection(this.db, "users", this.appState.currentUser.uid, "customExercises");
            const querySnapshot = await getDocs(customRef);
            
            const customExercises = [];
            querySnapshot.forEach((doc) => {
                customExercises.push({ 
                    id: doc.id, 
                    ...doc.data(), 
                    isCustom: true,
                    isDefault: false
                });
            });
            
            return customExercises;
            
        } catch (error) {
            console.error('❌ Error loading custom exercises:', error);
            return [];
        }
    }

    // ===== WORKOUT TEMPLATE MANAGEMENT (FIXED) =====

    // Get ONLY migrated default workout templates from Firebase ROOT level
    async getMigratedDefaultWorkouts() {
        try {
            console.log('🔍 Loading DEFAULT templates from root workouts collection...');
            const workoutsRef = collection(this.db, 'workouts');
            const querySnapshot = await getDocs(workoutsRef);
            
            const templates = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                templates.push({ 
                    id: doc.id, 
                    ...data,
                    isDefault: true,
                    isCustom: false,
                    source: 'firebase-default'
                });
            });
            
            console.log(`✅ Found ${templates.length} DEFAULT templates in root collection`);
            return templates;
            
        } catch (error) {
            console.error('❌ Error loading default templates from root collection:', error);
            return [];
        }
    }

    // Get ONLY user's custom workout templates
    async getCustomWorkoutTemplates() {
        if (!this.appState.currentUser) {
            console.log('❌ No user signed in for custom templates');
            return [];
        }
        
        try {
            console.log('🔍 Loading CUSTOM templates from user collection...');
            const customRef = collection(this.db, "users", this.appState.currentUser.uid, "workoutTemplates");
            const querySnapshot = await getDocs(customRef);
            
            const templates = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                templates.push({ 
                    id: doc.id, 
                    ...data, 
                    isCustom: true,
                    isDefault: false,
                    source: 'firebase-custom',
                    userId: this.appState.currentUser.uid
                });
            });
            
            console.log(`✅ Found ${templates.length} CUSTOM templates for user`);
            return templates;
            
        } catch (error) {
            console.error('❌ Error loading custom workout templates:', error);
            return [];
        }
    }

    // Load templates by specific category (FIXED - no more mixing!)
    async getTemplatesByCategory(category) {
        try {
            console.log(`🔄 Loading templates for category: ${category}`);
            
            if (category === 'default') {
                return await this.getMigratedDefaultWorkouts();
            } else if (category === 'custom') {
                return await this.getCustomWorkoutTemplates();
            } else {
                console.error(`❌ Unknown template category: ${category}`);
                return [];
            }
            
        } catch (error) {
            console.error(`❌ Error loading ${category} templates:`, error);
            return [];
        }
    }

    // Get all workout templates (when needed for compatibility)
    async getWorkoutTemplates() {
        try {
            console.log('🔄 Loading ALL workout templates from Firebase...');
            
            // Load default templates from root
            const defaultTemplates = await this.getMigratedDefaultWorkouts();
            
            // Load user's custom templates if signed in
            let customTemplates = [];
            if (this.appState.currentUser) {
                customTemplates = await this.getCustomWorkoutTemplates();
            }

            const totalTemplates = [...defaultTemplates, ...customTemplates];
            
            console.log(`✅ Loaded ${defaultTemplates.length} default + ${customTemplates.length} custom = ${totalTemplates.length} total templates`);
            
            return totalTemplates;
            
        } catch (error) {
            console.error('❌ Error loading workout templates:', error);
            return await this.fallbackWorkoutsToJSON();
        }
    }

    // Copy a default template to user's custom templates
    async copyDefaultToCustom(defaultTemplateId) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to copy templates');
        }
        
        try {
            console.log(`🔄 Copying default template to custom: ${defaultTemplateId}`);
            
            // Get the default template from root collection
            const defaultDocRef = doc(this.db, "workouts", defaultTemplateId);
            const defaultDoc = await getDoc(defaultDocRef);
            
            if (!defaultDoc.exists()) {
                throw new Error('Default template not found');
            }
            
            const defaultData = defaultDoc.data();
            
            // Create custom copy in user's collection
            const customTemplateId = `${defaultData.name}_copy_${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const customDocRef = doc(this.db, "users", this.appState.currentUser.uid, "workoutTemplates", customTemplateId);
            
            const customTemplate = {
                ...defaultData,
                id: customTemplateId,
                name: `${defaultData.name} (Custom)`,
                lastUpdated: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid,
                isCustom: true,
                isDefault: false,
                source: 'firebase-custom',
                copiedFrom: defaultTemplateId
            };
            
            await setDoc(customDocRef, customTemplate);
            
            console.log(`✅ Copied "${defaultData.name}" to custom templates`);
            showNotification(`Copied "${defaultData.name}" to your custom templates!`, 'success');
            
            return customTemplateId;
            
        } catch (error) {
            console.error('❌ Error copying template:', error);
            showNotification('Failed to copy template', 'error');
            throw error;
        }
    }

    // Update a default template (affects all users)
    async updateDefaultWorkoutTemplate(templateId, templateData) {
        try {
            console.log(`🔄 Updating DEFAULT template: ${templateId}`);
            
            const docRef = doc(this.db, "workouts", templateId);
            
            const templateToSave = {
                ...templateData,
                id: templateId,
                lastUpdated: new Date().toISOString(),
                isDefault: true,
                isCustom: false,
                source: 'firebase-default'
            };
            
            await setDoc(docRef, templateToSave, { merge: true });
            
            console.log(`✅ Default template "${templateData.name}" updated`);
            showNotification(`Default template "${templateData.name}" updated globally!`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error updating default template:', error);
            showNotification('Failed to update default template', 'error');
            throw error;
        }
    }

    // Save a new custom template (only to user's collection)
    async saveWorkoutTemplate(templateData) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to save workout templates');
        }
        
        try {
            const templateId = templateData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now();
            const docRef = doc(this.db, "users", this.appState.currentUser.uid, "workoutTemplates", templateId);
            
            const templateToSave = {
                ...templateData,
                id: templateId,
                lastUpdated: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid,
                isCustom: true,
                isDefault: false,
                source: 'firebase-custom'
            };
            
            await setDoc(docRef, templateToSave);
            
            console.log(`✅ Custom workout template "${templateData.name}" saved`);
            showNotification(`Custom template "${templateData.name}" saved!`, 'success');
            
            return templateId;
            
        } catch (error) {
            console.error('❌ Error saving custom workout template:', error);
            showNotification('Failed to save custom template', 'error');
            throw error;
        }
    }

    // Delete custom template (only user's templates can be deleted)
    async deleteWorkoutTemplate(templateId) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to delete workout templates');
        }
        
        try {
            console.log(`🗑️ Deleting CUSTOM workout template: ${templateId}`);
            
            // Delete from user's custom templates collection
            const docRef = doc(this.db, "users", this.appState.currentUser.uid, "workoutTemplates", templateId);
            await deleteDoc(docRef);
            
            console.log(`✅ Custom workout template "${templateId}" deleted from Firebase`);
            showNotification('Custom workout template deleted successfully', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error deleting custom workout template:', error);
            showNotification('Failed to delete custom template', 'error');
            throw error;
        }
    }

    // ===== CUSTOM EXERCISE MANAGEMENT =====

    async saveCustomExercise(exerciseData) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to save custom exercises');
        }
        
        try {
            const exerciseId = `${exerciseData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`;
            const docRef = doc(this.db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            
            const exerciseToSave = {
                ...exerciseData,
                id: exerciseId,
                createdAt: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid,
                isCustom: true,
                isDefault: false
            };
            
            await setDoc(docRef, exerciseToSave);
            
            console.log(`✅ Custom exercise "${exerciseData.name}" saved`);
            showNotification(`Custom exercise "${exerciseData.name}" saved!`, 'success');
            
            return exerciseId;
            
        } catch (error) {
            console.error('❌ Error saving custom exercise:', error);
            showNotification('Failed to save custom exercise', 'error');
            throw error;
        }
    }

    async updateCustomExercise(exerciseId, exerciseData) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to update custom exercises');
        }
        
        try {
            const docRef = doc(this.db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            
            const updateData = {
                ...exerciseData,
                lastUpdated: new Date().toISOString(),
                isCustom: true
            };
            
            await setDoc(docRef, updateData, { merge: true });
            
            console.log(`✅ Custom exercise updated: ${exerciseId}`);
            showNotification(`Exercise "${exerciseData.name}" updated!`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error updating custom exercise:', error);
            showNotification('Failed to update custom exercise', 'error');
            throw error;
        }
    }

    async deleteCustomExercise(exerciseId) {
        if (!this.appState.currentUser) {
            throw new Error('User must be signed in to delete custom exercises');
        }
        
        try {
            const docRef = doc(this.db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            await deleteDoc(docRef);
            
            console.log(`✅ Custom exercise deleted: ${exerciseId}`);
            showNotification('Custom exercise deleted', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error deleting custom exercise:', error);
            showNotification('Failed to delete custom exercise', 'error');
            throw error;
        }
    }

    // Update migrated default exercise (admin function)
    async updateDefaultExercise(exerciseId, exerciseData) {
        try {
            console.log(`🔄 Updating default exercise: ${exerciseId}`);
            
            if (!this.appState.currentUser) {
                throw new Error('User must be signed in to update exercises');
            }
            
            // Update in root exercises collection
            const docRef = doc(this.db, 'exercises', exerciseId);
            
            const updateData = {
                ...exerciseData,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: this.appState.currentUser?.email || 'system'
            };

            await setDoc(docRef, updateData, { merge: true });
            
            // Update all workouts that use this exercise
            const updatedWorkouts = await this.updateWorkoutsWithExerciseChanges(exerciseId, exerciseData);
            
            console.log(`✅ Updated default exercise and ${updatedWorkouts} workouts`);
            showNotification(`Updated "${exerciseData.name}" and ${updatedWorkouts} workout(s)`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error updating default exercise:', error);
            showNotification(`Failed to update exercise: ${error.message}`, 'error');
            throw error;
        }
    }

    // Update workouts that reference a changed exercise
    async updateWorkoutsWithExerciseChanges(exerciseId, newExerciseData) {
        try {
            console.log(`🔄 Updating workouts that use exercise: ${exerciseId}`);
            
            // Update both default and custom templates
            const batch = writeBatch(this.db);
            let updatedCount = 0;
            
            // Update default templates in root collection
            const defaultWorkoutsRef = collection(this.db, 'workouts');
            const defaultSnapshot = await getDocs(defaultWorkoutsRef);
            
            defaultSnapshot.forEach((doc) => {
                const workout = doc.data();
                let needsUpdate = false;
                
                if (workout.exercises && Array.isArray(workout.exercises)) {
                    workout.exercises.forEach(exercise => {
                        if (exercise.machine === exerciseId || 
                            exercise.name === exerciseId ||
                            exercise.machine === newExerciseData.name ||
                            exercise.machine === newExerciseData.machine) {
                            
                            exercise.machine = newExerciseData.name;
                            exercise.name = newExerciseData.name;
                            
                            if (newExerciseData.video) {
                                exercise.video = newExerciseData.video;
                            }
                            
                            needsUpdate = true;
                        }
                    });
                }
                
                if (needsUpdate) {
                    batch.update(doc.ref, {
                        exercises: workout.exercises,
                        updatedAt: new Date().toISOString()
                    });
                    updatedCount++;
                }
            });
            
            // Update custom templates if user is signed in
            if (this.appState.currentUser) {
                const customWorkoutsRef = collection(this.db, 'users', this.appState.currentUser.uid, 'workoutTemplates');
                const customSnapshot = await getDocs(customWorkoutsRef);
                
                customSnapshot.forEach((doc) => {
                    const workout = doc.data();
                    let needsUpdate = false;
                    
                    if (workout.exercises && Array.isArray(workout.exercises)) {
                        workout.exercises.forEach(exercise => {
                            if (exercise.machine === exerciseId || 
                                exercise.name === exerciseId ||
                                exercise.machine === newExerciseData.name ||
                                exercise.machine === newExerciseData.machine) {
                                
                                exercise.machine = newExerciseData.name;
                                exercise.name = newExerciseData.name;
                                
                                if (newExerciseData.video) {
                                    exercise.video = newExerciseData.video;
                                }
                                
                                needsUpdate = true;
                            }
                        });
                    }
                    
                    if (needsUpdate) {
                        batch.update(doc.ref, {
                            exercises: workout.exercises,
                            updatedAt: new Date().toISOString()
                        });
                        updatedCount++;
                    }
                });
            }
            
            if (updatedCount > 0) {
                await batch.commit();
                console.log(`✅ Updated ${updatedCount} workout templates`);
            }
            
            return updatedCount;
            
        } catch (error) {
            console.error('❌ Error updating workouts:', error);
            throw error;
        }
    }

    // ===== UTILITY METHODS =====

    // Fallback to JSON files if Firebase fails
    async fallbackToJSON() {
        try {
            console.log('⚠️ Falling back to JSON files...');
            const response = await fetch('./exercises.json');
            const exercises = await response.json();
            return exercises.map(ex => ({ ...ex, isDefault: true, isCustom: false }));
        } catch (error) {
            console.error('❌ JSON fallback also failed:', error);
            return [];
        }
    }

    async fallbackWorkoutsToJSON() {
        try {
            console.log('⚠️ Falling back to workout JSON files...');
            const response = await fetch('./workouts.json');
            const workouts = await response.json();
            return workouts.map(w => ({ ...w, isDefault: true }));
        } catch (error) {
            console.error('❌ Workout JSON fallback also failed:', error);
            return [];
        }
    }

    // Clean up listeners
    cleanup() {
        this.exerciseListeners.forEach(unsubscribe => unsubscribe());
        this.workoutListeners.forEach(unsubscribe => unsubscribe());
        this.exerciseListeners.clear();
        this.workoutListeners.clear();
    }
}

// Legacy compatibility - keep existing method names
export class WorkoutManager extends FirebaseWorkoutManager {
    // Maintain compatibility with existing code
    async getExerciseLibrary() {
        return await super.getExerciseLibrary();
    }

    async createExercise(exerciseData) {
        return await this.saveCustomExercise(exerciseData);
    }

    // Legacy method - now points to category-specific loading
    async getUserWorkoutTemplates() {
        console.warn('⚠️ getUserWorkoutTemplates is deprecated. Use getTemplatesByCategory() instead.');
        return await super.getWorkoutTemplates();
    }

    // Add other legacy methods
    async saveWorkoutTemplate(templateData) {
        return await super.saveWorkoutTemplate(templateData);
    }
   
    async deleteWorkoutTemplate(templateId) {
        return await super.deleteWorkoutTemplate(templateId);
    }

    // Add the new category-specific method to legacy class
    async getTemplatesByCategory(category) {
        return await super.getTemplatesByCategory(category);
    }

    async copyDefaultToCustom(templateId) {
        return await super.copyDefaultToCustom(templateId);
    }
}

// Export both for flexibility
export default FirebaseWorkoutManager;