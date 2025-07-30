import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6",
  storageBucket: "workout-tracker-b94b6.firebasestorage.app",
  messagingSenderId: "111958991290",
  appId: "1:111958991290:web:23e1014ab2ba27df6ebd83"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let workouts = [];
let currentUserId = null;
let allExercises = []; // List of all available exercises
let overrides = {}; // Local cache of user swaps for the day

const swapModal = document.getElementById("swapModal");
const searchInput = document.getElementById("exerciseSearch");
const optionsContainer = document.getElementById("exerciseOptions");
const closeModalBtn = document.getElementById("closeSwapModal");
const workoutList = document.getElementById("workout-list");
const workoutTypeSelect = document.getElementById("workoutTypeSelect");
const dateInput = document.createElement("input");
dateInput.type = "date";
dateInput.id = "datePicker";
workoutTypeSelect.after(dateInput);

// Sign-in button
const loginButton = document.createElement("button");
loginButton.textContent = "Sign In with Google";
loginButton.id = "googleSignInBtn";
document.body.prepend(loginButton);

// Helper: Today’s ISO date
function getLocalISODateString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split("T")[0];
}

dateInput.value = getLocalISODateString();

// Sync workout type to current date on load
workoutTypeSelect.value = weekdayName(dateInput.value);

// Map weekdays to workout types
const dayToWorkoutType = {
  Sunday: "Optional – Cardio / Abs",
  Monday: "Chest – Push",
  Tuesday: "Legs – Quad Focus",
  Wednesday: "Cardio + Core",
  Thursday: "Back – Pull",
  Friday: "Legs – Posterior Focus",
  Saturday: "Optional – Cardio / Abs"
};

function weekdayName(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    weekday: "long"
  });
}

// When date changes → sync workout type
dateInput.addEventListener("change", () => {
  const newDay = weekdayName(dateInput.value);
  const newWorkoutType = dayToWorkoutType[newDay] || "Cardio + Core";
  workoutTypeSelect.value = newWorkoutType;
  loadWorkoutForDay(newWorkoutType);
});

// When workout type changes → do not touch date, just load workout
workoutTypeSelect.addEventListener("change", () => {
  loadWorkoutForDay(workoutTypeSelect.value);
});

// Firebase auth
const provider = new GoogleAuthProvider();

loginButton.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      currentUserId = result.user.uid;
      console.log("✅ Signed in as:", result.user.email);
      loginButton.style.display = "none";
      fetchWorkoutData();
    })
    .catch((error) => {
      console.error("❌ Google sign-in failed:", error);
    });
});

// On login
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    document.getElementById("user-info").textContent =
      user.email || `UID: ${user.uid}`;
    loginButton.style.display = "none";
    fetchWorkoutData();
  } else {
    loginButton.style.display = "inline-block";
  }
});

function fetchWorkoutData() {
  Promise.all([
    fetch("workouts.json").then(res => res.json()),
    fetch("exercises.json").then(res => res.json())
  ])
  .then(([workoutData, allEx]) => {
    workouts = workoutData;
    allExercises = allEx;
    loadWorkoutForDay(workoutTypeSelect.value);
  })
  .catch(err => console.error("❌ Failed to load workout data:", err));
}

async function loadWorkoutForDay(type) {
  workoutList.innerHTML = "";
  console.log("🔍 Loading workout:", type);

  const workout = workouts.find(
    (w) => w.day.toLowerCase().trim() === type.toLowerCase().trim()
  );
  if (!workout) {
    workoutList.innerHTML = `<p>No workout scheduled for ${type}.</p>`;
    return;
  }

  const docId = `${dateInput.value}_${type}`;
  const docRef = doc(db, "users", currentUserId, "workouts", docId);
  const docSnap = await getDoc(docRef);
  const savedData = docSnap.exists() ? docSnap.data() : {};
  const overrideRef = doc(db, "users", currentUserId, "overrides", `${dateInput.value}_${type}`);
  const overrideSnap = await getDoc(overrideRef);
  overrides = overrideSnap.exists() ? overrideSnap.data() : {};


  workout.exercises.forEach((exercise) => {
  const override = overrides[exercise.machine];
  const effectiveExercise = override || exercise;

  const card = document.createElement("div");
  card.className = "exercise-card";

  const header = document.createElement("h3");
  header.textContent = effectiveExercise.machine;

  const videoLink = document.createElement("a");
  videoLink.href = effectiveExercise.video;
  videoLink.target = "_blank";
  videoLink.textContent = "Watch Form Video";

  const table = document.createElement("table");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML =
    "<th>Set</th><th>Reps</th><th>Weight (lbs)</th><th>Timer</th>";
  table.appendChild(headerRow);

  const savedSets = savedData[exercise.machine] || [];

  for (let i = 0; i < effectiveExercise.sets; i++) {
    const row = document.createElement("tr");

    const setCell = document.createElement("td");
    setCell.textContent = `Set ${i + 1}`;

    const repsInput = document.createElement("input");
    repsInput.type = "number";
    repsInput.placeholder = effectiveExercise.reps;
    repsInput.value = savedSets[i]?.reps || "";

    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.placeholder = effectiveExercise.weight;
    weightInput.value = savedSets[i]?.weight || "";

    const repsCell = document.createElement("td");
    repsCell.appendChild(repsInput);

    const weightCell = document.createElement("td");
    weightCell.appendChild(weightInput);

    const timerCell = document.createElement("td");
    const timerDiv = document.createElement("div");
    timerCell.appendChild(timerDiv);

    const saveAndStartTimer = () => {
      saveSet(docRef, exercise.machine, i, repsInput.value, weightInput.value);
      startTimer(timerDiv, 30);
    };

    repsInput.addEventListener("change", saveAndStartTimer);
    weightInput.addEventListener("change", saveAndStartTimer);

    row.appendChild(setCell);
    row.appendChild(repsCell);
    row.appendChild(weightCell);
    row.appendChild(timerCell);
    table.appendChild(row);
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
    container.textContent =
      timeLeft > 0 ? `Rest: ${timeLeft}s` : "Rest Over!";
    if (timeLeft <= 0) clearInterval(container._interval);
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

  closeModalBtn.addEventListener("click", () => {
  swapModal.style.display = "none";
});

searchInput.addEventListener("input", () => {
  renderExerciseOptions(searchInput.value);
});

function renderExerciseOptions(query) {
  optionsContainer.innerHTML = "";
  const q = query.toLowerCase();

  const filtered = allExercises.filter(ex =>
    ex.machine.toLowerCase().includes(q) ||
    (ex.bodyPart && ex.bodyPart.toLowerCase().includes(q)) ||
    (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(q)))
  );

  filtered.forEach((ex, idx) => {
    const div = document.createElement("div");
    div.style.padding = "0.5rem";
    div.style.borderBottom = "1px solid #30363d";
    div.style.cursor = "pointer";
    div.innerHTML = `<strong>${ex.machine}</strong><br/><small>${ex.sets} x ${ex.reps} @ ${ex.weight} lbs</small><br/><a href="${ex.video}" target="_blank">Form Video</a>`;
    div.addEventListener("click", () => {
      applyExerciseSwap(currentSwapTarget, ex);
      swapModal.style.display = "none";
    });
    optionsContainer.appendChild(div);
  });
}

}