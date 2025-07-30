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

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let workouts = [];
let currentUserId = null;
let allExercises = [];
let overrides = {};
let currentSwapTarget = null;

const workoutList = document.getElementById("workout-list");
const workoutTypeSelect = document.getElementById("workoutTypeSelect");
const swapModal = document.getElementById("swapModal");
const searchInput = document.getElementById("exerciseSearch");
const optionsContainer = document.getElementById("exerciseOptions");
const closeModalBtn = document.getElementById("closeSwapModal");

// Date selector
const dateInput = document.createElement("input");
dateInput.type = "date";
dateInput.id = "datePicker";
workoutTypeSelect.after(dateInput);

// Sign-in button
const loginButton = document.createElement("button");
loginButton.textContent = "Sign In with Google";
loginButton.id = "googleSignInBtn";
document.body.prepend(loginButton);

// Local helpers
function getLocalISODateString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split("T")[0];
}
dateInput.value = getLocalISODateString();

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
  return new Date(year, month - 1, day).toLocaleString("en-US", { weekday: "long" });
}

// Sync workout on change
dateInput.addEventListener("change", () => {
  const day = weekdayName(dateInput.value);
  workoutTypeSelect.value = dayToWorkoutType[day] || "Cardio + Core";
  loadWorkoutForDay(workoutTypeSelect.value);
});
workoutTypeSelect.value = dayToWorkoutType[weekdayName(dateInput.value)] || "";
workoutTypeSelect.addEventListener("change", () => {
  loadWorkoutForDay(workoutTypeSelect.value);
});

// Firebase Auth
const provider = new GoogleAuthProvider();
loginButton.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      currentUserId = result.user.uid;
      loginButton.style.display = "none";
      fetchWorkoutData();
    })
    .catch((err) => console.error("❌ Login failed:", err));
});
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    document.getElementById("user-info").textContent = user.email;
    loginButton.style.display = "none";
    fetchWorkoutData();
  } else {
    loginButton.style.display = "inline-block";
  }
});

// Load workouts & all exercises
function fetchWorkoutData() {
  Promise.all([
    fetch("workouts.json").then(res => res.json()),
    fetch("exercises.json").then(res => res.json())
  ])
    .then(([w, e]) => {
      workouts = w;
      allExercises = e;
      loadWorkoutForDay(workoutTypeSelect.value);
    })
    .catch((err) => console.error("❌ Load failed:", err));
}

// Render workout
async function loadWorkoutForDay(type) {
  workoutList.innerHTML = "";
  const workout = workouts.find(w => w.day.toLowerCase().trim() === type.toLowerCase().trim());
  if (!workout) return (workoutList.innerHTML = `<p>No workout scheduled for ${type}</p>`);

  const docId = `${dateInput.value}_${type}`;
  const docRef = doc(db, "users", currentUserId, "workouts", docId);
  const docSnap = await getDoc(docRef);
  const savedData = docSnap.exists() ? docSnap.data() : {};

  const overrideRef = doc(db, "users", currentUserId, "overrides", docId);
  const overrideSnap = await getDoc(overrideRef);
  overrides = overrideSnap.exists() ? overrideSnap.data() : {};

  workout.exercises.forEach((exercise) => {
    const override = overrides[exercise.machine];
    const effectiveExercise = override || exercise;

    const card = document.createElement("div");
    card.className = "exercise-card";

    const header = document.createElement("h3");
    header.textContent = effectiveExercise.machine;

    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap";
    swapBtn.style.marginLeft = "1rem";
    swapBtn.onclick = () => {
      currentSwapTarget = exercise.machine;
      swapModal.style.display = "block";
      renderExerciseOptions("");
    };

    const videoLink = document.createElement("a");
    videoLink.href = effectiveExercise.video;
    videoLink.target = "_blank";
    videoLink.textContent = "Watch Form Video";

    const headerWrapper = document.createElement("div");
    headerWrapper.style.display = "flex";
    headerWrapper.style.alignItems = "center";
    headerWrapper.appendChild(header);
    headerWrapper.appendChild(swapBtn);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>Set</th><th>Reps</th><th>Weight</th><th>Timer</th>";
    table.appendChild(headerRow);

    const savedSets = savedData[exercise.machine] || [];
    for (let i = 0; i < effectiveExercise.sets; i++) {
      const row = document.createElement("tr");

      const set = document.createElement("td");
      set.textContent = `Set ${i + 1}`;

      const reps = document.createElement("input");
      reps.type = "number";
      reps.placeholder = effectiveExercise.reps;
      reps.value = savedSets[i]?.reps || "";

      const weight = document.createElement("input");
      weight.type = "number";
      weight.placeholder = effectiveExercise.weight;
      weight.value = savedSets[i]?.weight || "";

      const repsCell = document.createElement("td");
      repsCell.appendChild(reps);
      const weightCell = document.createElement("td");
      weightCell.appendChild(weight);

      const timerCell = document.createElement("td");
      const timerDiv = document.createElement("div");
      timerCell.appendChild(timerDiv);

      const saveAndStart = () => {
        saveSet(docRef, exercise.machine, i, reps.value, weight.value);
        startTimer(timerDiv, 30);
      };
      reps.onchange = saveAndStart;
      weight.onchange = saveAndStart;

      row.append(set, repsCell, weightCell, timerCell);
      table.appendChild(row);
    }

    const notes = document.createElement("textarea");
    notes.placeholder = "Notes...";
    notes.value = savedData[`${exercise.machine}_notes`] || "";
    notes.addEventListener("input", () =>
      saveNote(docRef, `${exercise.machine}_notes`, notes.value)
    );

    card.append(headerWrapper, videoLink, table, notes);
    workoutList.appendChild(card);
  });
}

// Timer
function startTimer(el, sec) {
  clearInterval(el._interval);
  let t = sec;
  el.textContent = `Rest: ${t}s`;
  el._interval = setInterval(() => {
    t--;
    el.textContent = t > 0 ? `Rest: ${t}s` : "Rest Over!";
    if (t <= 0) clearInterval(el._interval);
  }, 1000);
}

// Save set & notes
async function saveSet(ref, name, i, reps, weight) {
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const sets = data[name] || [];
  sets[i] = { reps, weight };
  data[name] = sets;
  await setDoc(ref, data);
}
async function saveNote(ref, key, val) {
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  data[key] = val;
  await setDoc(ref, data);
}

// Swap modal logic
closeModalBtn.onclick = () => (swapModal.style.display = "none");
searchInput.oninput = () => renderExerciseOptions(searchInput.value);

function renderExerciseOptions(query) {
  optionsContainer.innerHTML = "";
  const q = query.toLowerCase();
  const filtered = allExercises.filter(
    (ex) =>
      ex.machine.toLowerCase().includes(q) ||
      (ex.bodyPart && ex.bodyPart.toLowerCase().includes(q)) ||
      (ex.tags && ex.tags.some((tag) => tag.toLowerCase().includes(q)))
  );
  filtered.forEach((ex) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${ex.machine}</strong><br/><small>${ex.sets}x${ex.reps} @ ${ex.weight} lbs</small><br/><a href="${ex.video}" target="_blank">Form Video</a>`;
    div.style.borderBottom = "1px solid #333";
    div.style.padding = "0.5rem";
    div.style.cursor = "pointer";
    div.onclick = () => applyExerciseSwap(currentSwapTarget, ex);
    optionsContainer.appendChild(div);
  });
}

async function applyExerciseSwap(originalMachine, newExercise) {
  const docId = `${dateInput.value}_${workoutTypeSelect.value}`;
  const overrideRef = doc(db, "users", currentUserId, "overrides", docId);
  overrides[originalMachine] = newExercise;
  await setDoc(overrideRef, overrides);
  swapModal.style.display = "none";
  loadWorkoutForDay(workoutTypeSelect.value);
}