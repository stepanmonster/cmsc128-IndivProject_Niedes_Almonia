// Constants
const PRIORITY_COLORS = { High: "red", Mid: "orange", Low: "green" };

// State
let todos = [];
let calendar;
let currentView = 'personal';
let collaborativeLists = [];
let currentCollaborativeList = null;
let collaborativeTasks = [];
let renameIndex = null;
let deleteIndex = null;
let doneIndex = null;
let lastDeleted = null;
let collaborativeTaskIndex = null;
let lastDeletedCollaborative = null;
let lastDeletedListId = null;
let currentListToRename = null;
let currentListToDelete = null;
let lastDeletedList = null;

// DOM Elements
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

const addModal = document.getElementById("add-task-modal");
const renameModal = document.getElementById("rename-task-modal");
const deleteModal = document.getElementById("delete-task-modal");
const doneModal = document.getElementById("done-task-modal");

const sortSelect = document.getElementById("sort-select");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-message");
const toastUndoBtn = document.getElementById("toast-undo");

// API Functions
async function apiList() {
  return (await fetch("/api/tasks")).json();
}

async function apiCreate(task) {
  return (await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  })).json();
}

async function apiUpdate(id, patch) {
  return (await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })).json();
}

async function apiDelete(id) {
  await fetch(`/api/tasks/${id}`, { method: "DELETE" });
}

async function apiToggle(id) {
  return (await fetch(`/api/tasks/${id}/toggle`, { method: "PATCH" })).json();
}

// Collaborative List APIs
async function getCollaborativeLists() {
  return (await fetch("/api/collaborative-lists")).json();
}

async function createCollaborativeList(name) {
  return (await fetch("/api/collaborative-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })).json();
}

async function renameCollaborativeList(listId, newName) {
  return (await fetch(`/api/collaborative-lists/${listId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  })).json();
}

async function deleteCollaborativeList(listId) {
  await fetch(`/api/collaborative-lists/${listId}`, { method: "DELETE" });
}

async function getCollaborativeTasks(listId) {
  return (await fetch(`/api/collaborative-lists/${listId}/tasks`)).json();
}

async function createCollaborativeTask(listId, task) {
  return (await fetch(`/api/collaborative-lists/${listId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  })).json();
}

async function updateCollaborativeTask(listId, taskId, patch) {
  return (await fetch(`/api/collaborative-lists/${listId}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })).json();
}

async function deleteCollaborativeTask(listId, taskId) {
  await fetch(`/api/collaborative-lists/${listId}/tasks/${taskId}`, { method: "DELETE" });
}

async function addListMember(listId, username) {
  return (await fetch(`/api/collaborative-lists/${listId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })).json();
}

async function getListMembers(listId) {
  return (await fetch(`/api/collaborative-lists/${listId}/members`)).json();
}

async function removeListMember(listId, memberId) {
  await fetch(`/api/collaborative-lists/${listId}/members/${memberId}`, { method: "DELETE" });
}

// Calendar Management
async function loadAllEventsToCalendar() {
  if (!calendar) return;
  calendar.removeAllEvents();
  
  todos.forEach(t => {
    if (t.date && !t.checked) {
      calendar.addEvent({
        title: formatTitleWithTime(t.text, t.date),
        start: t.date,
        allDay: true,
        color: PRIORITY_COLORS[t.priority || "Mid"],
      });
    }
  });

  for (const list of collaborativeLists) {
    try {
      const tasks = await getCollaborativeTasks(list.id);
      tasks.forEach(task => {
        if (task.date && !task.checked) {
          calendar.addEvent({
            title: `[${list.name}] ${formatTitleWithTime(task.text, task.date)}`,
            start: task.date,
            allDay: true,
            color: "#3b82f6",
          });
        }
      });
    } catch (err) {
      console.error(`Error loading events for list ${list.id}:`, err);
    }
  }
}

function formatTitleWithTime(text, datetimeStr) {
  if (!datetimeStr?.includes("T")) return text;
  const [datePart, timePart] = datetimeStr.split("T");
  const time = new Date(`${datePart}T${timePart}`);
  return `${text} – ${time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  if (calendarEl) {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "100%",
      events: [],
      headerToolbar: {
        left: 'prev,next',
        center: 'title',
        right: ''
      }
    });
    calendar.render();

    todos = await apiList();
    collaborativeLists = await getCollaborativeLists();
    await loadAllEventsToCalendar();
    renderTodos();
    loadUserProfile();

    sortSelect?.addEventListener("change", renderTodos);

    toastUndoBtn?.addEventListener("click", handleUndoToast);
  }

  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById("nav-personal")?.addEventListener("click", () => switchView("personal"));
  document.getElementById("nav-collaborative")?.addEventListener("click", () => switchView("collaborative"));
  
  document.getElementById("create-list-btn")?.addEventListener("click", () => {
    document.getElementById("create-list-modal").style.display = "flex";
  });

  document.getElementById("create-list-cancel")?.addEventListener("click", () => {
    document.getElementById("create-list-modal").style.display = "none";
  });

  document.getElementById("create-list-confirm")?.addEventListener("click", handleCreateList);
  document.getElementById("rename-list-cancel")?.addEventListener("click", () => {
    document.getElementById("rename-list-modal").style.display = "none";
  });
  document.getElementById("rename-list-confirm")?.addEventListener("click", handleRenameList);
  document.getElementById("delete-list-cancel")?.addEventListener("click", () => {
    document.getElementById("delete-list-modal").style.display = "none";
  });
  document.getElementById("delete-list-confirm")?.addEventListener("click", handleDeleteList);
  document.getElementById("manage-members-close")?.addEventListener("click", () => {
    document.getElementById("manage-members-modal").style.display = "none";
  });

  document.getElementById("add-member-btn")?.addEventListener("click", handleAddMember);
  document.getElementById("left-profile-btn")?.addEventListener("click", () => {
    window.location.href = '/settings';
  });

  addTaskBtn?.addEventListener("click", () => addModal.style.display = "flex");
  document.getElementById("add-task-cancel")?.addEventListener("click", closeAddModal);
  document.getElementById("rename-task-cancel")?.addEventListener("click", closeRenameModal);
  document.getElementById("delete-task-cancel")?.addEventListener("click", closeDeleteModal);
  document.getElementById("done-task-cancel")?.addEventListener("click", closeDoneModal);

  addTaskConfirmBtn?.addEventListener("click", handleAddTask);
  renameTaskConfirmBtn?.addEventListener("click", handleRenameTask);
  deleteTaskConfirmBtn?.addEventListener("click", handleDeleteTask);
}

// View Management
function switchView(view) {
  currentView = view;
  const personalView = document.getElementById("personal-view");
  const collaborativeView = document.getElementById("collaborative-view");
  const navPersonal = document.getElementById("nav-personal");
  const navCollaborative = document.getElementById("nav-collaborative");

  if (view === "personal") {
    personalView.style.display = "block";
    collaborativeView.style.display = "none";
    navPersonal.classList.add("active");
    navCollaborative.classList.remove("active");
  } else {
    personalView.style.display = "none";
    collaborativeView.style.display = "block";
    navPersonal.classList.remove("active");
    navCollaborative.classList.add("active");
    loadCollaborativeLists();
  }
}

// Collaborative List Management
async function loadCollaborativeLists() {
  try {
    collaborativeLists = await getCollaborativeLists();
    renderCollaborativeLists();
  } catch (err) {
    console.error("Error loading collaborative lists:", err);
  }
}

function renderCollaborativeLists() {
  const container = document.getElementById("collaborative-lists-container");
  if (!container) return;

  container.innerHTML = "";
  collaborativeLists.forEach(list => {
    const listEl = document.createElement("div");
    listEl.className = "collab-list-item";
    listEl.innerHTML = `
      <div class="collab-list-header">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <h3>${list.name}</h3>
            <span class="list-owner">${list.is_owner ? "Owner" : `by ${list.owner}`}</span>
          </div>
          ${list.is_owner ? `
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="icon-btn icon-edit" onclick="openRenameListModal(${list.id}, '${list.name}')" title="Rename"></button>
              <button class="icon-btn icon-delete" onclick="openDeleteListModal(${list.id}, '${list.name}')" title="Delete"></button>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="collab-list-actions">
        <button onclick="openCollaborativeList(${list.id}, '${list.name}', ${list.is_owner})">Open</button>
        ${list.is_owner ? `<button onclick="openManageMembersModal(${list.id}, '${list.name}')">Manage</button>` : ''}
      </div>
    `;
    container.appendChild(listEl);
  });
}

async function openCollaborativeList(listId, listName, isOwner) {
  currentCollaborativeList = { id: listId, name: listName, is_owner: isOwner };
  
  try {
    collaborativeTasks = await getCollaborativeTasks(listId);
    const container = document.getElementById("collaborative-lists-container");
    container.innerHTML = `
      <div class="collab-list-detail">
        <div class="collab-header">
          <button onclick="loadCollaborativeLists()" class="back-btn">← Back</button>
          <h2>${listName}</h2>
          <button onclick="addCollaborativeTask()" class="add-btn">+ Add Task</button>
        </div>
        <div id="collab-tasks-container"></div>
      </div>
    `;
    renderCollaborativeTasks();
  } catch (err) {
    console.error("Error loading tasks:", err);
  }
}

function renderCollaborativeTasks() {
  const container = document.getElementById("collab-tasks-container");
  if (!container) return;

  container.innerHTML = "";
  collaborativeTasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.className = `task-item ${getPriorityClass(task.priority || "Mid")}`;

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!task.checked;
    cb.addEventListener("change", () => openCollaborativeDoneModal(cb, index));

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;

    label.appendChild(cb);
    label.appendChild(span);
    li.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.innerHTML = `
      <button class="icon-btn icon-edit" title="Edit"></button>
      <button class="icon-btn icon-delete" title="Delete"></button>
    `;
    actions.querySelector(".icon-edit").addEventListener("click", () => openCollaborativeRenameModal(index));
    actions.querySelector(".icon-delete").addEventListener("click", () => openCollaborativeDeleteModal(index));

    li.appendChild(actions);
    container.appendChild(li);
  });
}

async function addCollaborativeTask() {
  window.isCollaborativeMode = true;
  addModal.style.display = "flex";
}

// Personal Tasks Management
function getPriorityClass(p) {
  if (p === "High") return "high-priority";
  if (p === "Low") return "low-priority";
  return "mid-priority";
}

function renderTodos() {
  if (!listWeek || !listMonth || !listPersonal || !listDone) return;

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
    sortedTodos.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
  }

  const now = new Date();
  sortedTodos.forEach(task => {
    const li = createTaskElement(task);

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
        const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());

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

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = `task-item ${getPriorityClass(task.priority || "Mid")}`;

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
  return li;
}

// Modal Handlers
async function handleCreateList() {
  const name = document.getElementById("list-name-input").value.trim();
  if (!name) {
    alert("Please enter a list name");
    return;
  }

  try {
    await createCollaborativeList(name);
    document.getElementById("list-name-input").value = "";
    document.getElementById("create-list-modal").style.display = "none";
    await loadCollaborativeLists();
    await loadAllEventsToCalendar();
  } catch (err) {
    console.error("Error creating list:", err);
    alert("Failed to create list");
  }
}

async function handleRenameList() {
  const newName = document.getElementById("rename-list-input").value.trim();
  if (!newName) {
    alert("Please enter a list name");
    return;
  }

  try {
    await renameCollaborativeList(currentListToRename, newName);
    document.getElementById("rename-list-modal").style.display = "none";
    await loadCollaborativeLists();
    await loadAllEventsToCalendar();
  } catch (err) {
    console.error("Error renaming list:", err);
    alert("Failed to rename list");
  }
}

async function handleDeleteList() {
  try {
    lastDeletedList = { ...currentListToDelete };
    await deleteCollaborativeList(currentListToDelete.id);
    document.getElementById("delete-list-modal").style.display = "none";
    await loadCollaborativeLists();
    await loadAllEventsToCalendar();
    showToast(`List "${currentListToDelete.name}" deleted`);
  } catch (err) {
    console.error("Error deleting list:", err);
    alert("Failed to delete list");
  }
}

async function handleAddMember() {
  const username = document.getElementById("member-username-input").value.trim();
  const errorEl = document.getElementById("member-error-message");
  const successEl = document.getElementById("member-success-message");
  
  errorEl.style.display = "none";
  successEl.style.display = "none";

  if (!username) {
    errorEl.textContent = "Please enter a username";
    errorEl.style.display = "block";
    return;
  }

  try {
    const result = await addListMember(currentCollaborativeList.id, username);
    
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.style.display = "block";
      return;
    }

    document.getElementById("member-username-input").value = "";
    successEl.textContent = `✓ ${username} added successfully!`;
    successEl.style.display = "block";
    
    setTimeout(() => successEl.style.display = "none", 3000);
    await loadMembersForModal(currentCollaborativeList.id);
  } catch (err) {
    console.error("Error adding member:", err);
    errorEl.textContent = err.message || "Failed to add member";
    errorEl.style.display = "block";
  }
}

async function handleAddTask() {
  const text = taskNameInput.value.trim();
  if (!text) return alert("Please enter a task name.");

  const dateTime = taskDateInput.value
    ? taskTimeInput.value
      ? `${taskDateInput.value}T${taskTimeInput.value}`
      : taskDateInput.value
    : "";

  if (window.isCollaborativeMode && currentCollaborativeList) {
    try {
      const newTask = await createCollaborativeTask(currentCollaborativeList.id, {
        text,
        date: dateTime,
        checked: false,
        priority: taskPriorityInput.value || "Mid",
      });
      collaborativeTasks.push(newTask);
      renderCollaborativeTasks();
      await loadAllEventsToCalendar();
      closeAddModal();
    } catch (err) {
      console.error("Error adding task:", err);
      alert("Failed to add task");
    }
  } else {
    const created = await apiCreate({
      text,
      date: dateTime,
      checked: false,
      priority: taskPriorityInput.value || "Mid",
    });
    todos.push(created);
    await loadAllEventsToCalendar();
    closeAddModal();
    renderTodos();
  }
}

async function handleRenameTask() {
  const newText = renameTaskNameInput.value.trim();
  if (!newText) return alert("Task cannot be empty.");

  const newDateTime = renameTaskDateInput.value
    ? renameTaskTimeInput.value
      ? `${renameTaskDateInput.value}T${renameTaskTimeInput.value}`
      : renameTaskDateInput.value
    : "";

  if (window.isCollaborativeMode && collaborativeTaskIndex !== null) {
    try {
      const task = collaborativeTasks[collaborativeTaskIndex];
      const updated = await updateCollaborativeTask(currentCollaborativeList.id, task.id, {
        text: newText,
        priority: renameTaskPriorityInput.value || "Mid",
        date: newDateTime || "",
      });
      collaborativeTasks[collaborativeTaskIndex] = updated;
      renderCollaborativeTasks();
      await loadAllEventsToCalendar();
      closeRenameModal();
    } catch (err) {
      console.error("Error updating task:", err);
      alert("Failed to update task");
    }
  } else {
    const id = todos[renameIndex].id;
    const updated = await apiUpdate(id, {
      text: newText,
      priority: renameTaskPriorityInput.value || "Mid",
      date: newDateTime || "",
    });
    todos[renameIndex] = updated;
    await loadAllEventsToCalendar();
    closeRenameModal();
    renderTodos();
  }
}

async function handleDeleteTask() {
  if (window.isCollaborativeMode && collaborativeTaskIndex !== null) {
    try {
      const task = collaborativeTasks[collaborativeTaskIndex];
      lastDeletedCollaborative = { ...task };
      lastDeletedListId = currentCollaborativeList.id;
      lastDeleted = null;
      
      await deleteCollaborativeTask(currentCollaborativeList.id, task.id);
      collaborativeTasks.splice(collaborativeTaskIndex, 1);
      renderCollaborativeTasks();
      await loadAllEventsToCalendar();
      closeDeleteModal();
      showToast(`Task "${task.text}" deleted.`);
    } catch (err) {
      console.error("Error deleting task:", err);
      alert("Failed to delete task");
    }
  } else {
    const task = todos[deleteIndex];
    lastDeleted = { ...task };
    lastDeletedCollaborative = null;
    lastDeletedListId = null;
    
    await apiDelete(task.id);
    todos.splice(deleteIndex, 1);
    await loadAllEventsToCalendar();
    closeDeleteModal();
    renderTodos();
    showToast(`Task "${task.text}" deleted.`);
  }
}

async function handleUndoToast() {
  if (lastDeletedList) {
    try {
      await createCollaborativeList(lastDeletedList.name);
      await loadCollaborativeLists();
      await loadAllEventsToCalendar();
      hideToast();
      lastDeletedList = null;
    } catch (err) {
      console.error("Error restoring list:", err);
      alert("Failed to restore list");
    }
  } else if (lastDeletedCollaborative && lastDeletedListId) {
    try {
      const restored = await createCollaborativeTask(lastDeletedListId, lastDeletedCollaborative);
      collaborativeTasks.push(restored);
      renderCollaborativeTasks();
      await loadAllEventsToCalendar();
      hideToast();
      lastDeletedCollaborative = null;
      lastDeletedListId = null;
    } catch (err) {
      console.error("Error restoring task:", err);
      alert("Failed to restore task");
    }
  } else if (lastDeleted) {
    const restored = await apiCreate(lastDeleted);
    todos.push(restored);
    await loadAllEventsToCalendar();
    renderTodos();
    hideToast();
    lastDeleted = null;
  }
}

// Modal Operations
function openRenameListModal(listId, currentName) {
  currentListToRename = listId;
  document.getElementById("rename-list-input").value = currentName;
  document.getElementById("rename-list-modal").style.display = "flex";
}

function openDeleteListModal(listId, listName) {
  currentListToDelete = { id: listId, name: listName };
  document.getElementById("delete-list-modal").style.display = "flex";
}

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

  const titleEl = doneModal.querySelector("h2");
  const textEl = doneModal.querySelector("p");

  if (cb.checked) {
    if (titleEl) titleEl.textContent = "Mark Task as Done";
    if (textEl) textEl.textContent = "Do you want to mark this task as done?";
  } else {
    if (titleEl) titleEl.textContent = "Mark Task as Not Done";
    if (textEl) textEl.textContent = "Do you want to mark this task as not done?";
  }

  cb.checked = !cb.checked;

  doneTaskConfirmBtn.onclick = () => {
    toggleTask(index);
    closeDoneModal();
  };
}

function openCollaborativeRenameModal(index) {
  window.isCollaborativeMode = true;
  collaborativeTaskIndex = index;
  const task = collaborativeTasks[index];
  
  renameTaskNameInput.value = task.text;
  renameTaskPriorityInput.value = task.priority || "Mid";
  
  if (task.date) {
    const [d, t] = task.date.split("T");
    renameTaskDateInput.value = d || "";
    renameTaskTimeInput.value = t || "";
  } else {
    renameTaskDateInput.value = "";
    renameTaskTimeInput.value = "";
  }
  
  renameModal.style.display = "flex";
}

function openCollaborativeDeleteModal(index) {
  window.isCollaborativeMode = true;
  collaborativeTaskIndex = index;
  deleteModal.style.display = "flex";
}

function openCollaborativeDoneModal(cb, index) {
  window.isCollaborativeMode = true;
  collaborativeTaskIndex = index;
  doneModal.style.display = "flex";

  const titleEl = doneModal.querySelector("h2");
  const textEl = doneModal.querySelector("p");

  if (cb.checked) {
    if (titleEl) titleEl.textContent = "Mark Task as Done";
    if (textEl) textEl.textContent = "Do you want to mark this task as done?";
  } else {
    if (titleEl) titleEl.textContent = "Mark Task as Not Done";
    if (textEl) textEl.textContent = "Do you want to mark this task as not done?";
  }

  cb.checked = !cb.checked;

  doneTaskConfirmBtn.onclick = async () => {
    await toggleCollaborativeTaskModal(collaborativeTaskIndex);
    closeDoneModal();
  };
}

async function toggleCollaborativeTaskModal(index) {
  const task = collaborativeTasks[index];
  try {
    await updateCollaborativeTask(currentCollaborativeList.id, task.id, { 
      checked: !task.checked 
    });
    task.checked = !task.checked;
    renderCollaborativeTasks();
    await loadAllEventsToCalendar();
  } catch (err) {
    console.error("Error toggling task:", err);
  }
}

async function openManageMembersModal(listId, listName) {
  currentCollaborativeList = { id: listId, name: listName };
  document.getElementById("manage-list-name").textContent = `List: ${listName}`;
  document.getElementById("manage-members-modal").style.display = "flex";
  await loadMembersForModal(listId);
}

async function loadMembersForModal(listId) {
  try {
    const members = await getListMembers(listId);
    const container = document.getElementById("members-list-container");
    
    let html = `
      <div id="member-error-message" class="error-message" style="display: none;"></div>
      <div id="member-success-message" class="success-message" style="display: none;"></div>
    `;
    
    if (members.length === 0) {
      html += '<p style="color: #999;">No members yet</p>';
    } else {
      html += members.map(m => `
        <div class="member-item">
          <div>
            <strong>${m.name}</strong> (@${m.username})
          </div>
          <button onclick="removeMemberHandler(${listId}, ${m.id})" class="remove-btn">Remove</button>
        </div>
      `).join("");
    }
    
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading members:", err);
  }
}

async function removeMemberHandler(listId, memberId) {
  try {
    await removeListMember(listId, memberId);
    await loadMembersForModal(listId);
  } catch (err) {
    console.error("Error removing member:", err);
  }
}

// Modal Close Functions
function closeAddModal() {
  addModal.style.display = "none";
  taskNameInput.value = "";
  taskDateInput.value = "";
  taskTimeInput.value = "";
  taskPriorityInput.value = "Mid";
  window.isCollaborativeMode = false;
  collaborativeTaskIndex = null;
}

function closeRenameModal() {
  renameModal.style.display = "none";
  renameTaskNameInput.value = "";
  renameTaskDateInput.value = "";
  renameTaskTimeInput.value = "";
  renameTaskPriorityInput.value = "Mid";
  window.isCollaborativeMode = false;
  collaborativeTaskIndex = null;
}

function closeDeleteModal() {
  deleteModal.style.display = "none";
  window.isCollaborativeMode = false;
  collaborativeTaskIndex = null;
}

function closeDoneModal() {
  doneModal.style.display = "none";
  window.isCollaborativeMode = false;
  collaborativeTaskIndex = null;
  if (currentView === 'personal') {
    renderTodos();
  } else {
    renderCollaborativeTasks();
  }
}

// Task Operations
function toggleTask(index) {
  const id = todos[index].id;
  apiToggle(id).then(updated => {
    todos[index] = updated;
    loadAllEventsToCalendar();
    renderTodos();
  });
}

// Toast Notifications
function showToast(msg) {
  if (!toast) return;
  toastMsg.textContent = msg;
  toast.classList.add("show");
  setTimeout(hideToast, 5000);
}

function hideToast() {
  toast.classList.remove("show");
}

// User Profile
async function loadUserProfile() {
  try {
    const response = await fetch('/api/current-user');
    const user = await response.json();
    
    if (response.ok) {
      const initial = (user.name || user.username || 'U').charAt(0).toUpperCase();
      document.getElementById('left-profile-initial').textContent = initial;
    }
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}
