// Workout History Module - core/workout-history.js
import { loadWorkoutHistory, migrateWorkoutData, saveWorkoutData } from './data-manager.js';
import { showNotification } from './ui-helpers.js';

export function getWorkoutHistory(appState) {
    let currentHistory = [];
    let filteredHistory = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    return {
        currentHistory,
        filteredHistory,
        currentPage,

        initialize() {
            console.log('📊 Workout History initialized');
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
            
            // 🔧 FIX: Update the object properties, not just local variables
            this.currentHistory.splice(0, this.currentHistory.length, ...loadedData);
            this.filteredHistory.splice(0, this.filteredHistory.length, ...loadedData);
            this.currentPage = 1;

            this.renderHistory();

            console.log(`✅ Loaded ${this.currentHistory.length} workout entries`);

        } catch (error) {
            console.error('❌ Error loading workout history:', error);
            showNotification('Error loading workout history', 'error');
        }
    },

        renderHistory() {
            const container = document.getElementById('workout-history-list');
            if (!container) return;

            if (filteredHistory.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <h3>No Workout History</h3>
                        <p>Complete some workouts to see them here!</p>
                    </div>
                `;
                return;
            }

            // Calculate pagination
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageWorkouts = filteredHistory.slice(startIndex, endIndex);

            let historyHTML = '';

            pageWorkouts.forEach(workout => {
                historyHTML += this.createWorkoutHistoryCard(workout);
            });

            container.innerHTML = historyHTML;

            // Update pagination
            this.updatePagination();
        },

        createWorkoutHistoryCard(workout) {
            const date = new Date(workout.date);
            const displayDate = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const duration = workout.totalDuration ? 
                `${Math.floor(workout.totalDuration / 60)}m` : 
                'Unknown';

            let statusBadge = '';
            let statusClass = '';

            switch (workout.status) {
                case 'completed':
                    statusBadge = '<i class="fas fa-check-circle"></i> Completed';
                    statusClass = 'status-completed';
                    break;
                case 'cancelled':
                    statusBadge = '<i class="fas fa-times-circle"></i> Cancelled';
                    statusClass = 'status-cancelled';
                    break;
                default:
                    statusBadge = '<i class="fas fa-clock"></i> Incomplete';
                    statusClass = 'status-incomplete';
            }

            // Generate exercise summary
            let exerciseSummary = '';
            if (workout.exerciseNames && Object.keys(workout.exerciseNames).length > 0) {
                const exerciseList = Object.values(workout.exerciseNames).slice(0, 3);
                exerciseSummary = exerciseList.join(', ');
                if (Object.keys(workout.exerciseNames).length > 3) {
                    exerciseSummary += ` and ${Object.keys(workout.exerciseNames).length - 3} more...`;
                }
            } else if (workout.originalWorkout && workout.originalWorkout.exercises) {
                const exerciseList = workout.originalWorkout.exercises.slice(0, 3).map(ex => ex.machine);
                exerciseSummary = exerciseList.join(', ');
                if (workout.originalWorkout.exercises.length > 3) {
                    exerciseSummary += ` and ${workout.originalWorkout.exercises.length - 3} more...`;
                }
            } else {
                exerciseSummary = 'No exercise details available';
            }

            return `
                <div class="workout-history-card ${statusClass}" onclick="expandWorkoutDetails('${workout.id}')">
                    <div class="workout-history-header">
                        <div class="workout-history-main">
                            <h4>${workout.workoutType}</h4>
                            <div class="workout-history-meta">
                                <span class="workout-date">${displayDate}</span>
                                <span class="workout-duration">${duration}</span>
                                <span class="workout-progress">${workout.progress.completedSets}/${workout.progress.totalSets} sets</span>
                            </div>
                        </div>
                        <div class="workout-history-status">
                            <span class="status-badge ${statusClass}">${statusBadge}</span>
                            <div class="progress-circle">
                                <span>${workout.progress.percentage}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="workout-history-exercises">
                        ${exerciseSummary}
                    </div>
                    ${workout.addedManually ? '<div class="manual-indicator"><i class="fas fa-edit"></i> Added manually</div>' : ''}
                    ${workout.manualNotes ? `<div class="manual-notes">${workout.manualNotes}</div>` : ''}
                    <div class="workout-history-actions">
                        <button class="btn btn-secondary btn-small" onclick="repeatWorkout('${workout.id}'); event.stopPropagation();">
                            <i class="fas fa-redo"></i> Repeat
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="viewWorkoutDetails('${workout.id}'); event.stopPropagation();">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        <!-- FIX: Removed conditional check - delete button now shows for ALL workouts -->
                        <button class="btn btn-danger btn-small" onclick="deleteWorkout('${workout.id}'); event.stopPropagation();">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        },

        updatePagination() {
            const paginationContainer = document.getElementById('history-pagination');
            if (!paginationContainer) return;

            const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

            if (totalPages <= 1) {
                paginationContainer.innerHTML = '';
                return;
            }

            let paginationHTML = `
                <div class="pagination">
                    <button class="btn btn-secondary" ${currentPage === 1 ? 'disabled' : ''} 
                            onclick="workoutHistory.goToPage(${currentPage - 1})">
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
                    <button class="btn btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} 
                            onclick="workoutHistory.goToPage(${currentPage + 1})">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;

            paginationContainer.innerHTML = paginationHTML;
        },

        goToPage(page) {
            const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
            if (page >= 1 && page <= totalPages) {
                currentPage = page;
                this.renderHistory();
            }
        },

        filterHistory(searchQuery = '', workoutType = '', dateRange = null) {
            filteredHistory = currentHistory.filter(workout => {
                // Text search
                const matchesSearch = !searchQuery || 
                    workout.workoutType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (workout.exerciseNames && Object.values(workout.exerciseNames).some(name => 
                        name.toLowerCase().includes(searchQuery.toLowerCase())
                    ));

                // Workout type filter
                const matchesType = !workoutType || workout.workoutType === workoutType;

                // Date range filter
                let matchesDate = true;
                if (dateRange && dateRange.start && dateRange.end) {
                    const workoutDate = new Date(workout.date);
                    const startDate = new Date(dateRange.start);
                    const endDate = new Date(dateRange.end);
                    matchesDate = workoutDate >= startDate && workoutDate <= endDate;
                }

                return matchesSearch && matchesType && matchesDate;
            });

            currentPage = 1;
            this.renderHistory();
        },

        async addManualWorkout(workoutData) {
            if (!appState.currentUser) {
                throw new Error('User not signed in');
            }

            try {
                // Save the workout data
                const success = await saveWorkoutData({ ...appState, savedData: workoutData });
                
                if (success) {
                    // Reload history to include new workout
                    await this.loadHistory();
                    showNotification('Manual workout added successfully!', 'success');
                } else {
                    throw new Error('Failed to save workout data');
                }

            } catch (error) {
                console.error('Error adding manual workout:', error);
                throw error;
            }
        },

        async deleteWorkout(workoutId) {
    if (!appState.currentUser) return;

    const workout = currentHistory.find(w => w.id === workoutId);
    if (!workout) return;

    const confirmDelete = confirm(`Delete workout "${workout.workoutType}" from ${new Date(workout.date).toLocaleDateString()}?\n\nThis cannot be undone.`);
    if (!confirmDelete) return;

    try {
        // Import Firebase functions dynamically
        const { deleteDoc, doc, db } = await import('./firebase-config.js');
        
        // Delete from Firebase
        await deleteDoc(doc(db, "users", appState.currentUser.uid, "workouts", workoutId));

        // Remove from local arrays
        currentHistory = currentHistory.filter(w => w.id !== workoutId);
        filteredHistory = filteredHistory.filter(w => w.id !== workoutId);

        // Re-render
        this.renderHistory();

        showNotification('Workout deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting workout:', error);
        showNotification('Failed to delete workout. Please try again.', 'error');
    }
},

        async repeatWorkout(workoutId) {
            const workout = currentHistory.find(w => w.id === workoutId);
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
            return currentHistory.find(w => w.id === workoutId);
        },

        getStats() {
            const stats = {
                totalWorkouts: currentHistory.length,
                completedWorkouts: currentHistory.filter(w => w.status === 'completed').length,
                totalSets: currentHistory.reduce((sum, w) => sum + w.progress.completedSets, 0),
                averageCompletion: 0,
                favoriteWorkout: null,
                currentStreak: 0
            };

            // Calculate average completion rate
            if (stats.totalWorkouts > 0) {
                const totalCompletion = currentHistory.reduce((sum, w) => sum + w.progress.percentage, 0);
                stats.averageCompletion = Math.round(totalCompletion / stats.totalWorkouts);
            }

            // Find favorite workout type
            const workoutCounts = {};
            currentHistory.forEach(w => {
                workoutCounts[w.workoutType] = (workoutCounts[w.workoutType] || 0) + 1;
            });
            
            let maxCount = 0;
            Object.keys(workoutCounts).forEach(type => {
                if (workoutCounts[type] > maxCount) {
                    maxCount = workoutCounts[type];
                    stats.favoriteWorkout = type;
                }
            });

            // Calculate current streak (consecutive days with completed workouts)
            const sortedCompleted = currentHistory
                .filter(w => w.status === 'completed')
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            let streak = 0;
            let currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            for (const workout of sortedCompleted) {
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

    // Toggle expanded view
    const card = document.querySelector(`[onclick="expandWorkoutDetails('${workoutId}')"]`);
    if (card) {
        card.classList.toggle('expanded');
        
        // Add detailed view if not already present
        let detailsSection = card.querySelector('.workout-details-expanded');
        if (!detailsSection && card.classList.contains('expanded')) {
            detailsSection = document.createElement('div');
            detailsSection.className = 'workout-details-expanded';
            detailsSection.innerHTML = generateWorkoutDetailsHTML(workout);
            card.appendChild(detailsSection);
        } else if (detailsSection && !card.classList.contains('expanded')) {
            detailsSection.remove();
        }
    }
};

window.viewWorkoutDetails = function(workoutId) {
    const workout = window.workoutHistory?.getWorkoutDetails(workoutId);
    if (!workout) return;

    // Create modal with workout details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${workout.workoutType} - ${new Date(workout.date).toLocaleDateString()}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${generateWorkoutDetailsHTML(workout)}
        </div>
    `;

    document.body.appendChild(modal);
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

function generateWorkoutDetailsHTML(workout) {
    let detailsHTML = `
        <div class="workout-details-content">
            <div class="workout-summary">
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span>${new Date(workout.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span>${workout.totalDuration ? `${Math.floor(workout.totalDuration / 60)}m ${workout.totalDuration % 60}s` : 'Unknown'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Progress:</span>
                    <span>${workout.progress.completedSets}/${workout.progress.totalSets} sets (${workout.progress.percentage}%)</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="status-${workout.status}">${workout.status.charAt(0).toUpperCase() + workout.status.slice(1)}</span>
                </div>
            </div>
    `;

    // Exercise details
    if (workout.exercises && Object.keys(workout.exercises).length > 0) {
        detailsHTML += '<div class="exercise-details"><h4>Exercise Details:</h4>';

        Object.keys(workout.exercises).forEach(exerciseKey => {
            const exerciseData = workout.exercises[exerciseKey];
            const exerciseName = workout.exerciseNames?.[exerciseKey] || exerciseKey;

            if (exerciseData.sets && exerciseData.sets.length > 0) {
                const completedSets = exerciseData.sets.filter(set => set && set.reps && set.weight);
                
                detailsHTML += `
                    <div class="exercise-detail-item">
                        <h5>${exerciseName}</h5>
                        <div class="sets-summary">
                `;

                exerciseData.sets.forEach((set, index) => {
                    if (set.reps && set.weight) {
                        detailsHTML += `
                            <span class="set-badge completed">
                                Set ${index + 1}: ${set.reps} × ${set.weight} ${set.originalUnit || 'lbs'}
                            </span>
                        `;
                    }
                });

                detailsHTML += '</div>';

                if (exerciseData.notes) {
                    detailsHTML += `<div class="exercise-notes"><strong>Notes:</strong> ${exerciseData.notes}</div>`;
                }

                detailsHTML += '</div>';
            }
        });

        detailsHTML += '</div>';
    }

    // Manual notes
    if (workout.manualNotes) {
        detailsHTML += `
            <div class="manual-notes-section">
                <h4>Notes:</h4>
                <p>${workout.manualNotes}</p>
            </div>
        `;
    }

    detailsHTML += '</div>';

    return detailsHTML;
}