// Centralized app state management
export const AppState = {
  // User & Auth
  currentUser: null,
  
  // Workout Data
  currentWorkout: null,
  savedData: {},
  workoutPlans: [],
  exerciseDatabase: [],
  workoutStartTime: null,
  workoutDurationTimer: null,
  
  // UI State
  globalUnit: 'lbs',
  exerciseUnits: {},
  focusedExerciseIndex: null,
  
  // Timers
  globalRestTimer: null,
  
  // Getters
  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  },
  
  hasWorkoutProgress() {
    return Object.keys(this.savedData.exercises || {}).some(key => {
      const exercise = this.savedData.exercises[key];
      return exercise.sets && exercise.sets.some(set => set.reps || set.weight);
    });
  },
  
  // State update helpers
  reset() {
    this.currentWorkout = null;
    this.savedData = {};
    this.workoutStartTime = null;
    this.exerciseUnits = {};
    this.focusedExerciseIndex = null;
    this.clearTimers();
  },
  
  clearTimers() {
    if (this.globalRestTimer) {
      clearInterval(this.globalRestTimer.interval);
      this.globalRestTimer = null;
    }
    if (this.workoutDurationTimer) {
      clearInterval(this.workoutDurationTimer);
      this.workoutDurationTimer = null;
    }
  }
};