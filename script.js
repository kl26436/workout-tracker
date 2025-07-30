import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let workouts = [];
let allExercises = [];
let overrides = {};
let currentUserId = null;
let currentSwapTarget = null;

const workoutList = document.getElementById("workout-list");
const workoutTypeSelect = document.getElementById("workoutTypeSelect");
const dateInput = document.createElement("input");
dateInput.type = "date";
dateInput.id = "datePicker";
workoutTypeSelect.after(dateInput);

const loginButton = document.createElement("button");
loginButton.textContent = "Sign In with Google";
loginButton.id = "googleSignInBtn";
document.body.prepend(loginButton);

const swapModal = document.getElementById("swapModal");
const searchInput = document.getElementById("exerciseSearch");
const optionsContainer = document.getElementById("exerciseOptions");
const closeModalBtn = document.getElementById("closeSwapModal");

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
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    weekday: "long"
  });
}

dateInput.addEventListener("change", () => {
  const newDay = weekdayName(dateInput.value);
  workoutTypeSelect.value = dayToWorkoutType[newDay] || "Cardio + Core";
  loadWorkoutForDay(workoutTypeSelect.value);
});

workoutTypeSelect.addEventListener("change", () => {
  loadWorkoutForDay(workoutTypeSelect.value);
});

const provider = new GoogleAuthProvider();
loginButton.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      currentUserId = result.user.uid;
      loginButton.style.display = "none";
      fetchWorkoutData();
    })
    .catch(console.error);
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

function fetchWorkoutData() {
  Promise.all([
    fetch("workouts.json").then(res => res.json()),
    fetch("exercises.json").then(res => res.json())
  ])
    .then(([w, e]) => {
      workouts = w;
      allExercises = e;
      workoutTypeSelect.value = dayToWorkoutType[weekdayName(dateInput.value)];
      loadWorkoutForDay(workoutTypeSelect.value);
    })
    .catch(err => {
      console.error("❌ Load failed:", err);
    });
}

async function loadWorkoutForDay(type) {
  workoutList.innerHTML = "";
  const workout = workouts.find(w => w.day === type);
  if (!workout) return;

  const docId = `${dateInput.value}_${type}`;
  const docRef = doc(db, "users", currentUserId, "workouts", docId);
  const overrideRef = doc(db, "users", currentUserId, "overrides", docId);
  const [savedSnap, overrideSnap] = await Promise.all([
    getDoc(docRef),
    getDoc(overrideRef)
  ]);
  const savedData = savedSnap.exists() ? savedSnap.data() : {};
  overrides = overrideSnap.exists() ? overrideSnap.data() : {};

  workout.exercises.forEach((exercise) => {
    const override = overrides[exercise.machine];
    const effective = override || exercise;

    const card = document.createElement("div");
    card.className = "exercise-card";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.justifyContent = "space-between";

    const title = document.createElement("h3");
    title.textContent = effective.machine;
    titleRow.appendChild(title);

    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap";
    swapBtn.style.marginLeft = "1rem";
    swapBtn.onclick = () => {
      currentSwapTarget = exercise.machine;
      renderExerciseOptions("");
      swapModal.style.display = "block";
    };
    titleRow.appendChild(swapBtn);

    const link = document.createElement("a");
    link.href = effective.video;
    link.target = "_blank";
    link.textContent = "Watch Form Video";

    const table = document.createElement("table");
    table.innerHTML = "<tr><th>Set</th><th>Reps</th><th>Weight</th><th>Timer</th></tr>";

    const savedSets = savedData[exercise.machine] || [];
    for (let i = 0; i < effective.sets; i++) {
      const row = document.createElement("tr");

      row.innerHTML = `<td>Set ${i + 1}</td>`;
      const repsInput = document.createElement("input");
      repsInput.type = "number";
      repsInput.placeholder = effective.reps;
      repsInput.value = savedSets[i]?.reps || "";

      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.placeholder = effective.weight;
      weightInput.value = savedSets[i]?.weight || "";

      const repsCell = document.createElement("td");
      repsCell.appendChild(repsInput);

      const weightCell = document.createElement("td");
      weightCell.appendChild(weightInput);

      const timerCell = document.createElement("td");
      const timerDiv = document.createElement("div");
      timerCell.appendChild(timerDiv);

      const saveAndStart = () => {
        saveSet(docRef, exercise.machine, i, repsInput.value, weightInput.value);
        startTimer(timerDiv, 30);
      };

      repsInput.addEventListener("change", saveAndStart);
      weightInput.addEventListener("change", saveAndStart);

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

    card.appendChild(titleRow);
    card.appendChild(link);
    card.appendChild(table);
    card.appendChild(notes);
    workoutList.appendChild(card);
  });
}

async function saveSet(docRef, name, index, reps, weight) {
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};
  const sets = data[name] || [];
  sets[index] = { reps, weight };
  data[name] = sets;
  await setDoc(docRef, data);
}

async function saveNote(docRef, key, val) {
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};
  data[key] = val;
  await setDoc(docRef, data);
}

function startTimer(container, seconds) {
  clearInterval(container._interval);
  let timeLeft = seconds;
  container.textContent = `Rest: ${timeLeft}s`;
  container._interval = setInterval(() => {
    timeLeft--;
    container.textContent = timeLeft > 0 ? `Rest: ${timeLeft}s` : "Rest Over!";
    if (timeLeft <= 0) clearInterval(container._interval);
  }, 1000);
}

function renderExerciseOptions(query = "") {
  optionsContainer.innerHTML = "";
  const q = query.toLowerCase();
  const filtered = allExercises.filter(e =>
    e.machine.toLowerCase().includes(q) ||
    (e.bodyPart && e.bodyPart.toLowerCase().includes(q)) ||
    (e.tags && e.tags.some(tag => tag.toLowerCase().includes(q)))
  );

  filtered.forEach((ex) => {
    const div = document.createElement("div");
    div.style.padding = "0.5rem";
    div.style.borderBottom = "1px solid #30363d";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <strong>${ex.machine}</strong><br/>
      <small>${ex.sets} x ${ex.reps} @ ${ex.weight} lbs</small><br/>
      <a href="${ex.video}" target="_blank">Form Video</a>
    `;
    div.addEventListener("click", () => {
      applyExerciseSwap(currentSwapTarget, ex);
      swapModal.style.display = "none";
    });
    optionsContainer.appendChild(div);
  });
}

async function applyExerciseSwap(targetName, replacement) {
  const overrideRef = doc(db, "users", currentUserId, "overrides", `${dateInput.value}_${workoutTypeSelect.value}`);
  const snap = await getDoc(overrideRef);
  const current = snap.exists() ? snap.data() : {};
  current[targetName] = replacement;
  await setDoc(overrideRef, current);
  loadWorkoutForDay(workoutTypeSelect.value);
}

closeModalBtn.addEventListener("click", () => {
  swapModal.style.display = "none";
});

searchInput.addEventListener("input", () => {
  renderExerciseOptions(searchInput.value);
});