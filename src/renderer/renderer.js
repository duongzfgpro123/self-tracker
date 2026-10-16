const navigationLinks = Array.from(document.querySelectorAll(".nav-link"));
const pages = Array.from(document.querySelectorAll(".page"));

function showPage(section) {
  const activePage = pages.find(page => page.dataset.page === section);
  if (!activePage) return;

  pages.forEach(page => {
    page.hidden = page !== activePage;
  });

  navigationLinks.forEach(link => {
    const isActive = link.dataset.section === section;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  document.title = activePage.querySelector("h1").textContent + " | Self Tracker";
}

navigationLinks.forEach(link => {
  link.addEventListener("click", function () {
    showPage(link.dataset.section);
  });
});

// Find the Done button so we can react when it is clicked
const doneButton = document.getElementById("done");

// Draw the saved entries as a list on the page
function renderHistory() {
  const historyList = document.getElementById("history");
  historyList.innerHTML = ""; // clear old items before redrawing

  const saved = localStorage.getItem("entries");
  const entries = saved ? JSON.parse(saved) : [];

  entries.forEach(function (entry) {
    const li = document.createElement("li");
    li.textContent = entry.date + " - " + entry.muscle + " (" + entry.intensity + ")";
    historyList.appendChild(li);
  });
}

// Run this function every time the user clicks Done
doneButton.addEventListener("click", function () {
  const muscle = document.getElementById("muscle").value;
  const intensity = document.getElementById("intensity").value;
  const date = new Date().toLocaleDateString("en-CA");
  const entry = { date: date, muscle: muscle, intensity: intensity };

  // Read the existing list from localStorage (or start with an empty list)
  const saved = localStorage.getItem("entries");
  const entries = saved ? JSON.parse(saved) : [];

  entries.push(entry);

  // Save the updated list back to localStorage as a string
  localStorage.setItem("entries", JSON.stringify(entries));
  renderHistory(); // redraw the list to include the entry we just added

  console.log(entries);
});

renderHistory(); // show saved entries as soon as the page loads

// New workout form: saves to the database through window.api (see preload.js)
const workoutForm = document.getElementById("new-workout-form");
const workoutNameInput = document.getElementById("workout-name");
const workoutDateInput = document.getElementById("workout-date");
const workoutNotesInput = document.getElementById("workout-notes");
const workoutError = document.getElementById("workout-error");
const createWorkoutButton = document.getElementById("create-workout");
const currentWorkout = document.getElementById("current-workout");

// Turn "2026-10-16" into "Fri 16 Oct 2026" using the local calendar
function formatWorkoutDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Errors from the main process arrive as "Error invoking remote method '...': Error: <message>"
function ipcErrorMessage(error) {
  const message = error && error.message ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, "");
}

function appendText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text; // textContent keeps user text from being read as HTML
  parent.appendChild(element);
}

function renderCurrentWorkout(workout) {
  currentWorkout.replaceChildren();
  appendText(currentWorkout, "h3", "current-name", workout.name);
  appendText(currentWorkout, "p", "current-date", formatWorkoutDate(workout.workout_date));
  if (workout.notes) appendText(currentWorkout, "p", "current-notes", workout.notes);
  appendText(currentWorkout, "p", "empty-note", "No exercises yet");
}

workoutForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  createWorkoutButton.disabled = true;

  try {
    const workout = await window.api.workouts.create({
      name: workoutNameInput.value,
      workout_date: workoutDateInput.value,
      notes: workoutNotesInput.value,
    });
    renderCurrentWorkout(workout);
    workoutError.hidden = true;
    workoutNameInput.value = "";
    workoutNotesInput.value = "";
  } catch (error) {
    workoutError.textContent = ipcErrorMessage(error);
    workoutError.hidden = false;
  } finally {
    createWorkoutButton.disabled = false;
  }
});

workoutDateInput.value = new Date().toLocaleDateString("en-CA"); // today's date as YYYY-MM-DD
