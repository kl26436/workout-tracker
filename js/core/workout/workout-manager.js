// Workout and Exercise Management Module
import { db, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from '../firebase-config.js';
import { showNotification } from '../ui-helpers.js';

export class WorkoutManager {
    constructor(appState) {
        this.appState = appState;
    }

    // Get all workout templates for a user
    async getUserWorkoutTemplates() {
        if (!this.appState.currentUser) return [];
        
        try {
            const templatesRef = collection(db, "users", this.appState.currentUser.uid, "workoutTemplates");
            const querySnapshot = await getDocs(templatesRef);
            
            const templates = [];
            querySnapshot.forEach((doc) => {
                templates.push({ id: doc.id, ...doc.data() });
            });
            
            return templates;
        } catch (error) {
            console.error('❌ Error loading workout templates:', error);
            return [];
        }
    }

    // Save a workout template
    async saveWorkoutTemplate(templateData) {
        if (!this.appState.currentUser) return false;
        
        try {
            const templateId = templateData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const docRef = doc(db, "users", this.appState.currentUser.uid, "workoutTemplates", templateId);
            
            await setDoc(docRef, {
                ...templateData,
                lastUpdated: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid
            });
            
            showNotification(`Workout template "${templateData.name}" saved!`, 'success');
            return true;
        } catch (error) {
            console.error('❌ Error saving workout template:', error);
            showNotification('Failed to save workout template', 'error');
            return false;
        }
    }

    // FIXED: Complete implementation of getExerciseLibrary
    async getExerciseLibrary() {
        const defaultExercises = this.appState.exerciseDatabase || [];
        
        if (!this.appState.currentUser) {
            console.log('🔍 No user signed in, returning default exercises only');
            return defaultExercises;
        }
        
        try {
            console.log(`🔄 Loading custom exercises for user: ${this.appState.currentUser.uid}`);
            const customRef = collection(db, "users", this.appState.currentUser.uid, "customExercises");
            const querySnapshot = await getDocs(customRef);
            
            const customExercises = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                customExercises.push({ 
                    id: doc.id, 
                    ...data, 
                    isCustom: true 
                });
            });
            
            console.log(`✅ Loaded ${customExercises.length} custom exercises from Firebase`);
            console.log(`📊 Total exercises: ${defaultExercises.length} default + ${customExercises.length} custom = ${defaultExercises.length + customExercises.length}`);
            
            return [...defaultExercises, ...customExercises];
        } catch (error) {
            console.error('❌ Error loading custom exercises:', error);
            showNotification('Error loading custom exercises', 'warning');
            return defaultExercises;
        }
    }

    // ADDED: Missing saveCustomExercise method
    async saveCustomExercise(exerciseData) {
        if (!this.appState.currentUser) {
            console.error('❌ No user signed in, cannot save custom exercise');
            return false;
        }
        
        try {
            // Generate a unique ID based on exercise name and timestamp
            const exerciseId = `${exerciseData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`;
            const docRef = doc(db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            
            const exerciseToSave = {
                ...exerciseData,
                createdAt: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid,
                isCustom: true
            };
            
            await setDoc(docRef, exerciseToSave);
            
            console.log(`✅ Custom exercise "${exerciseData.name}" saved to Firebase with ID: ${exerciseId}`);
            showNotification(`Custom exercise "${exerciseData.name}" saved!`, 'success');
            return true;
        } catch (error) {
            console.error('❌ Error saving custom exercise:', error);
            showNotification('Failed to save custom exercise', 'error');
            return false;
        }
    }

    // ADDED: Missing updateCustomExercise method
    async updateCustomExercise(exerciseId, exerciseData) {
        if (!this.appState.currentUser) {
            console.error('❌ No user signed in, cannot update custom exercise');
            return false;
        }
        
        try {
            const docRef = doc(db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            
            const updateData = {
                ...exerciseData,
                lastUpdated: new Date().toISOString(),
                isCustom: true
            };
            
            await setDoc(docRef, updateData, { merge: true });
            
            console.log(`✅ Custom exercise updated in Firebase: ${exerciseId}`);
            showNotification(`Exercise "${exerciseData.name}" updated!`, 'success');
            return true;
        } catch (error) {
            console.error('❌ Error updating custom exercise:', error);
            showNotification('Failed to update custom exercise', 'error');
            return false;
        }
    }

    // ADDED: Missing deleteCustomExercise method
    async deleteCustomExercise(exerciseId) {
        if (!this.appState.currentUser) {
            console.error('❌ No user signed in, cannot delete custom exercise');
            return false;
        }
        
        try {
            const docRef = doc(db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            await deleteDoc(docRef);
            
            console.log(`✅ Custom exercise deleted from Firebase: ${exerciseId}`);
            showNotification('Custom exercise deleted', 'success');
            return true;
        } catch (error) {
            console.error('❌ Error deleting custom exercise:', error);
            showNotification('Failed to delete custom exercise', 'error');
            return false;
        }
    }

    // Create a new exercise (alias for saveCustomExercise for compatibility)
    async createExercise(exerciseData) {
        return await this.saveCustomExercise(exerciseData);
    }

    // Swap an exercise in current workout
    async swapExercise(exerciseIndex, newExercise) {
        if (!this.appState.currentWorkout) return false;
        
        const oldExercise = this.appState.currentWorkout.exercises[exerciseIndex];
        
        // Update the workout
        this.appState.currentWorkout.exercises[exerciseIndex] = {
            machine: newExercise.name || newExercise.machine,
            sets: newExercise.sets || 3,
            reps: newExercise.reps || 10,
            weight: newExercise.weight || 50,
            video: newExercise.video || ''
        };
        
        showNotification(`Swapped "${oldExercise.machine}" with "${newExercise.name || newExercise.machine}"`, 'success');
        return true;
    }

    // Delete a workout template
    async deleteWorkoutTemplate(templateId) {
        if (!this.appState.currentUser) return false;
        
        try {
            const docRef = doc(db, "users", this.appState.currentUser.uid, "workoutTemplates", templateId);
            await deleteDoc(docRef);
            
            showNotification('Workout template deleted', 'success');
            return true;
        } catch (error) {
            console.error('❌ Error deleting workout template:', error);
            showNotification('Failed to delete workout template', 'error');
            return false;
        }
    }

    // Update a workout template
    async updateWorkoutTemplate(templateId, templateData) {
        if (!this.appState.currentUser) return false;
        
        try {
            const docRef = doc(db, "users", this.appState.currentUser.uid, "workoutTemplates", templateId);
            
            await setDoc(docRef, {
                ...templateData,
                lastUpdated: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid
            }, { merge: true });
            
            showNotification(`Template "${templateData.name}" updated!`, 'success');
            return true;
        } catch (error) {
            console.error('❌ Error updating workout template:', error);
            showNotification('Failed to update workout template', 'error');
            return false;
        }
    }
}

