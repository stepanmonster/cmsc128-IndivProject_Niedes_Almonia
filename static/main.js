// Constants & Config
const PRIORITY_COLORS = { High: "red", Mid: "orange", Low: "green" };
const API = "/api";
const HEADERS = { "Content-Type": "application/json" };

// State
let state = {
  todos: [], calendar: null, currentView: 'personal', collaborativeLists: [],
  currentCollaborativeList: null, collaborativeTasks: [], renameIndex: null,
  deleteIndex: null, doneIndex: null, lastDeleted: null, collaborativeTaskIndex: null,
  lastDeletedCollaborative: null, lastDeletedListId: null, currentListToRename: null,
  currentListToDelete: null, lastDeletedList: null, isCollaborativeMode: false
};

// Utilities
const $ = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);
const escape = (txt) => { const d = document.createElement('div'); d.textContent = txt; return d.innerHTML; };
const modal = { show: (id) => $(id).style.display = "flex", hide: (id) => $(id).style.display = "none" };
const getPriorityClass = (p) => p === "High" ? "high-priority" : p === "Low" ? "low-priority" : "mid-priority";
const getDateTime = () => $("task-date").value ? ($("task-time").value ? `${$("task-date").value}T${$("task-time").value}` : $("task-date").value) : null;
const getRenameDateTime = () => $("rename-task-date").value ? ($("rename-task-time").value ? `${$("rename-task-date").value}T${$("rename-task-time").value}` : $("rename-task-date").value) : null;
const formatTime = (txt, dt) => !dt?.includes("T") ? txt : `${txt} – ${new Date(dt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`;

// API Helper
const api = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, opts);
  return res.ok && opts.method !== 'DELETE' ? res.json() : res;
};

const jsonOpts = (method, body) => ({ method, headers: HEADERS, body: JSON.stringify(body) });

// Task APIs
const taskAPI = {
  list: () => api('/tasks'),
  create: (task) => api('/tasks', jsonOpts('POST', task)),
  update: (id, patch) => api(`/tasks/${id}`, jsonOpts('PUT', patch)),
  delete: (id) => api(`/tasks/${id}`, { method: 'DELETE' }),
  toggle: (id) => api(`/tasks/${id}/toggle`, { method: 'PATCH' })
};

// Collaborative APIs
const collabAPI = {
  lists: {
    getAll: () => api('/collaborative-lists'),
    create: (name) => api('/collaborative-lists', jsonOpts('POST', { name })),
    rename: (id, name) => api(`/collaborative-lists/${id}`, jsonOpts('PUT', { name })),
    delete: (id) => api(`/collaborative-lists/${id}`, { method: 'DELETE' })
  },
  tasks: {
    getAll: (lid) => api(`/collaborative-lists/${lid}/tasks`),
    create: (lid, task) => api(`/collaborative-lists/${lid}/tasks`, jsonOpts('POST', task)),
    update: (lid, tid, patch) => api(`/collaborative-lists/${lid}/tasks/${tid}`, jsonOpts('PUT', patch)),
    delete: (lid, tid) => api(`/collaborative-lists/${lid}/tasks/${tid}`, { method: 'DELETE' })
  },
  members: {
    getAll: (lid) => api(`/collaborative-lists/${lid}/members`),
    add: (lid, username) => api(`/collaborative-lists/${lid}/members`, jsonOpts('POST', { username })),
    remove: (lid, mid) => api(`/collaborative-lists/${lid}/members/${mid}`, { method: 'DELETE' })
  }
};

// Calendar
const calendar = {
  async loadAll() {
    if (!state.calendar) return;
    state.calendar.removeAllEvents();
    
    state.todos.forEach(t => t.date && !t.checked && this.add(t.text, t.date, PRIORITY_COLORS[t.priority || "Mid"]));
    
    for (const list of state.collaborativeLists) {
      try {
        const tasks = await collabAPI.tasks.getAll(list.id);
        tasks.forEach(t => t.date && !t.checked && this.add(`[${list.name}] ${t.text}`, t.date, "#3b82f6"));
      } catch (e) { console.error(e); }
    }
  },
  
  add(text, dt, color) {
    state.calendar.addEvent({ title: formatTime(text, dt), start: dt, allDay: true, color });
  }
};

// Toast
const toast = {
  show(msg) {
    if (!$("toast")) return;
    $("toast-message").textContent = msg;
    $("toast").classList.add("show");
    setTimeout(() => $("toast").classList.remove("show"), 5000);
  }
};

// View Switch
const switchView = (view) => {
  state.currentView = view;
  const isPersonal = view === "personal";
  $("personal-view").style.display = isPersonal ? "block" : "none";
  $("collaborative-view").style.display = isPersonal ? "none" : "block";
  $("nav-personal").classList.toggle("active", isPersonal);
  $("nav-collaborative").classList.toggle("active", !isPersonal);
  if (!isPersonal) loadCollabLists();
};

// Render Personal Tasks
function renderTodos() {
  if (!$("list-week")) return;
  
  ["list-week", "list-month", "list-personal", "list-done"].forEach(id => $(id).innerHTML = "");
  
  const sorted = [...state.todos];
  const criteria = $("sort-select")?.value;
  
  if (criteria === "dateAdded") sorted.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  else if (criteria === "dueDate") sorted.sort((a, b) => !a.date ? 1 : !b.date ? -1 : new Date(a.date) - new Date(b.date));
  else if (criteria === "priority") sorted.sort((a, b) => ({ High: 1, Mid: 2, Low: 3 }[a.priority] ?? 99) - ({ High: 1, Mid: 2, Low: 3 }[b.priority] ?? 99));
  
  const now = new Date();
  sorted.forEach(task => {
    const li = createTaskEl(task, false);
    if (task.checked) return $("list-done").appendChild(li);
    
    const due = task.date ? new Date(task.date) : null;
    if (!due) return $("list-personal").appendChild(li);
    
    const sow = new Date(now); sow.setDate(now.getDate() - now.getDay());
    const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dd = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    if (dd >= sow && dd <= eow) $("list-week").appendChild(li);
    else if (dd <= eom) $("list-month").appendChild(li);
    else $("list-personal").appendChild(li);
  });
}

// Create Task Element
function createTaskEl(task, isCollab) {
  const li = document.createElement("li");
  li.className = `task-item ${getPriorityClass(task.priority || "Mid")}`;
  
  const label = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!task.checked;
  cb.addEventListener("change", () => isCollab ? openCollabDoneModal(cb, state.collaborativeTasks.indexOf(task)) : openDoneModal(cb, state.todos.indexOf(task)));
  
  const span = document.createElement("span");
  span.className = "task-text";
  span.textContent = task.text;
  
  label.append(cb, span);
  li.appendChild(label);
  
  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.innerHTML = '<button class="icon-btn icon-edit" title="Edit"></button><button class="icon-btn icon-delete" title="Delete"></button>';
  
  const idx = isCollab ? state.collaborativeTasks.indexOf(task) : state.todos.indexOf(task);
  actions.querySelector(".icon-edit").addEventListener("click", () => isCollab ? openCollabRenameModal(idx) : openRenameModal(idx));
  actions.querySelector(".icon-delete").addEventListener("click", () => isCollab ? openCollabDeleteModal(idx) : openDeleteModal(idx));
  
  li.appendChild(actions);
  return li;
}

// Load Collaborative Lists
async function loadCollabLists() {
  try {
    state.collaborativeLists = await collabAPI.lists.getAll();
    renderCollabLists();
  } catch (e) { console.error(e); }
}

function renderCollabLists() {
  const c = $("collaborative-lists-container");
  if (!c) return;
  
  c.innerHTML = "";
  
  state.collaborativeLists.forEach(list => {
    const listEl = document.createElement("div");
    listEl.className = "collab-list-item";
    
    // Backend returns "is_owner" not "isowner"
    const isOwner = list.is_owner;
    
    listEl.innerHTML = `
      <div class="collab-list-header">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <h3>${escape(list.name)}</h3>
            <span class="list-owner">${isOwner ? 'Owner' : `by ${list.owner}`}</span>
          </div>
          ${isOwner ? `
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="icon-btn icon-edit" onclick="openRenameListModal('${list.id}', '${escape(list.name)}')" title="Rename"></button>
            <button class="icon-btn icon-delete" onclick="openDeleteListModal('${list.id}', '${escape(list.name)}')" title="Delete"></button>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="collab-list-actions">
        <button onclick="openCollabList('${list.id}', '${escape(list.name)}', ${isOwner})">Open</button>
        ${isOwner ? `<button onclick="openManageMembers('${list.id}', '${escape(list.name)}')">Manage</button>` : ''}
      </div>
    `;
    c.appendChild(listEl);
  });
}

async function openCollabList(lid, name, isOwner) {
  state.currentCollaborativeList = { id: lid, name, isowner: isOwner }; // Keep as isowner for consistency
  try {
    state.collaborativeTasks = await collabAPI.tasks.getAll(lid);
    $("collaborative-lists-container").innerHTML = `
      <div class="collab-list-detail">
        <div class="collab-header">
          <button onclick="loadCollabLists()" class="back-btn">← Back</button>
          <h2>${escape(name)}</h2>
          <button onclick="addCollabTask()" class="add-btn">+ Add Task</button>
        </div>
        <div id="collab-tasks-container"></div>
      </div>`;
    renderCollabTasks();
  } catch (e) { console.error(e); }
}



async function openCollabList(lid, name, isOwner) {
  state.currentCollaborativeList = { id: lid, name, isowner: isOwner };
  try {
    state.collaborativeTasks = await collabAPI.tasks.getAll(lid);
    $("collaborative-lists-container").innerHTML = `
      <div class="collab-list-detail">
        <div class="collab-header">
          <button onclick="loadCollabLists()" class="back-btn">← Back</button>
          <h2>${escape(name)}</h2>
          <button onclick="addCollabTask()" class="add-btn">+ Add Task</button>
        </div>
        <div id="collab-tasks-container"></div>
      </div>`;
    renderCollabTasks();
  } catch (e) { console.error(e); }
}

function renderCollabTasks() {
  const c = $("collab-tasks-container");
  if (!c) return;
  c.innerHTML = "";
  state.collaborativeTasks.forEach((t, i) => c.appendChild(createTaskEl(t, true)));
}

// Handlers
async function handleCreateList() {
  const name = $("list-name-input").value.trim();
  if (!name) return alert("Please enter a list name");
  try {
    await collabAPI.lists.create(name);
    $("list-name-input").value = "";
    modal.hide("create-list-modal");
    await loadCollabLists();
    await calendar.loadAll();
  } catch (e) { console.error(e); alert("Failed to create list"); }
}

async function handleRenameList() {
  const name = $("rename-list-input").value.trim();
  if (!name) return alert("Please enter a list name");
  try {
    await collabAPI.lists.rename(state.currentListToRename, name);
    modal.hide("rename-list-modal");
    await loadCollabLists();
    await calendar.loadAll();
  } catch (e) { console.error(e); alert("Failed to rename list"); }
}

async function handleDeleteList() {
  try {
    state.lastDeletedList = { ...state.currentListToDelete };
    await collabAPI.lists.delete(state.currentListToDelete.id);
    modal.hide("delete-list-modal");
    await loadCollabLists();
    await calendar.loadAll();
    toast.show(`List "${state.currentListToDelete.name}" deleted`);
  } catch (e) { console.error(e); alert("Failed to delete list"); }
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
    // call fetch directly so we can inspect status
    const res = await fetch(`/api/collaborative-lists/${state.currentCollaborativeList.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });

    const data = await res.json();

    if (!res.ok) {
      // backend already sends messages like "User not found", "User is already a member", etc.
      errorEl.textContent = data.error || "Failed to add member";
      errorEl.style.display = "block";
      return;
    }

    // success path
    document.getElementById("member-username-input").value = "";
    successEl.textContent = `${username} added successfully!`;
    successEl.style.display = "block";
    setTimeout(() => (successEl.style.display = "none"), 3000);
    await loadMembersForModal(state.currentCollaborativeList.id);
  } catch (err) {
    console.error("Error adding member:", err);
    errorEl.textContent = "Failed to add member";
    errorEl.style.display = "block";
  }
}


async function handleAddTask() {
  const text = $("task-name").value.trim();
  if (!text) return alert("Please enter a task name");
  const dt = getDateTime();
  const priority = $("task-priority").value || "Mid";
  
  if (state.isCollaborativeMode && state.currentCollaborativeList) {
    try {
      const task = await collabAPI.tasks.create(state.currentCollaborativeList.id, { text, date: dt, checked: false, priority });
      state.collaborativeTasks.push(task);
      renderCollabTasks();
      await calendar.loadAll();
      closeAddModal();
    } catch (e) { console.error(e); alert("Failed to add task"); }
  } else {
    const task = await taskAPI.create({ text, date: dt, checked: false, priority });
    state.todos.push(task);
    await calendar.loadAll();
    closeAddModal();
    renderTodos();
  }
}

async function handleRenameTask() {
  const text = $("rename-task-name").value.trim();
  if (!text) return alert("Task cannot be empty");
  const dt = getRenameDateTime();
  const priority = $("rename-task-priority").value || "Mid";
  
  if (state.isCollaborativeMode && state.collaborativeTaskIndex !== null) {
    try {
      const t = state.collaborativeTasks[state.collaborativeTaskIndex];
      const updated = await collabAPI.tasks.update(state.currentCollaborativeList.id, t.id, { text, priority, date: dt });
      state.collaborativeTasks[state.collaborativeTaskIndex] = updated;
      renderCollabTasks();
      await calendar.loadAll();
      closeRenameModal();
    } catch (e) { console.error(e); alert("Failed to update task"); }
  } else {
    const id = state.todos[state.renameIndex].id;
    const updated = await taskAPI.update(id, { text, priority, date: dt });
    state.todos[state.renameIndex] = updated;
    await calendar.loadAll();
    closeRenameModal();
    renderTodos();
  }
}

async function handleDeleteTask() {
  if (state.isCollaborativeMode && state.collaborativeTaskIndex !== null) {
    try {
      const t = state.collaborativeTasks[state.collaborativeTaskIndex];
      state.lastDeletedCollaborative = { ...t };
      state.lastDeletedListId = state.currentCollaborativeList.id;
      state.lastDeleted = null;
      await collabAPI.tasks.delete(state.currentCollaborativeList.id, t.id);
      state.collaborativeTasks.splice(state.collaborativeTaskIndex, 1);
      renderCollabTasks();
      await calendar.loadAll();
      closeDeleteModal();
      toast.show(`Task "${t.text}" deleted`);
    } catch (e) { console.error(e); alert("Failed to delete task"); }
  } else {
    const t = state.todos[state.deleteIndex];
    state.lastDeleted = { ...t };
    state.lastDeletedCollaborative = state.lastDeletedListId = null;
    await taskAPI.delete(t.id);
    state.todos.splice(state.deleteIndex, 1);
    await calendar.loadAll();
    closeDeleteModal();
    renderTodos();
    toast.show(`Task "${t.text}" deleted`);
  }
}

async function handleUndo() {
  if (state.lastDeletedList) {
    try {
      await collabAPI.lists.create(state.lastDeletedList.name);
      await loadCollabLists();
      await calendar.loadAll();
      $("toast").classList.remove("show");
      state.lastDeletedList = null;
    } catch (e) { console.error(e); alert("Failed to restore"); }
  } else if (state.lastDeletedCollaborative && state.lastDeletedListId) {
    try {
      const restored = await collabAPI.tasks.create(state.lastDeletedListId, state.lastDeletedCollaborative);
      state.collaborativeTasks.push(restored);
      renderCollabTasks();
      await calendar.loadAll();
      $("toast").classList.remove("show");
      state.lastDeletedCollaborative = state.lastDeletedListId = null;
    } catch (e) { console.error(e); alert("Failed to restore"); }
  } else if (state.lastDeleted) {
    const restored = await taskAPI.create(state.lastDeleted);
    state.todos.push(restored);
    await calendar.loadAll();
    renderTodos();
    $("toast").classList.remove("show");
    state.lastDeleted = null;
  }
}

// Modal Operations
function openRenameListModal(lid, name) {
  state.currentListToRename = lid;
  $("rename-list-input").value = name;
  modal.show("rename-list-modal");
}

function openDeleteListModal(lid, name) {
  state.currentListToDelete = { id: lid, name };
  modal.show("delete-list-modal");
}

function openRenameModal(idx) {
  state.renameIndex = idx;
  const t = state.todos[idx];
  $("rename-task-name").value = t.text;
  $("rename-task-priority").value = t.priority || "Mid";
  if (t.date) {
    const [d, tm] = t.date.split("T");
    $("rename-task-date").value = d;
    $("rename-task-time").value = tm || "";
  }
  modal.show("rename-task-modal");
}

function openDeleteModal(idx) {
  state.deleteIndex = idx;
  modal.show("delete-task-modal");
}

function openDoneModal(cb, idx) {
  modal.show("done-task-modal");
  const title = $("done-task-modal").querySelector("h2");
  const text = $("done-task-modal").querySelector("p");
  if (cb.checked) {
    if (title) title.textContent = "Mark Task as Done";
    if (text) text.textContent = "Do you want to mark this task as done?";
  } else {
    if (title) title.textContent = "Mark Task as Not Done";
    if (text) text.textContent = "Do you want to mark this task as not done?";
  }
  cb.checked = !cb.checked;
  $("done-task-confirm").onclick = () => { toggleTask(idx); closeDoneModal(); };
}

function openCollabRenameModal(idx) {
  state.isCollaborativeMode = true;
  state.collaborativeTaskIndex = idx;
  const t = state.collaborativeTasks[idx];
  $("rename-task-name").value = t.text;
  $("rename-task-priority").value = t.priority || "Mid";
  if (t.date) {
    const [d, tm] = t.date.split("T");
    $("rename-task-date").value = d;
    $("rename-task-time").value = tm || "";
  } else {
    $("rename-task-date").value = $("rename-task-time").value = "";
  }
  modal.show("rename-task-modal");
}

function openCollabDeleteModal(idx) {
  state.isCollaborativeMode = true;
  state.collaborativeTaskIndex = idx;
  modal.show("delete-task-modal");
}

function openCollabDoneModal(cb, idx) {
  state.isCollaborativeMode = true;
  state.collaborativeTaskIndex = idx;
  modal.show("done-task-modal");
  const title = $("done-task-modal").querySelector("h2");
  const text = $("done-task-modal").querySelector("p");
  if (cb.checked) {
    if (title) title.textContent = "Mark Task as Done";
    if (text) text.textContent = "Do you want to mark this task as done?";
  } else {
    if (title) title.textContent = "Mark Task as Not Done";
    if (text) text.textContent = "Do you want to mark this task as not done?";
  }
  cb.checked = !cb.checked;
  $("done-task-confirm").onclick = async () => { await toggleCollabTask(state.collaborativeTaskIndex); closeDoneModal(); };
}

async function toggleCollabTask(idx) {
  const t = state.collaborativeTasks[idx];
  try {
    await collabAPI.tasks.update(state.currentCollaborativeList.id, t.id, { checked: !t.checked });
    t.checked = !t.checked;
    renderCollabTasks();
    await calendar.loadAll();
  } catch (e) { console.error(e); }
}

async function openManageMembers(lid, name) {
  state.currentCollaborativeList = { id: lid, name };
  $("manage-list-name").textContent = `List: ${name}`;
  modal.show("manage-members-modal");
  await loadMembersForModal(lid);
}

async function loadMembersForModal(lid) {
  try {
    const members = await collabAPI.members.getAll(lid);
    const c = $("members-list-container");
    c.innerHTML = `<div id="member-error-message" class="error-message" style="display:none"></div><div id="member-success-message" class="success-message" style="display:none"></div>` +
      (members.length === 0 ? '<p style="color:#999">No members yet</p>' : members.map(m => `
        <div class="member-item">
          <div><strong>${escape(m.name)}</strong> (${escape(m.username)})</div>
          <button onclick="removeMember('${lid}','${m.id}')" class="remove-btn">Remove</button>
        </div>`).join(''));
  } catch (e) { console.error(e); }
}

async function removeMember(lid, mid) {
  try {
    await collabAPI.members.remove(lid, mid);
    await loadMembersForModal(lid);
  } catch (e) { console.error(e); }
}

function closeAddModal() {
  modal.hide("add-task-modal");
  $("task-name").value = $("task-date").value = $("task-time").value = "";
  $("task-priority").value = "Mid";
  state.isCollaborativeMode = false;
  state.collaborativeTaskIndex = null;
}

function closeRenameModal() {
  modal.hide("rename-task-modal");
  $("rename-task-name").value = $("rename-task-date").value = $("rename-task-time").value = "";
  $("rename-task-priority").value = "Mid";
  state.isCollaborativeMode = false;
  state.collaborativeTaskIndex = null;
}

function closeDeleteModal() {
  modal.hide("delete-task-modal");
  state.isCollaborativeMode = false;
  state.collaborativeTaskIndex = null;
}

function closeDoneModal() {
  modal.hide("done-task-modal");
  state.isCollaborativeMode = false;
  state.collaborativeTaskIndex = null;
  state.currentView === "personal" ? renderTodos() : renderCollabTasks();
}

function toggleTask(idx) {
  const id = state.todos[idx].id;
  taskAPI.toggle(id).then(updated => {
    state.todos[idx] = updated;
    calendar.loadAll();
    renderTodos();
  });
}

function addCollabTask() {
  state.isCollaborativeMode = true;
  modal.show("add-task-modal");
}

async function loadUserProfile() {
  try {
    const res = await fetch("/api/current-user");
    const user = await res.json();
    if (res.ok) {
      const initial = (user.name || user.username || "U").charAt(0).toUpperCase();
      $("left-profile-initial").textContent = initial;
    }
  } catch (e) { console.error(e); }
}

// Setup
function setup() {
  $("nav-personal")?.addEventListener("click", () => switchView("personal"));
  $("nav-collaborative")?.addEventListener("click", () => switchView("collaborative"));
  $("create-list-btn")?.addEventListener("click", () => modal.show("create-list-modal"));
  $("create-list-cancel")?.addEventListener("click", () => modal.hide("create-list-modal"));
  $("create-list-confirm")?.addEventListener("click", handleCreateList);
  $("rename-list-cancel")?.addEventListener("click", () => modal.hide("rename-list-modal"));
  $("rename-list-confirm")?.addEventListener("click", handleRenameList);
  $("delete-list-cancel")?.addEventListener("click", () => modal.hide("delete-list-modal"));
  $("delete-list-confirm")?.addEventListener("click", handleDeleteList);
  $("manage-members-close")?.addEventListener("click", () => modal.hide("manage-members-modal"));
  $("add-member-btn")?.addEventListener("click", handleAddMember);
  $("left-profile-btn")?.addEventListener("click", () => window.location.href = '/settings');
  $("add-task-btn")?.addEventListener("click", () => modal.show("add-task-modal"));
  $("mobile-add-task-btn")?.addEventListener("click", () => modal.show("add-task-modal"));
  $("add-task-cancel")?.addEventListener("click", closeAddModal);
  $("rename-task-cancel")?.addEventListener("click", closeRenameModal);
  $("delete-task-cancel")?.addEventListener("click", closeDeleteModal);
  $("done-task-cancel")?.addEventListener("click", closeDoneModal);
  $("add-task-confirm")?.addEventListener("click", handleAddTask);
  $("rename-task-confirm")?.addEventListener("click", handleRenameTask);
  $("delete-task-confirm")?.addEventListener("click", handleDeleteTask);
}

// Init
document.addEventListener("DOMContentLoaded", async () => {
  const cal = $("calendar");
  if (cal) {
    state.calendar = new FullCalendar.Calendar(cal, {
      initialView: "dayGridMonth",
      height: "100%",
      events: [],
      headerToolbar: { left: 'prev,next', center: 'title', right: '' }
    });
    state.calendar.render();
    state.todos = await taskAPI.list();
    state.collaborativeLists = await collabAPI.lists.getAll();
    await calendar.loadAll();
    renderTodos();
    loadUserProfile();
    $("sort-select")?.addEventListener("change", renderTodos);
    $("toast-undo")?.addEventListener("click", handleUndo);
  }
  setup();
});
