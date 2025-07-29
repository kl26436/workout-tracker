let workouts = [];
const workoutList = document.getElementById('workout-list');
const daySelect = document.getElementById('daySelect');

const todayDate = new Date().toISOString().split("T")[0];
const currentWeekday = new Date().toLocaleString("en-US", { weekday: "long" });
daySelect.value = currentWeekday;

fetch('workouts.json')
  .then(res => res.json())
  .then(data => {
    workouts = data;
    loadWorkoutForDay(currentWeekday);
  });

daySelect.addEventListener('change', () => {
  const selectedDay = daySelect.value;
  loadWorkoutForDay(selectedDay);
});

function loadWorkoutForDay(day) {
  workoutList.innerHTML = "";
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
    headerRow.innerHTML = "<th>Set</th><th>Reps</th><th>Weight (lbs)</th><th>Timer</th>";
    table.appendChild(headerRow);

    const inputRows = [];
    const savedSets = savedData[exercise.machine] || [];

    for (let i = 1; i <= exercise.sets; i++) {
      const row = document.createElement('tr');

      const setCell = document.createElement('td');
      setCell.textContent = `Set ${i}`;

      const repsInput = document.createElement('input');
      repsInput.type = 'number';
      repsInput.min = 0;
      repsInput.placeholder = exercise.reps;
      if (savedSets[i - 1]?.reps) repsInput.value = savedSets[i - 1].reps;

      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.min = 0;
      weightInput.placeholder = exercise.weight;
      if (savedSets[i - 1]?.weight) weightInput.value = savedSets[i - 1].weight;

      const timerCell = document.createElement('td');
      const timerDiv = document.createElement('div');
      timerCell.appendChild(timerDiv);

      function saveAndStartTimer() {
        const currentLog = JSON.parse(localStorage.getItem(storageKey) || "{}");
        const setsData = currentLog[exercise.machine] || [];

        setsData[i - 1] = {
          reps: repsInput.value,
          weight: weightInput.value
        };
        currentLog[exercise.machine] = setsData;
        localStorage.setItem(storageKey, JSON.stringify(currentLog));

        startTimer(timerDiv, 30); // 30 second rest
      }

      repsInput.addEventListener('change', saveAndStartTimer);
      weightInput.addEventListener('change', saveAndStartTimer);

      const repsCell = document.createElement('td');
      const weightCell = document.createElement('td');

      repsCell.appendChild(repsInput);
      weightCell.appendChild(weightInput);

      row.appendChild(setCell);
      row.appendChild(repsCell);
      row.appendChild(weightCell);
      row.appendChild(timerCell);
      table.appendChild(row);

      inputRows.push({ repsInput, weightInput });
    }

    const notes = document.createElement('textarea');
    notes.placeholder = 'Notes...';
    notes.value = savedData[`${exercise.machine}_notes`] || "";
    notes.addEventListener('input', () => {
      const currentLog = JSON.parse(localStorage.getItem(storageKey) || "{}");
      currentLog[`${exercise.machine}_notes`] = notes.value;
      localStorage.setItem(storageKey, JSON.stringify(currentLog));
    });

    card.appendChild(header);
    card.appendChild(videoLink);
    card.appendChild(table);
    card.appendChild(notes);
    workoutList.appendChild(card);
  });
}

function startTimer(container, seconds) {
  clearInterval(container._interval); // cancel previous
  let timeLeft = seconds;
  container.textContent = `Rest: ${timeLeft}s`;

  container._interval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      container.textContent = `Rest: ${timeLeft}s`;
    } else {
      container.textContent = "Rest Over!";
      clearInterval(container._interval);
    }
  }, 1000);
}