// CREATE NEW FILE: js/core/workout-history.js
// Comprehensive workout history management

import { db, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, deleteDoc, where } from './firebase-config.js';
import { showNotification } from './ui-helpers.js';
import { convertWeight } from './ui-helpers.js';

export class WorkoutHistory {
    constructor(appState) {
        this.appState = appState;
        this.currentHistory = [];
        this.filteredHistory = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isLoading = false;
    }

    // Initialize history manager
    initialize() {
        this.setupEventListeners();
    }

    // Set up event listeners
    setupEventListeners() {
        // Filter buttons
        const filterButtons = document.querySelectorAll('.history-filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter));
        });

        // Search input
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applySearch());
        }

        // Date range inputs
        const startDate = document.getElementById('history-start-date');
        const endDate = document.getElementById('history-end-date');
        
        if (startDate) startDate.addEventListener('change', () => this.applyDateFilter());
        if (endDate) endDate.addEventListener('change', () => this.applyDateFilter());
    }

    // Load workout history
    async loadHistory(options = {}) {
        if (!this.appState.currentUser) {
            showNotification('Please sign in to view workout history', 'warning');
            return;
        }

        this.isLoading = true;
        this.showLoadingState();

        try {
            const workoutsRef = collection(db, "users", this.appState.currentUser.uid, "workouts");
            let q = query(workoutsRef, orderBy("date", "desc"));

            if (options.limit) {
                q = query(q, limit(options.limit));
            }

            const querySnapshot = await getDocs(q);
            
            this.currentHistory = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                this.currentHistory.push({
                    id: doc.id,
                    ...data,
                    docId: doc.id // Store document ID for deletion
                });
            });

            console.log('📚 Loaded workout history:', this.currentHistory.length, 'workouts');
            
            this.filteredHistory = [...this.currentHistory];
            this.currentPage = 1;
            this.renderHistory();

        } catch (error) {
            console.error('Error loading workout history:', error);
            showNotification('Error loading workout history', 'error');
            this.showErrorState();
        } finally {
            this.isLoading = false;
        }
    }

    // Apply filters
    applyFilter(filterType) {
        // Update active filter button
        document.querySelectorAll('.history-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
        });

        let filtered = [...this.currentHistory];

        switch (filterType) {
            case 'all':
                break;
            case 'completed':
                filtered = filtered.filter(w => w.completedAt && !w.cancelledAt && !w.discardedAt);
                break;
            case 'cancelled':
                filtered = filtered.filter(w => w.cancelledAt || w.status === 'cancelled');
                break;
            case 'discarded':
                filtered = filtered.filter(w => w.discardedAt || w.status === 'discarded');
                break;
            case 'this-week':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filtered = filtered.filter(w => new Date(w.date) >= oneWeekAgo);
                break;
            case 'this-month':
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                filtered = filtered.filter(w => new Date(w.date) >= oneMonthAgo);
                break;
        }

        this.filteredHistory = filtered;
        this.currentPage = 1;
        this.renderHistory();
    }

    // Apply search filter
    applySearch() {
        const searchTerm = document.getElementById('history-search')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            this.filteredHistory = [...this.currentHistory];
        } else {
            this.filteredHistory = this.currentHistory.filter(workout => 
                workout.workoutType?.toLowerCase().includes(searchTerm) ||
                workout.date?.includes(searchTerm) ||
                this.getWorkoutNotes(workout).toLowerCase().includes(searchTerm)
            );
        }

        this.currentPage = 1;
        this.renderHistory();
    }

    // Apply date range filter
    applyDateFilter() {
        const startDate = document.getElementById('history-start-date')?.value;
        const endDate = document.getElementById('history-end-date')?.value;

        let filtered = [...this.currentHistory];

        if (startDate) {
            filtered = filtered.filter(w => w.date >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(w => w.date <= endDate);
        }

        this.filteredHistory = filtered;
        this.currentPage = 1;
        this.renderHistory();
    }

    // Render workout history
    renderHistory() {
        const container = document.getElementById('workout-history-list');
        if (!container) return;

        if (this.filteredHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Workouts Found</h3>
                    <p>No workouts match your current filters.</p>
                </div>
            `;
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageWorkouts = this.filteredHistory.slice(startIndex, endIndex);

        // Render workouts
        container.innerHTML = '';
        pageWorkouts.forEach(workout => {
            const workoutCard = this.createWorkoutHistoryCard(workout);
            container.appendChild(workoutCard);
        });

        // Render pagination
        this.renderPagination();

        // Update stats
        this.updateHistoryStats();
    }

    // Create workout history card
    createWorkoutHistoryCard(workout) {
        const card = document.createElement('div');
        card.className = 'workout-history-card';
        
        const status = this.getWorkoutStatus(workout);
        const stats = this.calculateWorkoutStats(workout);
        const duration = this.formatDuration(workout.totalDuration);
        const date = new Date(workout.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        card.innerHTML = `
            <div class="workout-card-header">
                <div class="workout-card-main">
                    <h4>${workout.workoutType}</h4>
                    <div class="workout-card-meta">
                        <span class="workout-date">
                            <i class="fas fa-calendar"></i> ${date}
                        </span>
                        <span class="workout-status ${status.class}">${status.text}</span>
                    </div>
                </div>
                <div class="workout-card-actions">
                    <button class="btn btn-secondary btn-small" onclick="workoutHistory.viewWorkout('${workout.docId}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-small" onclick="workoutHistory.repeatWorkout('${workout.docId}')" title="Repeat Workout">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn btn-danger btn-small" onclick="workoutHistory.deleteWorkout('${workout.docId}', '${workout.workoutType}', '${workout.date}')" title="Delete Workout">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="workout-card-stats">
                <div class="stat-item">
                    <span class="stat-label">Sets</span>
                    <span class="stat-value">${stats.completedSets}/${stats.totalSets}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Duration</span>
                    <span class="stat-value">${duration}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Volume</span>
                    <span class="stat-value">${stats.totalVolume} lbs</span>
                </div>
            </div>
            
            ${this.renderExercisePreview(workout)}
        `;

        return card;
    }

    // Render exercise preview
    renderExercisePreview(workout) {
        if (!workout.exercises || Object.keys(workout.exercises).length === 0) {
            return '<div class="exercise-preview">No exercise data</div>';
        }

        const exercises = Object.entries(workout.exercises)
            .filter(([key, data]) => data.sets && data.sets.some(set => set.reps && set.weight))
            .slice(0, 3);

        if (exercises.length === 0) {
            return '<div class="exercise-preview">No completed exercises</div>';
        }

        const previewHTML = exercises.map(([key, exerciseData], index) => {
            const exerciseIndex = parseInt(key.split('_')[1]);
            const workoutPlan = this.appState.workoutPlans?.find(w => w.day === workout.workoutType);
            const exerciseName = workoutPlan?.exercises[exerciseIndex]?.machine || `Exercise ${exerciseIndex + 1}`;
            
            const completedSets = exerciseData.sets.filter(set => set.reps && set.weight);
            const bestSet = this.getBestSet(completedSets);

            return `
                <div class="exercise-preview-item">
                    <span class="exercise-name">${exerciseName}</span>
                    <span class="exercise-best">${bestSet.reps} × ${bestSet.weight} lbs</span>
                </div>
            `;
        }).join('');

        const moreCount = Object.keys(workout.exercises).length - exercises.length;
        const moreText = moreCount > 0 ? `<div class="exercise-more">+${moreCount} more...</div>` : '';

        return `
            <div class="exercise-preview">
                ${previewHTML}
                ${moreText}
            </div>
        `;
    }

    // Calculate workout statistics
    calculateWorkoutStats(workout) {
        let completedSets = 0;
        let totalSets = 0;
        let totalVolume = 0;

        // Get total sets from workout plan
        const workoutPlan = this.appState.workoutPlans?.find(w => w.day === workout.workoutType);
        if (workoutPlan) {
            totalSets = workoutPlan.exercises.reduce((sum, ex) => sum + ex.sets, 0);
        }

        // Calculate completed sets and volume
        if (workout.exercises) {
            Object.values(workout.exercises).forEach(exerciseData => {
                if (exerciseData.sets) {
                    const completed = exerciseData.sets.filter(set => set.reps && set.weight);
                    completedSets += completed.length;
                    
                    // Calculate volume (weight × reps)
                    completed.forEach(set => {
                        totalVolume += (set.weight * set.reps);
                    });
                }
            });
        }

        return {
            completedSets,
            totalSets,
            totalVolume: Math.round(totalVolume)
        };
    }

    // Get workout status
    getWorkoutStatus(workout) {
        if (workout.completedAt) {
            return { text: 'Completed', class: 'completed' };
        } else if (workout.cancelledAt || workout.status === 'cancelled') {
            return { text: 'Cancelled', class: 'cancelled' };
        } else if (workout.discardedAt || workout.status === 'discarded') {
            return { text: 'Discarded', class: 'discarded' };
        } else {
            return { text: 'In Progress', class: 'in-progress' };
        }
    }

    // Get best set from completed sets
    getBestSet(sets) {
        if (!sets || sets.length === 0) {
            return { reps: 0, weight: 0 };
        }

        // Find set with highest weight, then highest reps
        return sets.reduce((best, current) => {
            if (current.weight > best.weight) return current;
            if (current.weight === best.weight && current.reps > best.reps) return current;
            return best;
        });
    }

    // Format duration
    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Get workout notes
    getWorkoutNotes(workout) {
        if (!workout.exercises) return '';
        
        return Object.values(workout.exercises)
            .map(ex => ex.notes || '')
            .filter(note => note.trim())
            .join(' ');
    }

    // View workout details
    async viewWorkout(workoutId) {
        const workout = this.currentHistory.find(w => w.docId === workoutId);
        if (!workout) return;

        this.showWorkoutDetailModal(workout);
    }

    // Show workout detail modal
    showWorkoutDetailModal(workout) {
        const modal = document.createElement('div');
        modal.className = 'modal workout-detail-modal';
        modal.style.zIndex = '9999';

        const status = this.getWorkoutStatus(workout);
        const stats = this.calculateWorkoutStats(workout);
        const date = new Date(workout.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        modal.innerHTML = `
            <div class="modal-content workout-detail-content">
                <div class="modal-header">
                    <div>
                        <h3>${workout.workoutType}</h3>
                        <div class="workout-detail-meta">
                            <span>${date}</span>
                            <span class="workout-status ${status.class}">${status.text}</span>
                        </div>
                    </div>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="workout-detail-stats">
                    <div class="detail-stat">
                        <span class="detail-stat-label">Sets Completed</span>
                        <span class="detail-stat-value">${stats.completedSets}/${stats.totalSets}</span>
                    </div>
                    <div class="detail-stat">
                        <span class="detail-stat-label">Duration</span>
                        <span class="detail-stat-value">${this.formatDuration(workout.totalDuration)}</span>
                    </div>
                    <div class="detail-stat">
                        <span class="detail-stat-label">Total Volume</span>
                        <span class="detail-stat-value">${stats.totalVolume} lbs</span>
                    </div>
                </div>

                <div class="workout-detail-exercises">
                    ${this.renderDetailedExercises(workout)}
                </div>

                <div class="workout-detail-actions">
                    <button class="btn btn-primary" onclick="workoutHistory.repeatWorkout('${workout.docId}'); this.closest('.modal').remove();">
                        <i class="fas fa-redo"></i> Repeat This Workout
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Render detailed exercises
    renderDetailedExercises(workout) {
        if (!workout.exercises || Object.keys(workout.exercises).length === 0) {
            return '<div class="no-exercise-data">No exercise data available</div>';
        }

        const workoutPlan = this.appState.workoutPlans?.find(w => w.day === workout.workoutType);
        let exercisesHTML = '';

        Object.entries(workout.exercises).forEach(([key, exerciseData]) => {
            const exerciseIndex = parseInt(key.split('_')[1]);
            const planExercise = workoutPlan?.exercises[exerciseIndex];
            const exerciseName = planExercise?.machine || `Exercise ${exerciseIndex + 1}`;

            if (exerciseData.sets && exerciseData.sets.length > 0) {
                const completedSets = exerciseData.sets.filter(set => set.reps && set.weight);
                
                exercisesHTML += `
                    <div class="detail-exercise">
                        <h4>${exerciseName}</h4>
                        <div class="detail-sets">
                            ${completedSets.map((set, index) => `
                                <div class="detail-set">
                                    Set ${index + 1}: ${set.reps} reps × ${set.weight} lbs
                                </div>
                            `).join('')}
                        </div>
                        ${exerciseData.notes ? `
                            <div class="detail-notes">
                                <strong>Notes:</strong> ${exerciseData.notes}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        });

        return exercisesHTML || '<div class="no-exercise-data">No completed exercises</div>';
    }

    // Repeat workout
    async repeatWorkout(workoutId) {
        const workout = this.currentHistory.find(w => w.docId === workoutId);
        if (!workout) return;

        const confirmRepeat = confirm(`Start a new "${workout.workoutType}" workout based on this previous session?`);
        if (!confirmRepeat) return;

        try {
            // Find the workout template
            const workoutPlan = this.appState.workoutPlans?.find(w => w.day === workout.workoutType);
            if (!workoutPlan) {
                showNotification('Workout template not found', 'error');
                return;
            }

            // Close history and start the workout
            this.closeHistory();
            
            // Import selectWorkout function
            const { selectWorkout } = await import('../main.js');
            await selectWorkout(workout.workoutType, null, workoutPlan);

            showNotification(`Starting "${workout.workoutType}" workout!`, 'success');

        } catch (error) {
            console.error('Error repeating workout:', error);
            showNotification('Error starting workout', 'error');
        }
    }

    // Delete workout
    async deleteWorkout(workoutId, workoutType, date) {
        const confirmDelete = confirm(
            `Are you sure you want to permanently delete the "${workoutType}" workout from ${new Date(date).toLocaleDateString()}?\n\nThis cannot be undone.`
        );

        if (!confirmDelete) return;

        try {
            // Delete from Firebase
            const docRef = doc(db, "users", this.appState.currentUser.uid, "workouts", workoutId);
            await deleteDoc(docRef);

            // Remove from local arrays
            this.currentHistory = this.currentHistory.filter(w => w.docId !== workoutId);
            this.filteredHistory = this.filteredHistory.filter(w => w.docId !== workoutId);

            // Re-render
            this.renderHistory();

            showNotification('Workout deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting workout:', error);
            showNotification('Error deleting workout', 'error');
        }
    }

    // Add manual workout
    async addManualWorkout(workoutData) {
        if (!this.appState.currentUser) {
            showNotification('Please sign in to add workouts', 'warning');
            return;
        }

        try {
            const docRef = doc(db, "users", this.appState.currentUser.uid, "workouts", workoutData.date);
            await setDoc(docRef, {
                ...workoutData,
                lastUpdated: new Date().toISOString(),
                addedManually: true
            });

            showNotification('Workout added successfully!', 'success');
            
            // Reload history
            await this.loadHistory();

        } catch (error) {
            console.error('Error adding manual workout:', error);
            showNotification('Error adding workout', 'error');
        }
    }

    // Show loading state
    showLoadingState() {
        const container = document.getElementById('workout-history-list');
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>Loading workout history...</span>
                </div>
            `;
        }
    }

    // Show error state
    showErrorState() {
        const container = document.getElementById('workout-history-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading History</h3>
                    <p>Please try again later.</p>
                    <button class="btn btn-primary" onclick="workoutHistory.loadHistory()">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    // Render pagination
    renderPagination() {
        const paginationContainer = document.getElementById('history-pagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(this.filteredHistory.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `
                <button class="btn btn-secondary btn-small" onclick="workoutHistory.goToPage(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
            `;
        }

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<span class="page-current">${i}</span>`;
            } else {
                paginationHTML += `
                    <button class="btn btn-secondary btn-small" onclick="workoutHistory.goToPage(${i})">
                        ${i}
                    </button>
                `;
            }
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `
                <button class="btn btn-secondary btn-small" onclick="workoutHistory.goToPage(${this.currentPage + 1})">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationContainer.innerHTML = `
            <div class="pagination">
                ${paginationHTML}
            </div>
        `;
    }

    // Go to page
    goToPage(page) {
        this.currentPage = page;
        this.renderHistory();
    }

    // Update history stats
    updateHistoryStats() {
        const statsContainer = document.getElementById('history-stats');
        if (!statsContainer) return;

        const total = this.currentHistory.length;
        const completed = this.currentHistory.filter(w => w.completedAt).length;
        const thisWeek = this.currentHistory.filter(w => {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return new Date(w.date) >= oneWeekAgo;
        }).length;

        statsContainer.innerHTML = `
            <div class="history-stat">
                <span class="stat-number">${total}</span>
                <span class="stat-label">Total Workouts</span>
            </div>
            <div class="history-stat">
                <span class="stat-number">${completed}</span>
                <span class="stat-label">Completed</span>
            </div>
            <div class="history-stat">
                <span class="stat-number">${thisWeek}</span>
                <span class="stat-label">This Week</span>
            </div>
            <div class="history-stat">
                <span class="stat-number">${this.filteredHistory.length}</span>
                <span class="stat-label">Showing</span>
            </div>
        `;
    }

    // Close history
    closeHistory() {
        const historySection = document.getElementById('workout-history-section');
        const workoutSelector = document.getElementById('workout-selector');
        
        if (historySection) historySection.classList.add('hidden');
        if (workoutSelector) workoutSelector.classList.remove('hidden');
    }
}

// Create singleton instance
let workoutHistoryInstance = null;

export function getWorkoutHistory(appState) {
    if (!workoutHistoryInstance) {
        workoutHistoryInstance = new WorkoutHistory(appState);
    }
    return workoutHistoryInstance;
}