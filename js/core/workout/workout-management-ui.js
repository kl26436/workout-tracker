// Workout Management UI Functions
import { WorkoutManager } from './workout-manager.js';
import { showNotification } from '../ui-helpers.js';

let workoutManager;
let currentEditingTemplate = null;
let exerciseLibrary = [];
let filteredExercises = [];

export function initializeWorkoutManagement(appState) {
    workoutManager = new WorkoutManager(appState);
}

// Main navigation functions
export async function showWorkoutManagement() {
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const workoutManagement = document.getElementById('workout-management');
    
    if (workoutSelector) workoutSelector.classList.add('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.remove('hidden');
    
    await loadWorkoutTemplates();
}

export function hideWorkoutManagement() {
    const workoutManagement = document.getElementById('workout-management');
    const templateEditor = document.getElementById('template-editor');
    
    if (workoutManagement) workoutManagement.classList.add('hidden');
    if (templateEditor) templateEditor.classList.add('hidden');
    
    currentEditingTemplate = null;
}

// Template management functions
async function loadWorkoutTemplates() {
    const templateList = document.getElementById('template-list');
    if (!templateList) return;
    
    templateList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading templates...</span></div>';
    
    try {
        const templates = await workoutManager.getUserWorkoutTemplates();
        
        if (templates.length === 0) {
            templateList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No Custom Templates</h3>
                    <p>Create your first custom workout template to get started.</p>
                </div>
            `;
            return;
        }
        
        templateList.innerHTML = '';
        templates.forEach(template => {
            const card = createTemplateCard(template);
            templateList.appendChild(card);
        });
        
    } catch (error) {
        console.error('❌ Error loading templates:', error);
        templateList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Templates</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

function createTemplateCard(template) {
    const card = document.createElement('div');
    card.className = 'template-card';
    
    const exerciseCount = template.exercises?.length || 0;
    const exercisePreview = template.exercises?.slice(0, 3).map(ex => ex.name).join(', ') || 'No exercises';
    const moreText = exerciseCount > 3 ? ` and ${exerciseCount - 3} more...` : '';
    
    card.innerHTML = `
        <h4>${template.name}</h4>
        <div class="template-category">${template.category || 'Other'}</div>
        <div class="template-exercises-preview">
            ${exerciseCount} exercises: ${exercisePreview}${moreText}
        </div>
        <div class="template-actions">
            <button class="btn btn-primary btn-small" onclick="useTemplate('${template.id}')">
                <i class="fas fa-play"></i> Use Today
            </button>
            <button class="btn btn-secondary btn-small" onclick="editTemplate('${template.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-small" onclick="deleteTemplate('${template.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

export function createNewTemplate() {
    currentEditingTemplate = {
        name: '',
        category: 'Other',
        exercises: []
    };
    
    showTemplateEditor();
}

export function editTemplate(templateId) {
    // This would load the template from the stored templates
    showNotification('Edit template functionality coming soon!', 'info');
}

export function deleteTemplate(templateId) {
    if (confirm('Are you sure you want to delete this template? This cannot be undone.')) {
        showNotification('Delete template functionality coming soon!', 'info');
    }
}

export function useTemplate(templateId) {
    showNotification('Use template functionality coming soon!', 'info');
}

function showTemplateEditor() {
    const templateEditor = document.getElementById('template-editor');
    if (!templateEditor) return;
    
    templateEditor.classList.remove('hidden');
    
    // Populate form with current template data
    const nameInput = document.getElementById('template-name');
    const categorySelect = document.getElementById('template-category');
    
    if (nameInput) nameInput.value = currentEditingTemplate.name;
    if (categorySelect) categorySelect.value = currentEditingTemplate.category;
    
    renderTemplateExercises();
}

export function closeTemplateEditor() {
    const templateEditor = document.getElementById('template-editor');
    if (templateEditor) {
        templateEditor.classList.add('hidden');
    }
    currentEditingTemplate = null;
}

export async function saveCurrentTemplate() {
    if (!currentEditingTemplate) return;
    
    const nameInput = document.getElementById('template-name');
    const categorySelect = document.getElementById('template-category');
    
    if (!nameInput?.value.trim()) {
        showNotification('Please enter a template name', 'warning');
        return;
    }
    
    currentEditingTemplate.name = nameInput.value.trim();
    currentEditingTemplate.category = categorySelect?.value || 'Other';
    
    if (currentEditingTemplate.exercises.length === 0) {
        showNotification('Please add at least one exercise to the template', 'warning');
        return;
    }
    
    const success = await workoutManager.saveWorkoutTemplate(currentEditingTemplate);
    
    if (success) {
        closeTemplateEditor();
        await loadWorkoutTemplates();
    }
}

function renderTemplateExercises() {
    const container = document.getElementById('template-exercises');
    if (!container) return;
    
    if (currentEditingTemplate.exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-dumbbell"></i>
                <p>No exercises added yet. Click "Add Exercise" to get started.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    currentEditingTemplate.exercises.forEach((exercise, index) => {
        const item = createTemplateExerciseItem(exercise, index);
        container.appendChild(item);
    });
}

function createTemplateExerciseItem(exercise, index) {
    const item = document.createElement('div');
    item.className = 'template-exercise-item';
    
    item.innerHTML = `
        <div class="exercise-info">
            <h5>${exercise.name}</h5>
            <div class="exercise-details">
                ${exercise.sets} sets × ${exercise.reps} reps @ ${exercise.weight} lbs
                ${exercise.bodyPart ? ` • ${exercise.bodyPart}` : ''}
                ${exercise.equipmentType ? ` • ${exercise.equipmentType}` : ''}
            </div>
        </div>
        <div class="exercise-item-actions">
            <button class="btn btn-secondary btn-small" onclick="editTemplateExercise(${index})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-small" onclick="removeTemplateExercise(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return item;
}

export function addExerciseToTemplate() {
    openExerciseLibrary('template');
}

export function editTemplateExercise(index) {
    showNotification('Edit exercise functionality coming soon!', 'info');
}

export function removeTemplateExercise(index) {
    if (!currentEditingTemplate) return;
    
    currentEditingTemplate.exercises.splice(index, 1);
    renderTemplateExercises();
    showNotification('Exercise removed from template', 'success');
}

// Exercise Library functions
export async function openExerciseLibrary(mode = 'template') {
    const modal = document.getElementById('exercise-library-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Load exercise library
    exerciseLibrary = await workoutManager.getExerciseLibrary();
    filteredExercises = [...exerciseLibrary];
    
    renderExerciseLibrary();
}

export function closeExerciseLibrary() {
    const modal = document.getElementById('exercise-library-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Clear search
    const searchInput = document.getElementById('exercise-library-search');
    const bodyPartFilter = document.getElementById('body-part-filter');
    const equipmentFilter = document.getElementById('equipment-filter');
    
    if (searchInput) searchInput.value = '';
    if (bodyPartFilter) bodyPartFilter.value = '';
    if (equipmentFilter) equipmentFilter.value = '';
}

export function searchExerciseLibrary() {
    filterExerciseLibrary();
}

export function filterExerciseLibrary() {
    const searchQuery = document.getElementById('exercise-library-search')?.value || '';
    const bodyPartFilter = document.getElementById('body-part-filter')?.value || '';
    const equipmentFilter = document.getElementById('equipment-filter')?.value || '';
    
    const filters = {};
    if (bodyPartFilter) filters.bodyPart = bodyPartFilter;
    if (equipmentFilter) filters.equipment = equipmentFilter;
    
    filteredExercises = workoutManager.searchExercises(exerciseLibrary, searchQuery, filters);
    renderExerciseLibrary();
}

function renderExerciseLibrary() {
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
        const card = createLibraryExerciseCard(exercise);
        grid.appendChild(card);
    });
}

function createLibraryExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = 'library-exercise-card';
    
    card.innerHTML = `
        <h5>${exercise.name || exercise.machine}</h5>
        <div class="library-exercise-info">
            ${exercise.bodyPart || 'General'} • ${exercise.equipmentType || 'Machine'}
            ${exercise.isCustom ? ' • Custom' : ''}
        </div>
        <div class="library-exercise-stats">
            ${exercise.sets || 3} sets × ${exercise.reps || 10} reps @ ${exercise.weight || 50} lbs
        </div>
    `;
    
    card.addEventListener('click', () => selectExerciseFromLibrary(exercise));
    
    return card;
}

function selectExerciseFromLibrary(exercise) {
    // Add to current template
    if (currentEditingTemplate) {
        const templateExercise = {
            name: exercise.name || exercise.machine,
            bodyPart: exercise.bodyPart,
            equipmentType: exercise.equipmentType,
            sets: exercise.sets || 3,
            reps: exercise.reps || 10,
            weight: exercise.weight || 50,
            video: exercise.video || ''
        };
        
        currentEditingTemplate.exercises.push(templateExercise);
        renderTemplateExercises();
        closeExerciseLibrary();
        showNotification(`Added "${templateExercise.name}" to template`, 'success');
    }
}

// Create Exercise functions
export function showCreateExerciseForm() {
    const modal = document.getElementById('create-exercise-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

export function closeCreateExerciseModal() {
    const modal = document.getElementById('create-exercise-modal');
    const form = document.getElementById('create-exercise-form');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

export async function createNewExercise(event) {
    event.preventDefault();
    
    const name = document.getElementById('new-exercise-name')?.value.trim();
    const bodyPart = document.getElementById('new-exercise-body-part')?.value;
    const equipment = document.getElementById('new-exercise-equipment')?.value;
    const sets = parseInt(document.getElementById('new-exercise-sets')?.value) || 3;
    const reps = parseInt(document.getElementById('new-exercise-reps')?.value) || 10;
    const weight = parseInt(document.getElementById('new-exercise-weight')?.value) || 50;
    const video = document.getElementById('new-exercise-video')?.value.trim();
    
    if (!name) {
        showNotification('Please enter an exercise name', 'warning');
        return;
    }
    
    const exerciseData = {
        name,
        machine: name,
        bodyPart,
        equipmentType: equipment,
        tags: [bodyPart.toLowerCase(), equipment.toLowerCase()],
        sets,
        reps,
        weight,
        video
    };
    
    const success = await workoutManager.createExercise(exerciseData);
    
    if (success) {
        closeCreateExerciseModal();
        
        // Refresh exercise library if it's open
        const libraryModal = document.getElementById('exercise-library-modal');
        if (libraryModal && !libraryModal.classList.contains('hidden')) {
            exerciseLibrary = await workoutManager.getExerciseLibrary();
            filteredExercises = [...exerciseLibrary];
            renderExerciseLibrary();
        }
    }
}

export function returnToWorkoutsFromManagement(appState) {
    console.log('🔄 BUG-032 FIX: Smart navigation from workout management');
    
    const hasActiveCustomTemplate = checkForActiveCustomTemplate(appState);
    
    // Hide management UI first
    hideWorkoutManagement();
    
    if (hasActiveCustomTemplate) {
        // Custom template active - navigate without popup warning
        console.log('📋 Active custom template detected - bypassing popup warning');
        showWorkoutSelectorSafe(appState, true);
    } else {
        // No active custom template - normal navigation
        console.log('✅ Normal navigation - no active custom template');
        showWorkoutSelectorSafe(appState, false);
    }
}

// Helper function to detect active custom templates
function checkForActiveCustomTemplate(appState) {
    if (!appState.currentWorkout || !appState.savedData.workoutType) {
        return false;
    }
    
    // Check if current workoutType is NOT in default workout plans
    const isDefaultWorkout = appState.workoutPlans.some(plan => 
        plan.day === appState.savedData.workoutType
    );
    
    return !isDefaultWorkout; // If not default, it's likely a custom template
}

// Safe wrapper for showWorkoutSelector that respects navigation context
function showWorkoutSelectorSafe(appState, fromNavigation = false) {
    // Only show warning popup if NOT from navigation and has real progress
    const shouldShowWarning = !fromNavigation && 
                             appState.hasWorkoutProgress() && 
                             appState.currentWorkout && 
                             appState.savedData.workoutType;
    
    if (shouldShowWarning) {
        const confirmChange = confirm(
            'You have progress on your current workout. Changing will save your progress but return you to workout selection. Continue?'
        );
        if (!confirmChange) {
            // User chose to stay - show management again
            showWorkoutManagement();
            return;
        }
        
        // Save progress before switching
        saveWorkoutData(appState);
    }
    
    // Perform navigation
    navigateToWorkoutSelector(fromNavigation, appState);
}

// Clean navigation function
function navigateToWorkoutSelector(fromNavigation, appState) {
    const workoutSelector = document.getElementById('workout-selector');
    const activeWorkout = document.getElementById('active-workout');
    const workoutManagement = document.getElementById('workout-management');
    const historySection = document.getElementById('workout-history-section');
    const templateEditor = document.getElementById('template-editor-section');
    
    // Show/hide appropriate sections
    if (workoutSelector) workoutSelector.classList.remove('hidden');
    if (activeWorkout) activeWorkout.classList.add('hidden');
    if (workoutManagement) workoutManagement.classList.add('hidden');
    if (historySection) historySection.classList.add('hidden');
    if (templateEditor) templateEditor.classList.add('hidden');
    
    // Clear timers
    appState.clearTimers();
    
    // Preserve currentWorkout when returning from navigation
    if (!fromNavigation) {
        appState.currentWorkout = null;
    }
    
    // Show in-progress workout prompt if returning with active workout
    if (fromNavigation && appState.currentWorkout && appState.savedData.workoutType) {
        showInProgressWorkoutPrompt(appState);
    }
}