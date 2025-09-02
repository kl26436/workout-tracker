// Clean Workout History Module with Calendar View - core/workout-history.js
import { showNotification } from './ui-helpers.js';

export function getWorkoutHistory(appState) {
    let currentHistory = [];
    let filteredHistory = [];
    
    // Calendar-specific state
    let currentCalendarDate = new Date();
    let calendarWorkouts = {};
    let firstWorkoutDate = null; // Track the earliest workout date

    return {
        currentHistory,
        filteredHistory,
        currentCalendarDate,
        calendarWorkouts,
        firstWorkoutDate,

        initialize() {
            console.log('📊 Workout History initialized with calendar view');
            this.setupEventListeners();
        },

        setupEventListeners() {
            // Search functionality
            const searchInput = document.querySelector('.search-input');
            const clearSearchBtn = document.querySelector('#clear-search');

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

            // Setup modal close handler
            const modal = document.getElementById('workoutModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeWorkoutDetailModal();
                    }
                });
            }
        },

        // Core data loading
        async loadHistory() {
            if (!appState.currentUser) return;

            try {
                const { FirebaseWorkoutManager } = await import('./firebase-workout-manager.js');
                const workoutManager = new FirebaseWorkoutManager(appState);
                
                this.currentHistory = await workoutManager.getUserWorkouts();
                this.filteredHistory = [...this.currentHistory];

                // Find the earliest workout date
                if (this.currentHistory.length > 0) {
                    const dates = this.currentHistory
                        .map(workout => workout.date)
                        .filter(date => date) // Remove null/undefined dates
                        .sort();
                    
                    if (dates.length > 0) {
                        this.firstWorkoutDate = dates[0];
                        console.log(`📅 First workout date found: ${this.firstWorkoutDate}`);
                    }
                }

                console.log(`✅ Loaded ${this.currentHistory.length} workout entries`);

            } catch (error) {
                console.error('❌ Error loading workout history:', error);
                showNotification('Error loading workout history', 'error');
            }
        },

        // Calendar Methods
        async initializeCalendar() {
            await this.loadHistory();
            await this.loadCalendarWorkouts();
            this.updateCalendarDisplay();
        },

        async loadCalendarWorkouts() {
            if (!appState.currentUser) return;
            
            try {
                const year = this.currentCalendarDate.getFullYear();
                const month = this.currentCalendarDate.getMonth();
                
                console.log(`🗓️ Loading workouts for ${year}-${month + 1}`);
                
                // Clear existing calendar workouts
                this.calendarWorkouts = {};
                
                this.currentHistory.forEach(workout => {
                    if (!workout.date) {
                        console.warn('Workout missing date:', workout);
                        return;
                    }
                    
                    // FIX: Handle date parsing correctly to avoid timezone issues
                    let workoutDate;
                    if (typeof workout.date === 'string') {
                        // If it's a date string like "2025-09-01", parse it as local date
                        const dateParts = workout.date.split('-');
                        if (dateParts.length === 3) {
                            // Create date in local timezone to avoid offset issues
                            workoutDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                        } else {
                            // Fallback to regular parsing
                            workoutDate = new Date(workout.date);
                        }
                    } else {
                        // Handle Date objects or timestamps
                        workoutDate = new Date(workout.date);
                    }
                    
                    // Check if this workout is in the current calendar month
                    if (workoutDate.getFullYear() === year && workoutDate.getMonth() === month) {
                        // Use the original date string as the key to avoid timezone conversion
                        const dateKey = workout.date.split('T')[0]; // Remove time component if present
                        this.calendarWorkouts[dateKey] = this.formatWorkoutForCalendar(workout);
                        
                        console.log(`Added workout: ${dateKey} - ${workout.workoutType}`);
                    }
                });
                
                console.log(`✅ Loaded ${Object.keys(this.calendarWorkouts).length} workouts for calendar`);
                console.log('Calendar workouts:', Object.keys(this.calendarWorkouts));
                
            } catch (error) {
                console.error('❌ Error loading calendar workouts:', error);
            }
        },

        formatWorkoutForCalendar(workout) {
            // Determine workout category
            let category = 'other';
            const workoutType = workout.workoutType?.toLowerCase() || '';
            
            if (workoutType.includes('push') || workoutType.includes('chest') || workoutType.includes('shoulder') || workoutType.includes('tricep')) {
                category = 'push';
            } else if (workoutType.includes('pull') || workoutType.includes('back') || workoutType.includes('bicep')) {
                category = 'pull';
            } else if (workoutType.includes('leg') || workoutType.includes('quad') || workoutType.includes('glute') || workoutType.includes('hamstring')) {
                category = 'legs';
            } else if (workoutType.includes('cardio') || workoutType.includes('core')) {
                category = 'cardio';
            }
            
            // Determine status
            let status = 'completed';
            if (workout.cancelledAt) {
                status = 'cancelled';
            } else if (workout.progress && workout.progress.percentage < 100) {
                status = 'partial';
            }
            
            // FIX: Duration calculation - handle both minutes and milliseconds
            const duration = this.formatDuration(this.getWorkoutDuration(workout)) || 'Quick session';
            
            // Convert exercise data
            const exercises = [];
            if (workout.exercises && workout.exerciseNames) {
                Object.keys(workout.exercises).forEach(exerciseKey => {
                    const exerciseData = workout.exercises[exerciseKey];
                    const exerciseName = workout.exerciseNames[exerciseKey] || exerciseKey;
                    
                    if (exerciseData && exerciseData.sets) {
                        exercises.push({
                            name: exerciseName,
                            sets: exerciseData.sets.filter(set => set && (set.reps || set.weight)),
                            notes: exerciseData.notes || ''
                        });
                    }
                });
            }
            
            return {
                name: workout.workoutType || 'Workout',
                category: category,
                status: status,
                progress: workout.progress?.percentage || (status === 'completed' ? 100 : 0),
                duration: duration,
                exercises: exercises,
                rawData: workout
            };
        },

        previousMonth() {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
            this.initializeCalendar();
        },

        nextMonth() {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
            this.initializeCalendar();
        },

        updateCalendarDisplay() {
            const monthName = this.currentCalendarDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
            });
            const monthElement = document.getElementById('currentMonth');
            if (monthElement) {
                monthElement.textContent = monthName;
            }
            
            this.generateCalendarGrid();
        },

      generateCalendarGrid() {
            const calendarGrid = document.getElementById('calendarGrid');
            if (!calendarGrid) return;
            
            const year = this.currentCalendarDate.getFullYear();
            const month = this.currentCalendarDate.getMonth();
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
            
            // Get today's date in local timezone for proper comparison
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            let html = '';
            let currentDate = new Date(startDate);
            
            // Generate 6 weeks (42 days) to fill calendar grid
            for (let i = 0; i < 42; i++) {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const isCurrentMonth = currentDate.getMonth() === month;
                const isToday = dateStr === todayStr;
                const isFutureDate = currentDate > today;
                
                // Check if this date is before the first workout
                const isBeforeFirstWorkout = this.firstWorkoutDate ? dateStr < this.firstWorkoutDate : false;
                
                const workout = this.calendarWorkouts[dateStr];
                
                let dayClass = 'calendar-day';
                if (!isCurrentMonth) {
                    dayClass += ' other-month empty-day'; // Add empty-day class for styling
                }
                if (isToday) dayClass += ' today';
                
                html += `<div class="${dayClass}"`;
                
                if (workout && isCurrentMonth) {
                    html += ` onclick="workoutHistory.showWorkoutDetail('${dateStr}', '${workout.name}')"`;
                }
                
                html += `>`;
                
                // Only show content for current month days
                if (isCurrentMonth) {
                    html += `<div class="day-number">${currentDate.getDate()}</div>`;
                    
                    if (workout) {
                        html += this.getWorkoutIcon(workout);
                        html += `<div class="workout-status status-${workout.status}">
                            ${workout.status === 'completed' ? 'Complete' : workout.progress + '%'}
                        </div>`;
                    } else if (!isFutureDate && !isBeforeFirstWorkout) {
                        // Only show red X for past dates that are AFTER the first workout date
                        html += `<div class="no-workout">
                            <i class="fas fa-times"></i>
                        </div>`;
                    }
                }
                // Other month days are completely empty
                
                html += '</div>';
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            calendarGrid.innerHTML = html;
},

        getWorkoutIcon(workout) {
            const iconMap = {
                'push': '<i class="fas fa-hand-paper"></i>',
                'pull': '<i class="fas fa-fist-raised"></i>', 
                'legs': '<i class="fas fa-walking"></i>',
                'cardio': '<i class="fas fa-heartbeat"></i>',
                'core': '<i class="fas fa-heartbeat"></i>',
                'other': '<i class="fas fa-dumbbell"></i>'
            };
            
            const icon = iconMap[workout.category] || iconMap['other'];
            return `<div class="workout-icon ${workout.category}">${icon}</div>`;
        },

        showWorkoutDetail(date, workoutName) {
        const modal = document.getElementById('workoutModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        
        if (!modal || !title || !body) return;
        
        // FIXED: Create timezone-safe date display
        let displayDate;
        if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Add noon time to prevent timezone shift
            const safeDate = new Date(date + 'T12:00:00');
            displayDate = safeDate.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
        } else {
            displayDate = 'Unknown Date';
        }
        title.textContent = `${workoutName} - ${displayDate}`;
        
        const workout = this.calendarWorkouts[date];
        if (!workout) {
            body.innerHTML = '<p>No workout data available for this date.</p>';
            modal.style.display = 'flex';
            return;
        }
        
        body.innerHTML = this.generateWorkoutDetailHTML(workout, date);
        modal.style.display = 'flex';
    },

        generateWorkoutDetailHTML(workout, date) {
            let exerciseHTML = '';
            
            if (workout.exercises && workout.exercises.length > 0) {
                workout.exercises.forEach(exercise => {
                    exerciseHTML += `
                        <div style="background: var(--bg-tertiary); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid var(--border);">
                            <h4 style="color: var(--primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-trophy" style="color: var(--warning);"></i>
                                ${exercise.name}
                            </h4>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Set</th>
                                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Reps</th>
                                        <th style="text-align: left; padding: 0.75rem; color: var(--text-secondary);">Weight</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                    
                    if (exercise.sets && exercise.sets.length > 0) {
                        exercise.sets.forEach((set, index) => {
                            if (set && (set.reps || set.weight)) {
                                exerciseHTML += `
                                    <tr style="background: rgba(40, 167, 69, 0.1); border-bottom: 1px solid rgba(40, 167, 69, 0.2);">
                                        <td style="padding: 0.75rem; color: var(--text-primary);">Set ${index + 1}</td>
                                        <td style="padding: 0.75rem; color: var(--text-primary);">${set.reps || '-'}</td>
                                        <td style="padding: 0.75rem; color: var(--text-primary);">${set.weight ? set.weight + ' lbs' : '-'}</td>
                                    </tr>`;
                            }
                        });
                    } else {
                        exerciseHTML += `
                            <tr>
                                <td colspan="3" style="padding: 2rem; text-align: center; color: var(--text-secondary); font-style: italic;">No sets recorded</td>
                            </tr>`;
                    }
                    
                    exerciseHTML += `</tbody></table>`;
                    
                    if (exercise.notes) {
                        exerciseHTML += `
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; margin-top: 1rem; border-left: 3px solid var(--primary);">
                                <strong style="color: var(--primary); display: block; margin-bottom: 0.5rem;">Notes:</strong>
                                <span style="color: var(--text-primary);">${exercise.notes}</span>
                            </div>`;
                    }
                    
                    exerciseHTML += `</div>`;
                });
            } else {
                exerciseHTML = `
                    <div style="background: var(--bg-tertiary); padding: 2rem; border-radius: 8px; text-align: center; color: var(--text-secondary);">
                        <i class="fas fa-dumbbell" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No exercise data available for this workout.</p>
                    </div>`;
            }
            
            // Add manual workout notes if they exist
            let notesSection = '';
            if (workout.rawData && workout.rawData.manualNotes) {
                notesSection = `
                    <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 3px solid var(--info);">
                        <strong style="color: var(--info); display: block; margin-bottom: 0.5rem;">Workout Notes:</strong>
                        <span style="color: var(--text-primary);">${workout.rawData.manualNotes}</span>
                    </div>`;
            }
            
            return `
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 1rem;">
                        <strong style="color: var(--text-secondary);">Status:</strong>
                        <span style="color: var(--success);">${workout.status.charAt(0).toUpperCase() + workout.status.slice(1)}</span>
                        <strong style="color: var(--text-secondary);">Duration:</strong>
                        <span style="color: var(--text-primary);">${workout.duration || 'Unknown'}</span>
                        <strong style="color: var(--text-secondary);">Progress:</strong>
                        <span style="color: var(--text-primary);">${workout.progress || 0}%</span>
                    </div>
                </div>
                ${notesSection}
                <div style="margin-bottom: 1rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Exercises & Sets</h3>
                    ${exerciseHTML}
                </div>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="workoutHistory.repeatWorkout('${date}')">
                        <i class="fas fa-redo"></i> Repeat Workout
                    </button>
                    <button class="btn btn-primary">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            `;
        },

        closeWorkoutDetailModal() {
            const modal = document.getElementById('workoutModal');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        // Search functionality adapted for calendar
        filterHistory(searchTerm) {
            if (!searchTerm || searchTerm.trim() === '') {
                this.filteredHistory = [...this.currentHistory];
                return;
            }

            const query = searchTerm.toLowerCase().trim();
            this.filteredHistory = this.currentHistory.filter(workout => {
                if (!workout) return false;

                // Search in workout type/name
                if (workout.workoutType?.toLowerCase().includes(query)) return true;

                // Search in date
                if (workout.date?.includes(query)) return true;

                // Search in exercise names
                if (workout.exerciseNames) {
                    const exerciseValues = Object.values(workout.exerciseNames);
                    if (exerciseValues.some(name => name.toLowerCase().includes(query))) return true;
                }

                // Search in manual notes
                if (workout.manualNotes?.toLowerCase().includes(query)) return true;

                // Search in status
                if (this.getWorkoutStatus(workout).toLowerCase().includes(query)) return true;

                return false;
            });

            // Note: Calendar doesn't re-render on search like table view would
            console.log(`Filtered to ${this.filteredHistory.length} workouts`);
        },

        // Workout management functions
        async deleteWorkout(workoutId) {
            if (!appState.currentUser) return;

            const workout = this.currentHistory.find(w => w.id === workoutId);
            if (!workout) return;

            const confirmDelete = confirm(`Delete workout "${workout.workoutType}" from ${new Date(workout.date).toLocaleDateString()}?\n\nThis cannot be undone.`);
            if (!confirmDelete) return;

            try {
                const { deleteDoc, doc, db } = await import('./firebase-config.js');
                await deleteDoc(doc(db, "users", appState.currentUser.uid, "workouts", workoutId));

                // Remove from local arrays
                this.currentHistory = this.currentHistory.filter(w => w.id !== workoutId);
                this.filteredHistory = this.filteredHistory.filter(w => w.id !== workoutId);

                // Refresh calendar if currently shown
                await this.loadCalendarWorkouts();
                this.generateCalendarGrid();

                showNotification('Workout deleted successfully', 'success');

            } catch (error) {
                console.error('Error deleting workout:', error);
                showNotification('Failed to delete workout. Please try again.', 'error');
            }
        },

        repeatWorkout(date) {
            const workout = this.calendarWorkouts[date];
            if (!workout) return;

            console.log('Repeat workout:', workout);
            this.closeWorkoutDetailModal();
            
            // TODO: Implement repeat workout functionality
            showNotification('Repeat workout functionality coming soon!', 'info');
        },

        // Helper functions
        getWorkoutStatus(workout) {
            if (workout.cancelledAt) return 'cancelled';
            if (workout.completedAt) return 'completed';
            if (workout.progress && workout.progress.percentage < 100) return 'partial';
            return 'incomplete';
        },

        getWorkoutDuration(workout) {
    // Method 1: Use stored totalDuration (in seconds)
        if (workout.totalDuration && workout.totalDuration > 0) {
            return workout.totalDuration * 1000; // Convert to milliseconds
        }
        
        // Method 2: Calculate from timestamps (multiple field name variations)
        const startTime = workout.startedAt || workout.startTime;
        const endTime = workout.completedAt || workout.finishedAt;
        
        if (startTime && endTime) {
            return new Date(endTime) - new Date(startTime);
        }
        
        // Method 3: If workout is completed but no duration, estimate based on sets
        if (workout.completedAt && workout.exercises) {
            const totalSets = Object.values(workout.exercises).reduce((count, exercise) => {
                return count + (exercise.sets ? exercise.sets.filter(set => set.reps && set.weight).length : 0);
            }, 0);
            
            // Estimate 2 minutes per set (reasonable assumption)
            if (totalSets > 0) {
                return totalSets * 2 * 60 * 1000; // Convert to milliseconds
            }
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
 };
}