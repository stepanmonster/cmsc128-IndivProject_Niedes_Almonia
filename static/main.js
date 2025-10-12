// main.js

const PRIORITY_COLORS = { High: "red", Mid: "orange", Low: "green" };
let todos = [];
let calendar;

// DOM ELEMENTS
const addTaskBtn = document.getElementById("add-task-btn");
const addTaskConfirmBtn = document.getElementById("add-task-confirm");
const taskNameInput = document.getElementById("task-name");
const taskPriorityInput = document.getElementById("task-priority");
const taskDateInput = document.getElementById("task-date");
const taskTimeInput = document.getElementById("task-time");

const renameTaskConfirmBtn = document.getElementById("rename-task-confirm");
const renameTaskNameInput = document.getElementById("rename-task-name");
const renameTaskPriorityInput = document.getElementById("rename-task-priority");
const renameTaskDateInput = document.getElementById("rename-task-date");
const renameTaskTimeInput = document.getElementById("rename-task-time");

const deleteTaskConfirmBtn = document.getElementById("delete-task-confirm");
const doneTaskConfirmBtn = document.getElementById("done-task-confirm");

const listWeek = document.getElementById("list-week");
const listMonth = document.getElementById("list-month");
const listPersonal = document.getElementById("list-personal");
const listDone = document.getElementById("list-done");

// Modals
const addModal = document.getElementById("addModal");
const renameModal = document.getElementById("renameModal");
const deleteModal = document.getElementById("deleteModal");
const doneModal = document.getElementById("doneModal");

// Sorting + Toast
const sortSelect = document.getElementById("sort-select");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-message");
const toastUndoBtn = document.getElementById("toast-undo");

let renameIndex = null; //which task is renamed
let deleteIndex = null; //which task is deleted
let doneIndex = null; //which task is marked done
let lastDeleted = null; // store last deleted task for undo

// === API ===
async function apiList() {
  const r = await fetch("/api/tasks");
  return r.json();
}
async function apiCreate(task) {
  const r = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return r.json();
}
async function apiUpdate(id, patch) {
  const r = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return r.json();
}
async function apiDelete(id) {
  await fetch(`/api/tasks/${id}`, { method: "DELETE" });
}
async function apiToggle(id) {
  const r = await fetch(`/api/tasks/${id}/toggle`, { method: "PATCH" });
  return r.json();
}

// === INIT ===
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  // Only initialize the task system if we are on the main page
  if (calendarEl) {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "100%",
      events: [],
    });
    calendar.render();

    todos = await apiList();
    rebuildCalendarFromTodos();
    renderTodos();

    if (sortSelect) {
      sortSelect.addEventListener("change", renderTodos);
    }

    if (toastUndoBtn) {
      toastUndoBtn.addEventListener("click", async () => {
        if (lastDeleted) {
          const restored = await apiCreate(lastDeleted);
          todos.push(restored);
          rebuildCalendarFromTodos();
          renderTodos();
          hideToast();
          lastDeleted = null;
        }
      });
    }
  }
});

// === RENDER ===
function getPriorityClass(p) {
  if (p === "High") return "high-priority";
  if (p === "Low") return "low-priority";
  return "mid-priority";
}

function renderTodos() {
  listWeek.innerHTML = "";
  listMonth.innerHTML = "";
  listPersonal.innerHTML = "";
  listDone.innerHTML = "";

  const sortedTodos = [...todos];
  const criteria = sortSelect?.value;

  if (criteria === "dateAdded") {
    sortedTodos.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  } else if (criteria === "dueDate") {
    sortedTodos.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
  } else if (criteria === "priority") {
    const order = { High: 1, Mid: 2, Low: 3 };
    sortedTodos.sort(
      (a, b) => (order[a.priority] || 99) - (order[b.priority] || 99)
    );
  }

  const now = new Date();

  sortedTodos.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${getPriorityClass(task.priority || "Mid")}`;

    // Label + Checkbox
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!task.checked;

    cb.addEventListener("change", () => {
      const idx = todos.indexOf(task);
      if (idx !== -1) {
        doneIndex = idx;
        openDoneModal(cb, idx);
      }
    });

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;

    label.appendChild(cb);
    label.appendChild(span);
    li.appendChild(label);

    // Edit/Delete Buttons
    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.innerHTML = `
      <button class="icon-btn icon-edit" title="Edit"></button>
      <button class="icon-btn icon-delete" title="Delete"></button>
    `;
    actions.querySelector(".icon-edit").addEventListener("click", () => {
      openRenameModal(todos.indexOf(task));
    });
    actions.querySelector(".icon-delete").addEventListener("click", () => {
      openDeleteModal(todos.indexOf(task));
    });

    li.appendChild(actions);

    // Sorting into Lists
    if (task.checked) {
      listDone.appendChild(li);
    } else {
      const due = task.date ? new Date(task.date) : null;
      if (due) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const dueDateOnly = new Date(
          due.getFullYear(),
          due.getMonth(),
          due.getDate()
        );

        if (dueDateOnly >= startOfWeek && dueDateOnly <= endOfWeek) {
          listWeek.appendChild(li);
        } else if (dueDateOnly <= endOfMonth) {
          listMonth.appendChild(li);
        } else {
          listPersonal.appendChild(li);
        }
      } else {
        listPersonal.appendChild(li);
      }
    }
  });
}

// === MODAL OPEN ===
function openRenameModal(index) {
  renameIndex = index;
  const task = todos[index];
  renameTaskNameInput.value = task.text;
  renameTaskPriorityInput.value = task.priority || "Mid";
  if (task.date) {
    const [d, t] = task.date.split("T");
    renameTaskDateInput.value = d || "";
    renameTaskTimeInput.value = t || "";
  }
  renameModal.style.display = "flex";
}
function openDeleteModal(index) {
  deleteIndex = index;
  deleteModal.style.display = "flex";
}
function openDoneModal(cb, index) {
  doneModal.style.display = "flex";

  const titleEl = document.getElementById("doneModalTitle");
  const textEl = document.getElementById("doneModalText");

  if (cb.checked) {
    titleEl.textContent = "Mark Task as Done";
    textEl.textContent = "Do you want to mark this task as done?";
  } else {
    titleEl.textContent = "Mark Task as Not Done";
    textEl.textContent = "Do you want to mark this task as not done?";
  }

  cb.checked = !cb.checked;

  doneTaskConfirmBtn.onclick = () => {
    toggleTask(index);
    closeDoneModal();
  };
}

// === MODAL CLOSE ===
function closeAddModal() {
  addModal.style.display = "none";
}
function closeRenameModal() {
  renameModal.style.display = "none";
}
function closeDeleteModal() {
  deleteModal.style.display = "none";
}
function closeDoneModal() {
  doneModal.style.display = "none";
  renderTodos();
}

// === TASK LOGIC ===
addTaskBtn?.addEventListener("click", () => (addModal.style.display = "flex"));

addTaskConfirmBtn?.addEventListener("click", async () => {
  const text = taskNameInput.value.trim();
  if (!text) return alert("Please enter a task name.");

  const dateTime = taskDateInput.value
    ? taskTimeInput.value
      ? `${taskDateInput.value}T${taskTimeInput.value}`
      : taskDateInput.value
    : "";

  const created = await apiCreate({
    text,
    date: dateTime,
    checked: false,
    priority: taskPriorityInput.value || "Mid",
  });

  todos.push(created);
  rebuildCalendarFromTodos();
  closeAddModal();
  renderTodos();
});

renameTaskConfirmBtn?.addEventListener("click", async () => {
  const newText = renameTaskNameInput.value.trim();
  if (!newText) return alert("Task cannot be empty.");

  const newDateTime = renameTaskDateInput.value
    ? renameTaskTimeInput.value
      ? `${renameTaskDateInput.value}T${renameTaskTimeInput.value}`
      : renameTaskDateInput.value
    : "";

  const id = todos[renameIndex].id;
  const updated = await apiUpdate(id, {
    text: newText,
    priority: renameTaskPriorityInput.value || "Mid",
    date: newDateTime || "",
  });

  todos[renameIndex] = updated;
  rebuildCalendarFromTodos();
  closeRenameModal();
  renderTodos();
});

deleteTaskConfirmBtn?.addEventListener("click", async () => {
  const task = todos[deleteIndex];
  lastDeleted = { ...task };
  await apiDelete(task.id);
  todos.splice(deleteIndex, 1);
  rebuildCalendarFromTodos();
  closeDeleteModal();
  renderTodos();
  showToast(`Task "${task.text}" deleted.`);
});

function toggleTask(index) {
  const id = todos[index].id;
  apiToggle(id).then((updated) => {
    todos[index] = updated;
    rebuildCalendarFromTodos();
    renderTodos();
  });
}

function rebuildCalendarFromTodos() {
  if (!calendar) return;
  calendar.removeAllEvents();
  todos.forEach((t) => {
    if (t.date && !t.checked) {
      calendar.addEvent({
        title: formatTitleWithTime(t.text, t.date),
        start: t.date,
        allDay: true,
        color: PRIORITY_COLORS[t.priority || "Mid"],
      });
    }
  });
}

function formatTitleWithTime(text, datetimeStr) {
  if (!datetimeStr || !datetimeStr.includes("T")) return text;
  const [datePart, timePart] = datetimeStr.split("T");
  const time = new Date(`${datePart}T${timePart}`);
  const options = { hour: "numeric", minute: "2-digit", hour12: true };
  return `${text} – ${time.toLocaleTimeString([], options)}`;
}

// === TOAST ===
function showToast(msg) {
  if (!toast) return;
  toastMsg.textContent = msg;
  toast.classList.add("show");
  setTimeout(hideToast, 5000);
}
function hideToast() {
  toast.classList.remove("show");
}

// -------- LOGIN PAGE LOGIC --------
if (document.getElementById("login-confirm")) {
  const loginBtn = document.getElementById("login-confirm");

  loginBtn.addEventListener("click", () => {
    const credentials = document
      .getElementById("login-credentials")
      .value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!credentials || !password) {
      alert("Please fill in both fields.");
      return;
    }

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentials, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
        } else {
          alert(`Welcome back, ${data.user.username}!`);
          window.location.href = "/tasks"; // redirect to main page
        }
      })
      .catch((err) => console.error("Login error:", err));
  });
}
