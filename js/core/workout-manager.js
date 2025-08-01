// Workout and Exercise Management Module
import { db, doc, setDoc, getDoc, collection, getDocs } from '../core/firebase-config.js';
import { showNotification } from '../core/ui-helpers.js';

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

    // Get exercise library (combines default + custom)
    async getExerciseLibrary() {
        const defaultExercises = this.appState.exerciseDatabase || [];
        
        if (!this.appState.currentUser) return defaultExercises;
        
        try {
            const customRef = collection(db, "users", this.appState.currentUser.uid, "customExercises");
            const querySnapshot = await getDocs(customRef);
            
            const customExercises = [];
            querySnapshot.forEach((doc) => {
                customExercises.push({ id: doc.id, ...doc.data(), isCustom: true });
            });
            
            return [...defaultExercises, ...customExercises];
        } catch (error) {
            console.error('❌ Error loading custom exercises:', error);
            return defaultExercises;
        }
    }

    // Create a new exercise
    async createExercise(exerciseData) {
        if (!this.appState.currentUser) return false;
        
        try {
            const exerciseId = exerciseData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const docRef = doc(db, "users", this.appState.currentUser.uid, "customExercises", exerciseId);
            
            await setDoc(docRef, {
                ...exerciseData,
                createdAt: new Date().toISOString(),
                createdBy: this.appState.currentUser.uid
            });
            
            showNotification(`Exercise "${exerciseData.name}" created!`, 'success');
            return true;
        } catch (error) {
            console.error('❌ Error creating exercise:', error);
            showNotification('Failed to create exercise', 'error');
            return false;
        }
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
        
        // Clear any existing data for this exercise since it's different now
        if (this.appState.savedData.exercises && this.appState.savedData.exercises[`exercise_${exerciseIndex}`]) {
            this.appState.savedData.exercises[`exercise_${exerciseIndex}`] = { sets: [], notes: '' };
        }
        
        showNotification(`Swapped "${oldExercise.machine}" → "${newExercise.name || newExercise.machine}"`, 'success');
        return true;
    }

    // Generate workout template from current workout
    generateTemplateFromCurrent() {
        if (!this.appState.currentWorkout) return null;
        
        return {
            name: this.appState.savedData.workoutType,
            exercises: this.appState.currentWorkout.exercises.map(exercise => ({
                name: exercise.machine,
                sets: exercise.sets,
                reps: exercise.reps,
                weight: exercise.weight,
                video: exercise.video || ''
            })),
            category: this.getWorkoutCategory(this.appState.savedData.workoutType)
        };
    }

    // Helper to categorize workouts
    getWorkoutCategory(workoutName) {
        const name = workoutName.toLowerCase();
        if (name.includes('chest') || name.includes('push')) return 'Push';
        if (name.includes('back') || name.includes('pull')) return 'Pull';
        if (name.includes('legs')) return 'Legs';
        if (name.includes('cardio') || name.includes('core')) return 'Cardio';
        return 'Other';
    }

    // Search exercises by criteria
    searchExercises(exercises, query, filters = {}) {
        const searchQuery = query.toLowerCase();
        
        return exercises.filter(exercise => {
            // Text search
            const matchesSearch = !searchQuery || 
                exercise.name?.toLowerCase().includes(searchQuery) ||
                exercise.machine?.toLowerCase().includes(searchQuery) ||
                exercise.bodyPart?.toLowerCase().includes(searchQuery) ||
                exercise.equipmentType?.toLowerCase().includes(searchQuery) ||
                (exercise.tags && exercise.tags.some(tag => tag.toLowerCase().includes(searchQuery)));
            
            // Filter by body part
            const matchesBodyPart = !filters.bodyPart || 
                exercise.bodyPart?.toLowerCase() === filters.bodyPart.toLowerCase();
            
            // Filter by equipment
            const matchesEquipment = !filters.equipment || 
                exercise.equipmentType?.toLowerCase() === filters.equipment.toLowerCase();
            
            return matchesSearch && matchesBodyPart && matchesEquipment;
        });
    }
}