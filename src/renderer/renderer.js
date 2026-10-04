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
