fetch('workouts.json')
  .then(res => res.json())
  .then(data => {
    const list = document.getElementById('workout-list');
    data.exercises.forEach((exercise, idx) => {
      const card = document.createElement('div');
      card.className = 'exercise-card';

      const header = document.createElement('h3');
      header.textContent = `${exercise.machine}`;

      const details = document.createElement('p');
      details.textContent = `Sets: ${exercise.sets}, Reps: ${exercise.reps}, Weight: ${exercise.weight} lbs`;

      const link = document.createElement('a');
      link.href = exercise.video;
      link.target = '_blank';
      link.textContent = 'Watch Form Video';

      const notes = document.createElement('textarea');
      notes.placeholder = 'Notes...';

      const toggle = document.createElement('button');
      toggle.textContent = 'Mark as Complete';
      toggle.onclick = () => {
        card.classList.toggle('completed');
      };

      card.appendChild(header);
      card.appendChild(details);
      card.appendChild(link);
      card.appendChild(document.createElement('br'));
      card.appendChild(notes);
      card.appendChild(document.createElement('br'));
      card.appendChild(toggle);

      list.appendChild(card);
    });
  });
