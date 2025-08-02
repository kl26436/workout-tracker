// CREATE NEW FILE: js/core/exercise-library.js
// This will centralize ALL exercise library functionality

import { showNotification } from './ui-helpers.js';
import { WorkoutManager } from './workout/workout-manager.js';

export class ExerciseLibrary {
    constructor(appState) {
        this.appState = appState;
        this.currentLibrary = [];
        this.filteredExercises = [];
        this.context = null; // 'template', 'swap', or null
        this.modal = null;
        this.isOpen = false;
    }

    // Initialize the library
    initialize() {
        this.modal = document.getElementById('exercise-library-modal');
        this.setupEventListeners();
    }

    // Set up event listeners for the modal
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('exercise-library-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
            searchInput.addEventListener('keyup', () => this.applyFilters());
        }

        // Filter dropdowns
        const bodyPartFilter = document.getElementById('body-part-filter');
        const equipmentFilter = document.getElementById('equipment-filter');
        
        if (bodyPartFilter) {
            bodyPartFilter.addEventListener('change', () => this.applyFilters());
        }
        if (equipmentFilter) {
            equipmentFilter.addEventListener('change', () => this.applyFilters());
        }

        // Close button
        const closeBtn = this.modal?.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Modal backdrop click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target.id === 'exercise-library-modal') {
                    this.close();
                }
            });
        }
    }

    // Open library for template editing
    async openForTemplate(templateContext) {
        this.context = 'template';
        this.appState.addingToTemplate = true;
        this.appState.templateEditingContext = templateContext;
        
        await this.loadAndShow('Add Exercise to Template');
    }

    // Open library for exercise swapping
    async openForSwap(exerciseIndex) {
        this.context = 'swap';
        this.appState.swappingExerciseIndex = exerciseIndex;
        
        const exerciseName = this.appState.currentWorkout?.exercises[exerciseIndex]?.machine || 'Exercise';
        await this.loadAndShow(`Swap Exercise: ${exerciseName}`);
    }

    // Load exercises and show modal
    async loadAndShow(title) {
        if (!this.modal) {
            console.error('Exercise library modal not found');
            return;
        }

        // Update modal title
        const modalTitle = this.modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = title;
        }

        // Show modal
        this.modal.classList.remove('hidden');
        this.isOpen = true;

        // Load exercises
        try {
            const workoutManager = new WorkoutManager(this.appState);
            this.currentLibrary = await workoutManager.getExerciseLibrary();
            this.filteredExercises = [...this.currentLibrary];
            
            console.log(`📚 Loaded exercise library (${this.context}):`, this.currentLibrary.length, 'exercises');
            
            this.render();
        } catch (error) {
            console.error('Error loading exercise library:', error);
            showNotification('Error loading exercises', 'error');
        }
    }

    // Apply search and filters
    applyFilters() {
        if (!this.isOpen || this.currentLibrary.length === 0) {
            return;
        }

        const searchQuery = document.getElementById('exercise-library-search')?.value || '';
        const bodyPartFilter = document.getElementById('body-part-filter')?.value || '';
        const equipmentFilter = document.getElementById('equipment-filter')?.value || '';
        
        console.log('🔍 Filtering exercises:', { searchQuery, bodyPartFilter, equipmentFilter });
        
        this.filteredExercises = this.currentLibrary.filter(exercise => {
            // Text search
            const matchesSearch = !searchQuery || 
                exercise.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                exercise.machine?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                exercise.bodyPart?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                exercise.equipmentType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (exercise.tags && exercise.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
            
            // Filter by body part
            const matchesBodyPart = !bodyPartFilter || 
                exercise.bodyPart?.toLowerCase() === bodyPartFilter.toLowerCase();
            
            // Filter by equipment
            const matchesEquipment = !equipmentFilter || 
                exercise.equipmentType?.toLowerCase() === equipmentFilter.toLowerCase();
            
            return matchesSearch && matchesBodyPart && matchesEquipment;
        });
        
        console.log('✅ Filtered to:', this.filteredExercises.length, 'exercises');
        this.render();
    }

    // Render the exercise grid
    render() {
        const grid = document.getElementById('exercise-library-grid');
        if (!grid) return;
        
        console.log(`🎨 Rendering exercise library (${this.context}):`, this.filteredExercises.length, 'exercises');
        
        if (this.filteredExercises.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Exercises Found</h3>
                    <p>Try adjusting your search or filters.</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = '';
        this.filteredExercises.forEach(exercise => {
            const card = this.createExerciseCard(exercise);
            grid.appendChild(card);
        });
    }

    // Create exercise card based on context
createExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = 'library-exercise-card';
    
    let actionButton = '';
    
    if (this.context === 'swap') {
        actionButton = `
            <button class="btn btn-primary btn-small" onclick="exerciseLibrary.selectForSwap('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-exchange-alt"></i> Swap
            </button>
        `;
    } else if (this.context === 'template') {
        actionButton = `
            <button class="btn btn-primary btn-small" onclick="exerciseLibrary.selectForTemplate('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-plus"></i> Add to Template
            </button>
        `;
    } else if (this.context === 'manual-workout') {
        actionButton = `
            <button class="btn btn-primary btn-small" onclick="exerciseLibrary.selectForManualWorkout('${exercise.name || exercise.machine}', ${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <i class="fas fa-plus"></i> Add to Workout
            </button>
        `;
    }
    
    card.innerHTML = `
        <h5>${exercise.name || exercise.machine}</h5>
        <div class="library-exercise-info">
            ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
            ${exercise.isCustom ? ' • Custom' : ''}
        </div>
        <div class="library-exercise-stats">
            ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
        </div>
        <div style="margin-top: 0.5rem;">
            ${actionButton}
        </div>
    `;
    
    return card;
}

// ADD this new method to the ExerciseLibrary class:
selectForManualWorkout(exerciseName, exerciseDataString) {
    if (!this.appState.addingToManualWorkout || !this.appState.manualWorkoutContext) {
        return;
    }
    
    let exerciseData;
    try {
        exerciseData = typeof exerciseDataString === 'string' ? 
            JSON.parse(exerciseDataString.replace(/&quot;/g, '"')) : 
            exerciseDataString;
    } catch (e) {
        console.error('Error parsing exercise data:', e);
        return;
    }
    
    const manualExercise = {
        name: exerciseData.name || exerciseData.machine,
        bodyPart: exerciseData.bodyPart,
        equipmentType: exerciseData.equipmentType,
        sets: [
            { reps: '', weight: '' },
            { reps: '', weight: '' },
            { reps: '', weight: '' }
        ], // Start with 3 empty sets
        notes: '',
        manuallyCompleted: false
    };
    
    // Add to manual workout
    this.appState.manualWorkoutContext.exercises.push(manualExercise);
    
    // Update the manual workout display
    if (window.renderManualExerciseList) {
        window.renderManualExerciseList();
    }
    
    this.close();
    showNotification(`Added "${manualExercise.name}" to workout`, 'success');
}

    // Select exercise for swapping
    async selectForSwap(exerciseName, exerciseDataString) {
        if (this.appState.swappingExerciseIndex === null || this.appState.swappingExerciseIndex === undefined) {
            return;
        }
        
        let exerciseData;
        try {
            exerciseData = typeof exerciseDataString === 'string' ? 
                JSON.parse(exerciseDataString.replace(/&quot;/g, '"')) : 
                exerciseDataString;
        } catch (e) {
            console.error('Error parsing exercise data:', e);
            return;
        }
        
        // Perform the swap (import confirmExerciseSwap from main.js)
        const { confirmExerciseSwap } = await import('../main.js');
        await confirmExerciseSwap(exerciseName, exerciseData);
        
        this.close();
    }

    // Select exercise for template
    selectForTemplate(exerciseName, exerciseDataString) {
        if (!this.appState.templateEditingContext) {
            return;
        }
        
        let exerciseData;
        try {
            exerciseData = typeof exerciseDataString === 'string' ? 
                JSON.parse(exerciseDataString.replace(/&quot;/g, '"')) : 
                exerciseDataString;
        } catch (e) {
            console.error('Error parsing exercise data:', e);
            return;
        }
        
        const templateExercise = {
            name: exerciseData.name || exerciseData.machine,
            bodyPart: exerciseData.bodyPart,
            equipmentType: exerciseData.equipmentType,
            sets: exerciseData.sets || 3,
            reps: exerciseData.reps || 10,
            weight: exerciseData.weight || 50,
            video: exerciseData.video || ''
        };
        
        // Add to template (we'll need to call the template update function)
        this.appState.templateEditingContext.exercises = this.appState.templateEditingContext.exercises || [];
        this.appState.templateEditingContext.exercises.push(templateExercise);
        
        // Trigger template re-render (import from main.js)
        if (window.renderTemplateEditorExercises) {
            window.renderTemplateEditorExercises();
        }
        
        this.close();
        showNotification(`Added "${templateExercise.name}" to template`, 'success');
    }

    // Close the library
    close() {
    if (this.modal) {
        this.modal.classList.add('hidden');
    }
    
    // Reset modal title
    const modalTitle = this.modal?.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Exercise Library';
    }
    
    // Clear search and filters
    const searchInput = document.getElementById('exercise-library-search');
    const bodyPartFilter = document.getElementById('body-part-filter');
    const equipmentFilter = document.getElementById('equipment-filter');
    
    if (searchInput) searchInput.value = '';
    if (bodyPartFilter) bodyPartFilter.value = '';
    if (equipmentFilter) equipmentFilter.value = '';
    
    // Reset state
    this.currentLibrary = [];
    this.filteredExercises = [];
    this.context = null;
    this.isOpen = false;
    
    // Reset app state
    this.appState.swappingExerciseIndex = null;
    this.appState.addingToTemplate = false;
    this.appState.templateEditingContext = null;
    this.appState.addingToManualWorkout = false;
    this.appState.manualWorkoutContext = null;
    
        console.log('🚪 Exercise library closed and reset');
    }

 async openForManualWorkout() {
    this.context = 'manual-workout';
    
    await this.loadAndShow('Add Exercise to Manual Workout');
}
}

// Create a singleton instance
let exerciseLibraryInstance = null;

export function getExerciseLibrary(appState) {
    if (!exerciseLibraryInstance) {
        exerciseLibraryInstance = new ExerciseLibrary(appState);
    }
    return exerciseLibraryInstance;
}