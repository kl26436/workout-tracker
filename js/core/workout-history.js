// Workout History Module - core/workout-history.js
import { loadWorkoutHistory, migrateWorkoutData, saveWorkoutData } from './data-manager.js';
import { showNotification } from './ui-helpers.js';

export function getWorkoutHistory(appState) {
    let currentHistory = [];
    let filteredHistory = [];
    let currentPage = 1;
    let currentSort = { column: 'date', direction: 'desc' };
    const itemsPerPage = 20;

    return {
        currentHistory,
        filteredHistory,
        currentPage,
        currentSort,

        initialize() {
            console.log('📊 Workout History initialized');
            this.setupEventListeners();
        },

        setupEventListeners() {
            // Search functionality
            const searchInput = document.getElementById('workout-search');
            const clearSearchBtn = document.getElementById('clear-search');

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterHistory(e.target.value);
                });
            }

            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    if (searchInput) searchInput.value = '';
                    this.filterHistory('');
                });
            }

            // Setup sorting functionality
            this.setupSorting();
        },

        setupSorting() {
            const sortableHeaders = document.querySelectorAll('.workout-table th.sortable');
            
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const sortColumn = header.dataset.sort;
                    this.sortTable(sortColumn);
                });
            });
        },

        sortTable(column) {
            // Toggle direction if same column, otherwise default to desc
            if (this.currentSort.column === column) {
                this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSort.column = column;
                this.currentSort.direction = 'desc';
            }

            // Update header visual indicators
            this.updateSortIndicators();

            // Sort the filtered history
            this.applySorting();

            // Re-render
            this.renderHistory();
        },

        updateSortIndicators() {
            // Remove existing sort classes
            document.querySelectorAll('.workout-table th.sortable').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });

            // Add class to current sort column
            const currentHeader = document.querySelector(`[data-sort="${this.currentSort.column}"]`);
            if (currentHeader) {
                currentHeader.classList.add(`sort-${this.currentSort.direction}`);
            }
        },

        applySorting() {
            this.filteredHistory.sort((a, b) => {
                let aValue, bValue;

                switch (this.currentSort.column) {
                    case 'date':
                        aValue = new Date(a.date);
                        bValue = new Date(b.date);
                        break;
                    case 'workout':
                        aValue = a.workoutType.toLowerCase();
                        bValue = b.workoutType.toLowerCase();
                        break;
                    case 'status':
                        aValue = this.getWorkoutStatus(a);
                        bValue = this.getWorkoutStatus(b);
                        break;
                    case 'duration':
                        aValue = this.getWorkoutDuration(a);
                        bValue = this.getWorkoutDuration(b);
                        break;
                    case 'progress':
                        aValue = a.progress?.percentage || 0;
                        bValue = b.progress?.percentage || 0;
                        break;
                    default:
                        return 0;
                }

                if (aValue < bValue) {
                    return this.currentSort.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return this.currentSort.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        },

        getWorkoutStatus(workout) {
            if (workout.completedAt && !workout.cancelledAt) return 'completed';
            if (workout.cancelledAt || workout.status === 'cancelled') return 'cancelled';
            if (workout.status === 'discarded') return 'discarded';
            if (workout.startedAt && !workout.completedAt) return 'in-progress';
            return 'unknown';
        },

        getWorkoutDuration(workout) {
            if (workout.completedAt && workout.startedAt) {
                return new Date(workout.completedAt) - new Date(workout.startedAt);
            }
            return 0;
        },

        formatDuration(durationMs) {
            if (!durationMs || durationMs <= 0) return 'N/A';
            
            const minutes = Math.floor(durationMs / 60000);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) {
                return `${hours}h ${minutes % 60}m`;
            }
            return `${minutes}m`;
        },

        async loadHistory() {
            if (!appState.currentUser) {
                showNotification('Please sign in to view workout history', 'warning');
                return;
            }

            console.log('📊 Loading workout history...');

            try {
                // Migrate old data if needed
                await migrateWorkoutData(appState);

                // Load history
                const loadedData = await loadWorkoutHistory(appState, 100);
                
                // Update the object properties
                this.currentHistory.splice(0, this.currentHistory.length, ...loadedData);
                this.filteredHistory.splice(0, this.filteredHistory.length, ...loadedData);
                this.currentPage = 1;

                // Apply initial sorting (by date, newest first)
                this.applySorting();

                this.renderHistory();

                console.log(`✅ Loaded ${this.currentHistory.length} workout entries`);

            } catch (error) {
                console.error('❌ Error loading workout history:', error);
                showNotification('Error loading workout history', 'error');
            }
        },

        renderHistory() {
            const container = document.getElementById('workout-table-body');
            const emptyState = document.getElementById('empty-workouts');
            
            if (!container) return;

            if (this.filteredHistory.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }

            if (emptyState) emptyState.classList.add('hidden');

            // Calculate pagination
            const startIndex = (this.currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageWorkouts = this.filteredHistory.slice(startIndex, endIndex);

            let tableHTML = '';

            pageWorkouts.forEach(workout => {
                tableHTML += this.createWorkoutTableRow(workout);
            });

            container.innerHTML = tableHTML;

            // Update pagination info if needed
            this.updatePaginationInfo();
        },

        createWorkoutTableRow(workout) {
            // Handle date display properly
            let displayDate;
            if (workout.date) {
                if (workout.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const dateObj = new Date(workout.date + 'T12:00:00');
                    displayDate = dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                } else {
                    const dateObj = new Date(workout.date);
                    displayDate = dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                }
            } else {
                displayDate = 'Unknown Date';
            }

            const duration = this.formatDuration(this.getWorkoutDuration(workout)) || 'Quick session';
            const status = this.getWorkoutStatus(workout);
            const progress = workout.progress || {};
            const completedSets = progress.completedSets || 0;
            const totalSets = progress.totalSets || workout.originalWorkout?.exercises?.length * 3 || 0;
            const progressPercentage = progress.percentage || 0;

            // Determine exercise count
            let exerciseCount = 0;
            if (workout.originalWorkout?.exercises) {
                exerciseCount = workout.originalWorkout.exercises.length;
            } else if (workout.exerciseNames) {
                exerciseCount = Object.keys(workout.exerciseNames).length;
            }

            // Determine action button based on status
            let actionButton;
            let actionClass;
            if (status === 'incomplete') {
                actionButton = '<i class="fas fa-play"></i>';
                actionClass = 'action-resume';
            } else if (status === 'completed') {
                actionButton = '<i class="fas fa-eye"></i>';
                actionClass = 'action-view';
            } else if (status === 'cancelled') {
                actionButton = '<i class="fas fa-redo"></i>';
                actionClass = 'action-retry';
            } else {
                actionButton = '<i class="fas fa-redo"></i>';
                actionClass = 'action-repeat';
            }

            // Create status badge
            const statusBadge = `
                <div class="simple-status ${status}">
                    <i class="fas fa-${status === 'completed' ? 'check-circle' : status === 'incomplete' ? 'pause-circle' : 'times-circle'}"></i>
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
            `;

            return `
                <tr onclick="viewWorkoutDetails('${workout.id}')">
                    <td>
                        <div class="workout-info">
                            <div class="workout-name">${workout.workoutType}</div>
                            <div class="workout-meta">
                                <div class="meta-item">
                                    <i class="fas fa-calendar"></i>
                                    <span>${displayDate}</span>
                                </div>
                                <div class="meta-item">
                                    <i class="fas fa-clock"></i>
                                    <span>${duration}</span>
                                </div>
                                <div class="meta-item">
                                    <i class="fas fa-dumbbell"></i>
                                    <span>${exerciseCount} exercises</span>
                                </div>
                            </div>
                            <!-- Mobile status bar (hidden on desktop) -->
                            <div class="mobile-status-bar">
                                <div class="mobile-status">
                                    <i class="fas fa-${status === 'completed' ? 'check-circle' : status === 'incomplete' ? 'pause-circle' : 'times-circle'}" style="color: var(--${status === 'completed' ? 'success' : status === 'incomplete' ? 'warning' : 'danger'});"></i>
                                    <span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                                </div>
                                <div class="mobile-progress">
                                    <div class="mobile-progress-circle" style="--progress: ${progressPercentage}">${progressPercentage}%</div>
                                    <span>${completedSets}/${totalSets} sets</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${statusBadge}
                    </td>
                    <td>
                        <div class="simple-progress">
                            <div class="progress-circle" style="--progress: ${progressPercentage}">
                                <div class="progress-text">${progressPercentage}%</div>
                            </div>
                            <div class="progress-details">${completedSets}/${totalSets} sets</div>
                        </div>
                    </td>
                    <td class="simple-action">
                        <div class="action-buttons">
                            <button class="action-btn ${actionClass}" onclick="event.stopPropagation(); ${actionClass.replace('action-', '')}Workout('${workout.id}');">
                                ${actionButton}
                            </button>
                            <button class="action-btn action-delete" onclick="event.stopPropagation(); deleteWorkout('${workout.id}');">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        },

        updatePaginationInfo() {
            // Simple pagination info - could be expanded later if needed
            const totalWorkouts = this.filteredHistory.length;
            const startIndex = (this.currentPage - 1) * itemsPerPage + 1;
            const endIndex = Math.min(this.currentPage * itemsPerPage, totalWorkouts);
            
            console.log(`Showing ${startIndex}-${endIndex} of ${totalWorkouts} workouts`);
        },

        filterHistory(searchQuery = '') {
            this.filteredHistory = this.currentHistory.filter(workout => {
                if (!searchQuery.trim()) return true;
                
                const query = searchQuery.toLowerCase();
                
                // Search in workout type
                if (workout.workoutType.toLowerCase().includes(query)) return true;
                
                // Search in exercise names
                if (workout.exerciseNames) {
                    const exerciseValues = Object.values(workout.exerciseNames);
                    if (exerciseValues.some(name => name.toLowerCase().includes(query))) return true;
                }
                
                // Search in original workout exercises
                if (workout.originalWorkout?.exercises) {
                    if (workout.originalWorkout.exercises.some(ex => 
                        ex.machine?.toLowerCase().includes(query) || 
                        ex.exercise?.toLowerCase().includes(query)
                    )) return true;
                }

                // Search in manual notes
                if (workout.manualNotes?.toLowerCase().includes(query)) return true;

                // Search in status
                if (this.getWorkoutStatus(workout).toLowerCase().includes(query)) return true;

                return false;
            });

            // Re-apply sorting
            this.applySorting();

            // Reset to first page
            this.currentPage = 1;

            // Re-render
            this.renderHistory();
        },

        async deleteWorkout(workoutId) {
            if (!appState.currentUser) return;

            const workout = this.currentHistory.find(w => w.id === workoutId);
            if (!workout) return;

            const confirmDelete = confirm(`Delete workout "${workout.workoutType}" from ${new Date(workout.date).toLocaleDateString()}?\n\nThis cannot be undone.`);
            if (!confirmDelete) return;

            try {
                // Import Firebase functions dynamically
                const { deleteDoc, doc, db } = await import('./firebase-config.js');
                
                // Delete from Firebase
                await deleteDoc(doc(db, "users", appState.currentUser.uid, "workouts", workoutId));

                // Remove from local arrays
                this.currentHistory = this.currentHistory.filter(w => w.id !== workoutId);
                this.filteredHistory = this.filteredHistory.filter(w => w.id !== workoutId);

                // Re-render
                this.renderHistory();

                showNotification('Workout deleted successfully', 'success');

            } catch (error) {
                console.error('Error deleting workout:', error);
                showNotification('Failed to delete workout. Please try again.', 'error');
            }
        },

        async repeatWorkout(workoutId) {
            const workout = this.currentHistory.find(w => w.id === workoutId);
            if (!workout || !workout.originalWorkout) {
                showNotification('Cannot repeat this workout - missing workout data', 'error');
                return;
            }

            try {
                // Create a new workout based on the original
                const newWorkout = {
                    day: workout.originalWorkout.day,
                    exercises: workout.originalWorkout.exercises.map(ex => ({...ex}))
                };

                // Hide history and start workout
                document.getElementById('workout-history-section')?.classList.add('hidden');
                
                // Import the selectWorkout function and start the workout
                const selectWorkout = window.selectWorkout;
                if (selectWorkout) {
                    await selectWorkout(newWorkout.day, null, newWorkout);
                    showNotification(`Starting "${workout.workoutType}" workout!`, 'success');
                } else {
                    console.error('selectWorkout function not found');
                    showNotification('Error starting workout', 'error');
                }

            } catch (error) {
                console.error('Error repeating workout:', error);
                showNotification('Failed to repeat workout', 'error');
            }
        },

        getWorkoutDetails(workoutId) {
            return this.currentHistory.find(w => w.id === workoutId);
        },

        getStats() {
            const stats = {
                totalWorkouts: this.currentHistory.length,
                completedWorkouts: 0,
                totalDuration: 0,
                currentStreak: 0,
                averageProgress: 0
            };

            this.currentHistory.forEach(workout => {
                if (workout.completedAt && !workout.cancelledAt) {
                    stats.completedWorkouts++;
                    
                    if (workout.startedAt && workout.completedAt) {
                        stats.totalDuration += new Date(workout.completedAt) - new Date(workout.startedAt);
                    }
                }
                
                if (workout.progress?.percentage) {
                    stats.averageProgress += workout.progress.percentage;
                }
            });

            if (stats.totalWorkouts > 0) {
                stats.averageProgress = Math.round(stats.averageProgress / stats.totalWorkouts);
            }

            // Calculate current streak
            const completedWorkouts = this.currentHistory
                .filter(w => w.completedAt && !w.cancelledAt)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            let streak = 0;
            let currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            for (const workout of completedWorkouts) {
                const workoutDate = new Date(workout.date);
                workoutDate.setHours(0, 0, 0, 0);
                
                const daysDiff = Math.floor((currentDate - workoutDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === streak) {
                    streak++;
                    currentDate.setDate(currentDate.getDate() - 1);
                } else if (daysDiff > streak) {
                    break;
                }
            }

            stats.currentStreak = streak;
            return stats;
        }
    };
}

// Global functions for workout history
window.expandWorkoutDetails = function(workoutId) {
    const workout = window.workoutHistory?.getWorkoutDetails(workoutId);
    if (!workout) return;

    // Toggle expanded view logic could be added here
    console.log('Expanding workout details for:', workoutId);
};

window.viewWorkoutDetails = function(workoutId) {
    const workout = window.workoutHistory?.getWorkoutDetails(workoutId);
    if (!workout) return;

    // Create a detailed modal or expand inline
    console.log('Viewing workout details for:', workout.workoutType);
    
    // For now, just show an alert with basic details
    const details = `
Workout: ${workout.workoutType}
Date: ${new Date(workout.date).toLocaleDateString()}
Status: ${window.workoutHistory.getWorkoutStatus(workout)}
Progress: ${workout.progress?.completedSets || 0}/${workout.progress?.totalSets || 0} sets (${workout.progress?.percentage || 0}%)
${workout.manualNotes ? `Notes: ${workout.manualNotes}` : ''}
    `.trim();
    
    alert(details);
};

window.repeatWorkout = function(workoutId) {
    if (window.workoutHistory) {
        window.workoutHistory.repeatWorkout(workoutId);
    }
};

window.deleteWorkout = function(workoutId) {
    if (window.workoutHistory) {
        window.workoutHistory.deleteWorkout(workoutId);
    }
};