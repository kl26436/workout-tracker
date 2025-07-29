import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6",
  storageBucket: "workout-tracker-b94b6.firebasestorage.app",
  messagingSenderId: "111958991290",
  appId: "1:111958991290:web:23e1014ab2ba27df6ebd83",
  measurementId: "G-WX999ZQKEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let workouts = [];
let currentUserId = null;

const workoutList = document.getElementById("workout-list");
const daySelect = document.getElementById("daySelect");

// 📅 Create + insert date picker
const dateInput = document.createElement("input");
dateInput.type = "date";
dateInput.id = "datePicker";
dateInput.value = new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split("T")[0];
daySelect.insertAdjacentElement("afterend", dateInput);

const todayDate = () => dateInput.value;
const weekdayName = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day); // forces local time
  return localDate.toLocaleString("en-US", { weekday: "long" });
};

dateInput.addEventListener("change", () => {
  const day = weekdayName(todayDate());
 const defaultDay = weekdayName(todayDate());
const matchingOption = Array.from(daySelect.options).find(opt =>
  opt.value.toLowerCase().trim() === defaultDay.toLowerCase().trim()
);
if (matchingOption) {
  daySelect.value = matchingOption.value;
  loadWorkoutForDay(matchingOption.value);
} else {
  loadWorkoutForDay("Monday"); // fallback
}

});

daySelect.addEventListener("change", () => {
  const selectedDay = daySelect.value;
  const current = new Date(dateInput.value);
  const currentWeekday = current.getDay(); // Sunday = 0

  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const targetWeekday = dayMap[selectedDay];
  const diff = targetWeekday - currentWeekday;

  const newDate = new Date(current);
  newDate.setDate(current.getDate() + diff);

  dateInput.value = newDate.toISOString().split("T")[0];

  loadWorkoutForDay(selectedDay);
});

});

signInAnonymously(auth).catch((error) =>
  console.error("Firebase auth error:", error)
);

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    fetch("workouts.json")
      .then((res) => res.json())
      .then((data) => {
        workouts = data;
        daySelect.value = weekdayName(todayDate());
        loadWorkoutForDay(daySelect.value);
      });
  }
});

async function loadWorkoutForDay(day) {
  workoutList.innerHTML = "";
  console.log("🔍 Trying to load workout for:", day);
console.log("📅 Available days:", workouts.map(w => w.day));

const workout = workouts.find((w) =>
  w.day.toLowerCase().trim() === day.toLowerCase().trim()
);

if (!workout) {
  workoutList.innerHTML = `<p>No workout scheduled for ${day}.</p>`;
  return;
}
  if (!workout) {
    workoutList.innerHTML = `<p>No workout scheduled for ${day}.</p>`;
    return;
  }

  const docId = `${todayDate()}_${day}`;
  const docRef = doc(db, "users", currentUserId, "workouts", docId);
  const docSnap = await getDoc(docRef);
  const savedData = docSnap.exists() ? docSnap.data() : {};

  workout.exercises.forEach((exercise) => {
    const card = document.createElement("div");
    card.className = "exercise-card";

    const header = document.createElement("h3");
    header.textContent = exercise.machine;

    const videoLink = document.createElement("a");
    videoLink.href = exercise.video;
    videoLink.target = "_blank";
    videoLink.textContent = "Watch Form Video";

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML =
      "<th>Set</th><th>Reps</th><th>Weight (lbs)</th><th>Timer</th>";
    table.appendChild(headerRow);

    const inputRows = [];
    const savedSets = savedData[exercise.machine] || [];

    for (let i = 1; i <= exercise.sets; i++) {
      const row = document.createElement("tr");

      const setCell = document.createElement("td");
      setCell.textContent = `Set ${i}`;

      const repsInput = document.createElement("input");
      repsInput.type = "number";
      repsInput.placeholder = exercise.reps;
      repsInput.value = savedSets[i - 1]?.reps || "";

      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.placeholder = exercise.weight;
      weightInput.value = savedSets[i - 1]?.weight || "";

      const repsCell = document.createElement("td");
      const weightCell = document.createElement("td");
      repsCell.appendChild(repsInput);
      weightCell.appendChild(weightInput);

      const timerCell = document.createElement("td");
      const timerDiv = document.createElement("div");
      timerCell.appendChild(timerDiv);

      const saveAndStartTimer = () => {
        saveSet(docRef, exercise.machine, i - 1, repsInput.value, weightInput.value);
        startTimer(timerDiv, 30);
      };

      repsInput.addEventListener("change", saveAndStartTimer);
      weightInput.addEventListener("change", saveAndStartTimer);

      row.appendChild(setCell);
      row.appendChild(repsCell);
      row.appendChild(weightCell);
      row.appendChild(timerCell);
      table.appendChild(row);

      inputRows.push({ repsInput, weightInput });
    }

    const notes = document.createElement("textarea");
    notes.placeholder = "Notes...";
    notes.value = savedData[`${exercise.machine}_notes`] || "";
    notes.addEventListener("input", () => {
      saveNote(docRef, `${exercise.machine}_notes`, notes.value);
    });

    card.appendChild(header);
    card.appendChild(videoLink);
    card.appendChild(table);
    card.appendChild(notes);
    workoutList.appendChild(card);
  });
}

function startTimer(container, seconds) {
  clearInterval(container._interval);
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

async function saveSet(docRef, exerciseName, index, reps, weight) {
  const docSnap = await getDoc(docRef);
  const data = docSnap.exists() ? docSnap.data() : {};
  const sets = data[exerciseName] || [];

  sets[index] = { reps, weight };
  data[exerciseName] = sets;
  await setDoc(docRef, data);
}

async function saveNote(docRef, key, value) {
  const docSnap = await getDoc(docRef);
  const data = docSnap.exists() ? docSnap.data() : {};
  data[key] = value;
  await setDoc(docRef, data);
}