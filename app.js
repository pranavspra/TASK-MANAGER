(() => {
  const API_URL = "/api/tasks";
  const LS_KEY = "taskmanager.tasks";

  const els = {
    form: document.getElementById("task-form"),
    text: document.getElementById("task-text"),
    priority: document.getElementById("task-priority"),
    due: document.getElementById("task-due"),
    list: document.getElementById("task-list"),
    search: document.getElementById("search"),
    count: document.getElementById("count"),
    clearDone: document.getElementById("clear-done"),
    status: document.getElementById("status"),
    filters: document.querySelectorAll(".filter"),
  };

  let tasks = [];
  let filter = "all";
  let query = "";
  let serverOnline = false;

  // ---------- Storage ----------
  async function load() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("bad status " + res.status);
      tasks = await res.json();
      serverOnline = true;
    } catch {
      tasks = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      serverOnline = false;
    }
    if (!Array.isArray(tasks)) tasks = [];
    updateStatus();
    render();
  }

  async function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
    if (!serverOnline) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });
      if (!res.ok) throw new Error("bad status " + res.status);
    } catch {
      serverOnline = false;
      updateStatus();
    }
  }

  function updateStatus() {
    els.status.textContent = serverOnline
      ? "Saved to the C++ server"
      : "Server offline – saving in this browser only";
    els.status.classList.toggle("offline", !serverOnline);
  }

  // ---------- Helpers ----------
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function isOverdue(task) {
    if (!task.due || task.done) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.due + "T00:00:00") < today;
  }

  function formatDate(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };

  function visibleTasks() {
    return tasks
      .filter((t) => (filter === "active" ? !t.done : filter === "done" ? t.done : true))
      .filter((t) => t.text.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return (a.due || "9999").localeCompare(b.due || "9999");
      });
  }

  // ---------- Rendering ----------
  function render() {
    els.list.textContent = "";
    const shown = visibleTasks();

    if (shown.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = tasks.length ? "No tasks match." : "Nothing to do. Add a task above.";
      els.list.appendChild(li);
    }

    for (const task of shown) els.list.appendChild(renderTask(task));

    const left = tasks.filter((t) => !t.done).length;
    els.count.textContent = left + (left === 1 ? " task left" : " tasks left");
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.addEventListener("change", () => {
      task.done = check.checked;
      save();
      render();
    });

    const body = document.createElement("div");
    body.className = "task-body";

    const text = document.createElement("div");
    text.className = "task-text";
    text.textContent = task.text;
    text.title = "Double-click to edit";
    text.addEventListener("dblclick", () => startEdit(task, text));

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const badge = document.createElement("span");
    badge.className = "badge " + task.priority;
    badge.textContent = task.priority;
    meta.appendChild(badge);

    if (task.due) {
      const due = document.createElement("span");
      due.textContent = (isOverdue(task) ? "Overdue: " : "Due ") + formatDate(task.due);
      if (isOverdue(task)) due.className = "overdue";
      meta.appendChild(due);
    }

    body.append(text, meta);

    const del = document.createElement("button");
    del.className = "delete";
    del.setAttribute("aria-label", "Delete task");
    del.textContent = "×";
    del.addEventListener("click", () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      save();
      render();
    });

    li.append(check, body, del);
    return li;
  }

  function startEdit(task, textEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = task.text;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (commit && value) task.text = value;
      save();
      render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ---------- Events ----------
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.text.value.trim();
    if (!text) return;
    tasks.push({
      id: newId(),
      text,
      priority: els.priority.value,
      due: els.due.value || "",
      done: false,
      created: new Date().toISOString(),
    });
    els.text.value = "";
    els.due.value = "";
    els.priority.value = "medium";
    save();
    render();
    els.text.focus();
  });

  els.search.addEventListener("input", () => {
    query = els.search.value.trim().toLowerCase();
    render();
  });

  els.filters.forEach((btn) =>
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      els.filters.forEach((b) => b.classList.toggle("active", b === btn));
      render();
    })
  );

  els.clearDone.addEventListener("click", () => {
    tasks = tasks.filter((t) => !t.done);
    save();
    render();
  });

  load();
})();
