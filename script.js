import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


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

// 📅 Create and insert date picker
const dateInput = document.createElement("input");
dateInput.type = "date";
dateInput.id = "datePicker";
document.getElementById("daySelect").after(dateInput);

// ⏱️ Helpers
function getLocalISODateString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local time
  return now.toISOString().split("T")[0];
}

function weekdayName(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleString("en-US", { weekday: "long" });
}

// Set today's date + day
dateInput.value = getLocalISODateString();
daySelect.value = weekdayName(dateInput.value);

// ⬅️ Date changes → update day and load workout
dateInput.addEventListener("change", () => {
  const newDay = weekdayName(dateInput.value);
  daySelect.value = newDay;
  loadWorkoutForDay(newDay);
});

// ⬆️ Day changes → update date to this week’s selected day
daySelect.addEventListener("change", () => {
  const selectedDay = daySelect.value;
  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const current = new Date(dateInput.value);
  const currentWeekday = current.getDay();
  const targetWeekday = dayMap[selectedDay];
  const diff = targetWeekday - currentWeekday;

  const newDate = new Date(current);
  newDate.setDate(current.getDate() + diff);
  newDate.setMinutes(newDate.getMinutes() - newDate.getTimezoneOffset());
  dateInput.value = newDate.toISOString().split("T")[0];

  loadWorkoutForDay(selectedDay);
});

// 🔐 Set up Google Auth with a button
const loginButton = document.createElement("button");
loginButton.textContent = "Sign In with Google";
document.body.prepend(loginButton);

const provider = new GoogleAuthProvider();

loginButton.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      currentUserId = result.user.uid;
      console.log("✅ Logged in as:", result.user.email);
      fetchWorkoutData();
      loginButton.style.display = "none"; // hide after login
    })
    .catch((error) => {
      console.error("❌ Google sign-in failed:", error);
    });
});

// 🔄 On login, fetch workouts and load today
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    fetchWorkoutData();
  }
});

function fetchWorkoutData() {
  fetch("workouts.json")
    .then((res) => res.json())
    .then((data) => {
      workouts = data;
      loadWorkoutForDay(daySelect.value);
    });
};

async function loadWorkoutForDay(day) {
  workoutList.innerHTML = "";
  console.log("🔍 Trying to load workout for:", day);

  const workout = workouts.find((w) =>
    w.day.toLowerCase().trim() === day.toLowerCase().trim()
  );

  if (!workout) {
    workoutList.innerHTML = `<p>No workout scheduled for ${day}.</p>`;
    return;
  }

  const docId = `${dateInput.value}_${day}`;
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