import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbzL4bGY026Z-oWiWcYLfDgkmmgAfUY3k",
  authDomain: "workout-tracker-b94b6.firebaseapp.com",
  projectId: "workout-tracker-b94b6",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

fetch("exercises.json")
  .then((res) => res.json())
  .then(async (exercises) => {
    for (const ex of exercises) {
      const safeId = ex.name.replace(/\//g, "-").trim(); // Replace slashes
      try {
        await setDoc(doc(db, "exercises", safeId), ex);
        console.log("✅ Uploaded:", ex.name);
      } catch (err) {
        console.error("❌ Error uploading", ex.name, err);
      }
    }
  });