// Enhanced Exercise Library Module - core/exercise-library.js
import { showNotification } from './ui-helpers.js';

export function getExerciseLibrary(appState) {
    let isOpen = false;
    let currentContext = null; // 'swap', 'template', 'workout-add'
    let currentExercises = [];
    let filteredExercises = [];

    return {
        initialize() {
            console.log('📚 Exercise Library initialized');
        },

        async openForSwap(exerciseIndex) {
            if (!appState.currentUser) {
                showNotification('Please sign in to swap exercises', 'warning');
                return;
            }

            currentContext = 'swap';
            appState.swappingExerciseIndex = exerciseIndex;
            
            const modal = document.getElementById('exercise-library-modal');
            const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
            
            if (modalTitle) {
                const exerciseName = appState.currentWorkout?.exercises[exerciseIndex]?.machine || 'Exercise';
                modalTitle.textContent = `Swap: ${exerciseName}`;
            }

            await this.loadAndShow();
        },

        createExerciseCard(exercise) {
            const card = document.createElement('div');
            card.className = 'library-exercise-card';
            
            let actionButton = '';
            const exerciseJson = JSON.stringify(exercise).replace(/"/g, '&quot;');
            
            switch (currentContext) {
                case 'swap':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="confirmExerciseSwap('${exercise.name || exercise.machine}', ${exerciseJson})">
                            <i class="fas fa-exchange-alt"></i> Swap
                        </button>
                    `;
                    break;
                    
                case 'template':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="addToTemplateFromLibrary(${exerciseJson})">
                            <i class="fas fa-plus"></i> Add to Template
                        </button>
                    `;
                    break;
                    
                case 'workout-add':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="addToWorkoutFromLibrary(${exerciseJson})">
                            <i class="fas fa-plus"></i> Add to Workout
                        </button>
                    `;
                    break;
                    
                case 'manual-workout':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="addToManualWorkoutFromLibrary(${exerciseJson})">
                            <i class="fas fa-plus"></i> Add Exercise
                        </button>
                    `;
                    break;
                    
                default:
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="selectExerciseGeneric(${exerciseJson})">
                            <i class="fas fa-plus"></i> Select
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
                <div class="library-exercise-actions">
                    ${actionButton}
                </div>
            `;
            
            return card;
        },


        async openForManualWorkout() {
            if (!appState.currentUser) {
                showNotification('Please sign in to add exercises', 'warning');
                return;
            }

            currentContext = 'manual-workout';
            
            const modal = document.getElementById('exercise-library-modal');
            const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
            
            if (modalTitle) {
                modalTitle.textContent = 'Add Exercise to Manual Workout';
            }

            await this.loadAndShow();
        },

        async openForTemplate(template) {
            currentContext = 'template';
            appState.addingToTemplate = true;
            appState.templateEditingContext = template;
            
            const modal = document.getElementById('exercise-library-modal');
            const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
            
            if (modalTitle) {
                modalTitle.textContent = 'Add Exercise to Template';
            }

            await this.loadAndShow();
        },

        async openForWorkoutAdd() {
            if (!appState.currentUser || !appState.currentWorkout) {
                showNotification('No active workout to add exercises to', 'warning');
                return;
            }

            currentContext = 'workout-add';
            
            const modal = document.getElementById('exercise-library-modal');
            const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
            
            if (modalTitle) {
                modalTitle.textContent = 'Add Exercise to Workout';
            }

            await this.loadAndShow();
        },

        async loadAndShow() {
            const modal = document.getElementById('exercise-library-modal');
            if (!modal) return;

            modal.classList.remove('hidden');
            isOpen = true;

            try {
                // Load exercises
                await this.loadExercises();
                this.renderExercises();
                
                // Setup search/filter handlers
                this.setupEventHandlers();
                
            } catch (error) {
                console.error('Error loading exercise library:', error);
                showNotification('Error loading exercises', 'error');
            }
        },

        async loadExercises() {
            try {
                const { WorkoutManager } = await import('./workout/workout-manager.js');
                const workoutManager = new WorkoutManager(appState);
                currentExercises = await workoutManager.getExerciseLibrary();
                filteredExercises = [...currentExercises];
                
                console.log(`📚 Loaded ${currentExercises.length} exercises for context: ${currentContext}`);
            } catch (error) {
                console.error('Error loading exercises:', error);
                currentExercises = appState.exerciseDatabase || [];
                filteredExercises = [...currentExercises];
            }
        },

        renderExercises() {
            const grid = document.getElementById('exercise-library-grid');
            if (!grid) return;

            if (filteredExercises.length === 0) {
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
            filteredExercises.forEach(exercise => {
                const card = this.createExerciseCard(exercise);
                grid.appendChild(card);
            });
        },

        createExerciseCard(exercise) {
            const card = document.createElement('div');
            card.className = 'library-exercise-card';
            
            let actionButton = '';
            let onClickHandler = '';
            
            const exerciseJson = JSON.stringify(exercise).replace(/"/g, '&quot;');
            
            switch (currentContext) {
                case 'swap':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="confirmExerciseSwap('${exercise.name || exercise.machine}', '${exerciseJson}')">
                            <i class="fas fa-exchange-alt"></i> Swap
                        </button>
                    `;
                    break;
                    
                case 'template':
                    actionButton = `
                        <button class="btn btn-primary btn-small" onclick="addExerciseToTemplateFromLibrary('${exercise.name || exercise.machine}', '${exerciseJson}')">
                            <i class="fas fa-plus"></i> Add to Template
                        </button>
                    `;
                    break;
                    
                case 'workout-add':
                    actionButton = `
                        <button class="btn btn-success btn-small" onclick="confirmExerciseAddToWorkout('${exercise.name || exercise.machine}', '${exerciseJson}')">
                            <i class="fas fa-plus"></i> Add to Workout
                        </button>
                    `;
                    break;
                    
                default:
                    actionButton = `
                        <button class="btn btn-secondary btn-small" onclick="selectExerciseGeneric('${exercise.name || exercise.machine}', '${exerciseJson}')">
                            <i class="fas fa-check"></i> Select
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
                <div class="library-exercise-actions">
                    ${actionButton}
                </div>
            `;
            
            return card;
        },

        setupEventHandlers() {
            // Search functionality
            const searchInput = document.getElementById('exercise-library-search');
            if (searchInput) {
                searchInput.oninput = () => this.filterExercises();
            }

            // Filter dropdowns
            const bodyPartFilter = document.getElementById('body-part-filter');
            const equipmentFilter = document.getElementById('equipment-filter');
            
            if (bodyPartFilter) {
                bodyPartFilter.onchange = () => this.filterExercises();
            }
            if (equipmentFilter) {
                equipmentFilter.onchange = () => this.filterExercises();
            }
        },

        filterExercises() {
            const searchQuery = document.getElementById('exercise-library-search')?.value.toLowerCase() || '';
            const bodyPartFilter = document.getElementById('body-part-filter')?.value || '';
            const equipmentFilter = document.getElementById('equipment-filter')?.value || '';

            filteredExercises = currentExercises.filter(exercise => {
                // Text search
                const matchesSearch = !searchQuery || 
                    exercise.name?.toLowerCase().includes(searchQuery) ||
                    exercise.machine?.toLowerCase().includes(searchQuery) ||
                    exercise.bodyPart?.toLowerCase().includes(searchQuery) ||
                    exercise.equipmentType?.toLowerCase().includes(searchQuery) ||
                    (exercise.tags && exercise.tags.some(tag => tag.toLowerCase().includes(searchQuery)));

                // Body part filter
                const matchesBodyPart = !bodyPartFilter || 
                    exercise.bodyPart?.toLowerCase() === bodyPartFilter.toLowerCase();

                // Equipment filter
                const matchesEquipment = !equipmentFilter || 
                    exercise.equipmentType?.toLowerCase() === equipmentFilter.toLowerCase();

                return matchesSearch && matchesBodyPart && matchesEquipment;
            });

            this.renderExercises();
        },

        async refresh() {
            if (isOpen) {
                await this.loadExercises();
                this.renderExercises();
            }
        },

        close() {
            const modal = document.getElementById('exercise-library-modal');
            if (modal) {
                modal.classList.add('hidden');
            }

            // Reset state
            isOpen = false;
            currentContext = null;
            appState.swappingExerciseIndex = null;
            appState.addingExerciseToWorkout = false;
            appState.addingToTemplate = false;
            appState.insertAfterIndex = null;
            appState.templateEditingContext = null;

            // Clear search and filters
            const searchInput = document.getElementById('exercise-library-search');
            const bodyPartFilter = document.getElementById('body-part-filter');
            const equipmentFilter = document.getElementById('equipment-filter');
            
            if (searchInput) searchInput.value = '';
            if (bodyPartFilter) bodyPartFilter.value = '';
            if (equipmentFilter) equipmentFilter.value = '';

            // Reset modal title
            const modalTitle = document.querySelector('#exercise-library-modal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Exercise Library';
            }
        }
    };
}