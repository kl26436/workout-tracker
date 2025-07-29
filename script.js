let workouts = [];
const workoutList = document.getElementById('workout-list');
const daySelect = document.getElementById('daySelect');

const todayDate = new Date().toISOString().split("T")[0];
const currentWeekday = new Date().toLocaleString("en-US", { weekday: "long" });

// Set default dropdown value
daySelect.value = currentWeekday;

// Load workouts.json
fetch('workouts.json')
  .then(res => res.json())
  .then(data => {
    workouts = data;
    loadWorkoutForDay(currentWeekday);
  });

// When dropdown changes
daySelect.addEventListener('change', () => {
  const selectedDay = daySelect.value;
  loadWorkoutForDay(selectedDay);
});

function loadWorkoutForDay(day) {
  workoutList.innerHTML = ""; // Clear old content
  const storageKey = `workout_${todayDate}_${day}`;
  const savedData = JSON.parse(localStorage.getItem(storageKey) || "{}");

  const workout = workouts.find(w => w.day === day);

  if (!workout) {
    workoutList.innerHTML = `<p>No workout scheduled for ${day}.</p>`;
    return;
  }

  workout.exercises.forEach((exercise) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const header = document.createElement('h3');
    header.textContent = exercise.machine;

    const videoLink = document.createElement('a');
    videoLink.href = exercise.video;
    videoLink.target = '_blank';
    videoLink.textContent = 'Watch Form Video';

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = "<th>Set</th><th>Reps</th><th>Weight (lbs)</th>";
    table.appendChild(headerRow);

    const inputRows = [];

    for (let i = 1; i <= exercise.sets; i++) {
      const row = document.createElement('tr');
      const setCell = document.createElement('td');
      setCell.textContent = `Set ${i}`;

      const repsCell = document.createElement('td');
      const repsInput = document.createElement('input');
      repsInput.type = 'number';
      repsInput.min = 0;
      repsInput.placeholder = exercise.reps;

      const weightCell = document.createElement('td');
      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.min = 0;
      weightInput.placeholder = exercise.weight;

      const savedSets = savedData[exercise.machine];
      if (savedSets && savedSets[i - 1]) {
        repsInput.value = savedSets[i - 1].reps;
        weightInput.value = savedSets[i - 1].weight;
      }

      inputRows.push({ repsInput, weightInput });

      repsCell.appendChild(repsInput);
      weightCell.appendChild(weightInput);
      row.appendChild(setCell);
      row.appendChild(repsCell);
      row.appendChild(weightCell);
      table.appendChild(row);
    }

    const notes = document.createElement('textarea');
    notes.placeholder = 'Notes...';

    const toggle = document.createElement('button');
    toggle.textContent = 'Mark as Complete';
    toggle.onclick = () => {
      const log = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const setsData = inputRows.map(({ repsInput, weightInput }) => ({
        reps: repsInput.value,
        weight: weightInput.value
      }));
      log[exercise.machine] = setsData;
      localStorage.setItem(storageKey, JSON.stringify(log));
      card.classList.add('completed');
      toggle.textContent = 'Saved!';
    };

    card.appendChild(header);
    card.appendChild(videoLink);
    card.appendChild(table);
    card.appendChild(notes);
    card.appendChild(toggle);
    workoutList.appendChild(card);
  });
}
