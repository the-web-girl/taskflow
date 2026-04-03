
/* ====================================================
   TASKFLOW – APPLICATION JAVASCRIPT
   State management, CRUD, Kanban, Calendar, API calls
==================================================== */

// ─── STATE ────────────────────────────────────────────
const STATE_KEY = 'taskflow_state';

const defaultState = () => ({
  tasks:    [],
  notes:    [],
  columns:  [
    { id: 'col-todo',       title: 'À faire',     color: '#2980b9' },
    { id: 'col-doing',      title: 'En cours',    color: '#e67e22' },
    { id: 'col-review',     title: 'En révision', color: '#6c3483' },
    { id: 'col-done',       title: 'Terminé',     color: '#2d6a4f' },
  ],
  projects: [],
  profile: { name: '', email: '', role: '' },
  google:  { clientId: '', apiKey: '', calendarId: 'primary', connected: false, events: [] },
  settings: { theme: 'light', accent: '#2d6a4f', fontSize: 15 },
  nextId: 1,
});

let state = defaultState();
let activeNote = null;
let calDate = new Date();
let dragCard = null;
let currentFilter = 'all';

// ─── PERSISTENCE ──────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    syncWithServer();
  } catch(e) { console.warn('Save failed', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed };
    }
  } catch(e) { state = defaultState(); }
}

// ─── SERVER SYNC (PHP) ────────────────────────────────
async function syncWithServer() {
  try {
    await fetch('api/sync.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state }),
    });
  } catch(e) { /* Offline – localStorage only */ }
}

async function loadFromServer() {
  try {
    const res = await fetch('api/sync.php?action=load');
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        state = { ...defaultState(), ...json.data };
        saveState();
      }
    }
  } catch(e) { /* Offline */ }
}

// ─── UTILITIES ────────────────────────────────────────
function uid() { return 'id-' + (state.nextId++) + '-' + Math.random().toString(36).slice(2,7); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
}

function isToday(iso) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso + 'T00:00:00');
  return d.getTime() === today.getTime();
}

function isThisWeek(iso) {
  if (!iso) return false;
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(now); end.setDate(end.getDate() + 7);
  const d = new Date(iso + 'T00:00:00');
  return d >= now && d <= end;
}

function isOverdue(iso) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso + 'T00:00:00');
  return d < today;
}

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function toast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.innerHTML = `<span aria-hidden="true">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  t.setAttribute('role', 'alert');
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

// ─── MODAL ────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  const first = m.querySelector('input, textarea, select, button');
  if (first) setTimeout(() => first.focus(), 80);
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

// ─── NAVIGATION ───────────────────────────────────────
const VIEW_TITLES = {
  dashboard: 'Tableau de bord', board: 'Tableau Kanban',
  tasks: 'Tâches', notes: 'Notes',
  calendar: 'Agenda', settings: 'Paramètres',
};

function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === viewId);
    n.setAttribute('aria-current', n.dataset.view === viewId ? 'page' : 'false');
  });
  const target = document.getElementById('view-' + viewId);
  if (target) target.classList.add('active');
  document.getElementById('page-title').textContent = VIEW_TITLES[viewId] || viewId;
  if (viewId === 'board')    renderBoard();
  if (viewId === 'tasks')    renderTaskList();
  if (viewId === 'notes')    renderNotesList();
  if (viewId === 'calendar') renderCalendar();
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'settings') renderSettingsPage();
  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

// ─── THEME ────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.settings.theme = theme;
  const li = document.getElementById('theme-icon-light');
  const di = document.getElementById('theme-icon-dark');
  if (theme === 'dark') { li.style.display = 'none'; di.style.display = ''; }
  else { li.style.display = ''; di.style.display = 'none'; }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const newTheme = state.settings.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  saveState();
});

// ─── TASKS ────────────────────────────────────────────
function createTask(data) {
  const task = {
    id: uid(), createdAt: new Date().toISOString(),
    title: data.title.trim(),
    desc: data.desc || '',
    due: data.due || '',
    priority: data.priority || 'medium',
    project: data.project || '',
    tags: (data.tags||'').split(',').map(t=>t.trim()).filter(Boolean),
    column: data.column || state.columns[0]?.id || '',
    done: false,
  };
  state.tasks.unshift(task);
  state.nextId++;
  saveState();
  renderDashboard();
  renderTaskList();
  renderBoard();
  renderCalendar();
  return task;
}

function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; saveState(); renderTaskList(); renderDashboard(); renderBoard(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState(); renderTaskList(); renderDashboard(); renderBoard();
  toast('Tâche supprimée', 'info');
}

function renderTaskList() {
  const container = document.getElementById('task-list-container');
  if (!container) return;
  const now = new Date(); now.setHours(0,0,0,0);

  let filtered = state.tasks.filter(t => {
    if (currentFilter === 'done')    return t.done;
    if (currentFilter === 'today')   return isToday(t.due);
    if (currentFilter === 'week')    return isThisWeek(t.due);
    if (currentFilter === 'overdue') return isOverdue(t.due) && !t.done;
    return !t.done; // all = non-done
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      <p>Aucune tâche pour ce filtre.</p></div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(t => {
    const k = t.project || 'Sans projet';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(t);
  });

  container.innerHTML = Object.entries(grouped).map(([proj, tasks]) => `
    <div class="task-group">
      <div class="task-group-title">${escHtml(proj)}</div>
      ${tasks.map(t => `
        <div class="task-item${t.done?' done':''}" data-id="${t.id}">
          <input type="checkbox" class="task-checkbox" ${t.done?'checked':''} 
            aria-label="Marquer '${escHtml(t.title)}' comme ${t.done?'non terminée':'terminée'}"
            onchange="toggleTask('${t.id}')">
          <div class="task-body">
            <div class="task-name">${escHtml(t.title)}</div>
            <div class="task-sub">
              ${t.due ? `<span class="${isOverdue(t.due)&&!t.done?'text-danger':''}" aria-label="Échéance">${fmtDate(t.due)}</span>` : ''}
              ${t.priority ? `<span>Priorité: ${t.priority==='high'?'🔴 Haute':t.priority==='medium'?'🟡 Moyenne':'🟢 Basse'}</span>` : ''}
              ${t.tags.length ? `<span>${t.tags.map(tg=>`<span class="tag tag-blue">${escHtml(tg)}</span>`).join('')}</span>` : ''}
            </div>
          </div>
          <div class="task-actions" role="group" aria-label="Actions pour ${escHtml(t.title)}">
            <button class="task-action-btn" onclick="openEditTaskModal('${t.id}')" aria-label="Modifier la tâche '${escHtml(t.title)}'">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="task-action-btn" onclick="deleteTask('${t.id}')" aria-label="Supprimer la tâche '${escHtml(t.title)}'">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    btn.setAttribute('aria-pressed', 'true');
    renderTaskList();
  });
});

// Task Modal
function openTaskModal(colId) {
  document.getElementById('task-modal-title').textContent = 'Nouvelle tâche';
  document.getElementById('save-task-btn').textContent = 'Créer la tâche';
  document.getElementById('task-title-input').value = '';
  document.getElementById('task-desc-input').value = '';
  document.getElementById('task-due-input').value = '';
  document.getElementById('task-priority-input').value = 'medium';
  document.getElementById('task-tags-input').value = '';
  const ps = document.getElementById('task-project-input');
  ps.innerHTML = '<option value="">Aucun projet</option>' +
    state.projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  const modal = document.getElementById('task-modal');
  modal.dataset.editId = '';
  modal.dataset.colId = colId || '';
  openModal('task-modal');
}

function openEditTaskModal(taskId) {
  const t = state.tasks.find(t => t.id === taskId);
  if (!t) return;
  document.getElementById('task-modal-title').textContent = 'Modifier la tâche';
  document.getElementById('save-task-btn').textContent = 'Enregistrer les modifications';
  document.getElementById('task-title-input').value    = t.title;
  document.getElementById('task-desc-input').value     = t.desc || '';
  document.getElementById('task-due-input').value      = t.due || '';
  document.getElementById('task-priority-input').value = t.priority || 'medium';
  document.getElementById('task-tags-input').value     = (t.tags || []).join(', ');
  const ps = document.getElementById('task-project-input');
  ps.innerHTML = '<option value="">Aucun projet</option>' +
    state.projects.map(p => `<option value="${p.id}"${p.id===t.project?' selected':''}>${escHtml(p.name)}</option>`).join('');
  const modal = document.getElementById('task-modal');
  modal.dataset.editId = taskId;
  modal.dataset.colId  = t.column || '';
  openModal('task-modal');
}

document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal());
document.getElementById('add-task-list-btn').addEventListener('click', () => openTaskModal());

document.getElementById('save-task-btn').addEventListener('click', () => {
  const title = document.getElementById('task-title-input').value.trim();
  if (!title) { toast('Le titre est obligatoire.', 'error'); return; }
  const modal  = document.getElementById('task-modal');
  const editId = modal.dataset.editId;

  if (editId) {
    // ─── MODE ÉDITION ───
    const t = state.tasks.find(t => t.id === editId);
    if (!t) return;
    t.title    = title;
    t.desc     = document.getElementById('task-desc-input').value;
    t.due      = document.getElementById('task-due-input').value;
    t.priority = document.getElementById('task-priority-input').value;
    t.project  = document.getElementById('task-project-input').value;
    t.tags     = document.getElementById('task-tags-input').value.split(',').map(s => s.trim()).filter(Boolean);
    saveState(); renderBoard(); renderTaskList(); renderDashboard(); renderCalendar();
    closeModal('task-modal');
    toast('Tâche modifiée !', 'success');
  } else {
    // ─── MODE CRÉATION ───
    const colId = modal.dataset.colId || (state.columns[0]?.id || '');
    createTask({
      title, colId,
      desc:     document.getElementById('task-desc-input').value,
      due:      document.getElementById('task-due-input').value,
      priority: document.getElementById('task-priority-input').value,
      project:  document.getElementById('task-project-input').value,
      tags:     document.getElementById('task-tags-input').value,
      column:   colId,
    });
    closeModal('task-modal');
    toast('Tâche créée !', 'success');
  }
});

// ─── NOTES ────────────────────────────────────────────
function createNote() {
  const note = {
    id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    title: 'Nouvelle note', body: '', tag: '',
  };
  state.notes.unshift(note);
  state.nextId++;
  saveState();
  return note;
}

function saveCurrentNote() {
  if (!activeNote) return;
  const note = state.notes.find(n => n.id === activeNote);
  if (!note) return;
  note.title = document.getElementById('note-title').value || 'Sans titre';
  note.body  = document.getElementById('note-body').value;
  note.tag   = document.getElementById('note-tag-input').value;
  note.updatedAt = new Date().toISOString();
  saveState();
  renderNotesList();
  toast('Note sauvegardée', 'success');
}

function loadNote(id) {
  activeNote = id;
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('note-title').value = note.title;
  document.getElementById('note-body').value   = note.body;
  document.getElementById('note-tag-input').value = note.tag || '';
  document.getElementById('note-meta-date').textContent = 'Modifié ' + fmtDate(note.updatedAt?.slice(0,10));
  updateWordCount();
  document.querySelectorAll('.note-list-item').forEach(li => li.classList.toggle('active', li.dataset.id === id));
}

function updateWordCount() {
  const body = document.getElementById('note-body')?.value || '';
  document.getElementById('note-meta-words').textContent = wordCount(body) + ' mots';
}

function renderNotesList() {
  const ul = document.getElementById('notes-list');
  if (!ul) return;
  if (!state.notes.length) {
    ul.innerHTML = `<li class="empty-state" style="padding:1rem"><p>Aucune note</p></li>`;
    return;
  }
  ul.innerHTML = state.notes.map(n => `
    <li>
      <button class="note-list-item${n.id===activeNote?' active':''}" data-id="${n.id}"
        role="option" aria-selected="${n.id===activeNote}">
        <div class="note-list-title">${escHtml(n.title||'Sans titre')}</div>
        <div class="note-list-date">${n.updatedAt?.slice(0,10)||''}</div>
      </button>
    </li>`).join('');
  ul.querySelectorAll('.note-list-item').forEach(btn => {
    btn.addEventListener('click', () => loadNote(btn.dataset.id));
  });
  if (!activeNote && state.notes.length) loadNote(state.notes[0].id);
}

document.getElementById('add-note-btn').addEventListener('click', () => {
  const note = createNote();
  renderNotesList();
  loadNote(note.id);
  toast('Nouvelle note créée', 'success');
});

document.getElementById('save-note-btn').addEventListener('click', saveCurrentNote);
document.getElementById('note-body').addEventListener('input', updateWordCount);
document.getElementById('note-title').addEventListener('input', () => {
  const note = state.notes.find(n => n.id === activeNote);
  if (note) note.title = document.getElementById('note-title').value;
  renderNotesList();
});

document.getElementById('delete-note-btn').addEventListener('click', () => {
  if (!activeNote) return;
  state.notes = state.notes.filter(n => n.id !== activeNote);
  activeNote = null;
  saveState(); renderNotesList();
  document.getElementById('note-title').value = '';
  document.getElementById('note-body').value = '';
  toast('Note supprimée', 'info');
});

// Ctrl+S to save note
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveCurrentNote(); }
});

// ─── KANBAN BOARD ─────────────────────────────────────
function renderBoard() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = '';

  state.columns.forEach(col => {
    const tasks = state.tasks.filter(t => t.column === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.innerHTML = `
      <div class="col-header">
        <div class="col-title-wrap">
          <span class="col-dot" style="background:${col.color}" aria-hidden="true"></span>
          <span class="col-title">${escHtml(col.title)}</span>
        </div>
        <span class="col-count" aria-label="${tasks.length} tâches">${tasks.length}</span>
      </div>
      <div class="kanban-cards" id="cards-${col.id}" 
        data-col="${col.id}" 
        aria-label="Colonne ${escHtml(col.title)}, ${tasks.length} tâches"
        role="list">
        ${tasks.map(t => renderCard(t)).join('')}
      </div>
      <button class="add-card-btn" data-col="${col.id}" aria-label="Ajouter une tâche dans ${escHtml(col.title)}">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Ajouter
      </button>`;
    board.appendChild(colEl);
    setupDrop(colEl.querySelector('.kanban-cards'));
  });

  // Add column button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-col-btn';
  addBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une colonne`;
  addBtn.setAttribute('aria-haspopup', 'dialog');
  addBtn.addEventListener('click', () => openModal('col-modal'));
  board.appendChild(addBtn);

  // Add card listeners
  board.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.col));
  });

  // Drag on cards
  board.querySelectorAll('.kanban-card').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      dragCard = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragCard = null;
    });
  });
}

function renderCard(t) {
  const priorityColors = { high: '#c1392b', medium: '#e67e22', low: '#2d6a4f' };
  const col = state.columns.find(c => c.id === t.column);
  return `
    <article class="kanban-card" data-id="${t.id}" role="listitem"
      aria-label="Tâche : ${escHtml(t.title)}${t.done?' (terminée)':''}">
      ${t.tags.length ? `<div class="card-tags" aria-label="Étiquettes">${t.tags.map(tg=>`<span class="tag tag-blue">${escHtml(tg)}</span>`).join('')}</div>` : ''}
      <div class="card-title">${escHtml(t.title)}</div>
      ${t.desc ? `<div class="card-desc">${escHtml(t.desc.slice(0,80))}${t.desc.length>80?'…':''}</div>` : ''}
      <div class="card-footer">
        ${t.due ? `<span class="card-due${isOverdue(t.due)&&!t.done?' overdue':''}" aria-label="Échéance : ${fmtDate(t.due)}">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${fmtDate(t.due)}</span>` : '<span></span>'}
        <div class="card-meta">
          <span class="priority-dot" style="background:${priorityColors[t.priority]||'#ccc'}" 
            aria-label="Priorité ${t.priority}"></span>
          <button class="task-action-btn" onclick="openEditTaskModal('${t.id}')" aria-label="Modifier la tâche '${escHtml(t.title)}'">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-action-btn" onclick="deleteTask('${t.id}')" aria-label="Supprimer la tâche '${escHtml(t.title)}'">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function setupDrop(zone) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (!dragCard) return;
    const task = state.tasks.find(t => t.id === dragCard);
    if (task) {
      task.column = zone.dataset.col;
      saveState(); renderBoard(); renderDashboard();
    }
  });
}

// Column Modal
document.getElementById('add-col-modal-btn').addEventListener('click', () => openModal('col-modal'));
document.getElementById('save-col-btn').addEventListener('click', () => {
  const title = document.getElementById('col-title-input').value.trim();
  if (!title) { toast('Nom requis', 'error'); return; }
  state.columns.push({ id: uid(), title, color: document.getElementById('col-color-input').value });
  saveState(); renderBoard();
  closeModal('col-modal');
  toast('Colonne créée !', 'success');
});

// ─── CALENDAR ─────────────────────────────────────────
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  if (!label) return;
  label.textContent = MONTHS_FR[calDate.getMonth()] + ' ' + calDate.getFullYear();

  const cells = document.getElementById('cal-cells');
  cells.innerHTML = '';

  const year = calDate.getFullYear(), month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const today    = new Date(); today.setHours(0,0,0,0);

  // Start from Monday
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;

  for (let i = 0; i < startDow; i++) {
    const prev = new Date(year, month, -startDow + i + 1);
    cells.appendChild(buildCell(prev, true, today));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.appendChild(buildCell(new Date(year, month, d), false, today));
  }
  const remaining = 42 - startDow - lastDay.getDate();
  for (let d = 1; d <= remaining; d++) {
    cells.appendChild(buildCell(new Date(year, month + 1, d), true, today));
  }
}

function buildCell(date, otherMonth, today) {
  const cell = document.createElement('div');
  cell.className = 'cal-cell' + (otherMonth?' other-month':'');
  const iso = date.toISOString().slice(0,10);
  if (date.getTime() === today.getTime()) cell.classList.add('today');

  const tasksDue = state.tasks.filter(t => t.due === iso && !t.done);
  const googleEvts = state.google.events.filter(e => e.date === iso);

  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label', date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }));

  cell.innerHTML = `
    <div class="cal-num">${date.getDate()}</div>
    <div class="cal-events">
      ${tasksDue.slice(0,2).map(t => `<div class="cal-event task" title="${escHtml(t.title)}" tabindex="0" role="button" aria-label="Tâche : ${escHtml(t.title)}">${escHtml(t.title)}</div>`).join('')}
      ${googleEvts.slice(0,2).map(e => `<div class="cal-event google" title="${escHtml(e.title)}" tabindex="0" role="button" aria-label="Événement Google : ${escHtml(e.title)}">${escHtml(e.title)}</div>`).join('')}
    </div>`;
  return cell;
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});
document.getElementById('cal-today-btn').addEventListener('click', () => {
  calDate = new Date();
  renderCalendar();
});

// ─── GOOGLE CALENDAR INTEGRATION ─────────────────────
let gisInited = false;
let gapiInited = false;
let tokenClient;

function initGoogleAPI() {
  const { clientId, apiKey, calendarId } = state.google;
  if (!clientId || !apiKey) {
    toast('Configurez d\'abord votre Client ID et Clé API Google.', 'error');
    return;
  }
  // Load GAPI script dynamically
  if (!document.getElementById('gapi-script')) {
    const s = document.createElement('script');
    s.id = 'gapi-script';
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => {
      gapi.load('client', async () => {
        await gapi.client.init({ apiKey, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'] });
        gapiInited = true;
        maybeEnableButtons();
      });
    };
    document.head.appendChild(s);
  }
  if (!document.getElementById('gis-script')) {
    const s2 = document.createElement('script');
    s2.id = 'gis-script';
    s2.src = 'https://accounts.google.com/gsi/client';
    s2.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: handleTokenResponse,
      });
      gisInited = true;
      maybeEnableButtons();
    };
    document.head.appendChild(s2);
  }
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById('google-connect-btn').disabled = false;
  }
}

function handleTokenResponse(resp) {
  if (resp.error) { toast('Erreur Google: ' + resp.error, 'error'); return; }
  fetchGoogleEvents();
}

async function fetchGoogleEvents() {
  try {
    const { calendarId } = state.google;
    const now = new Date();
    const tmin = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();
    const tmax = new Date(now.getFullYear(), now.getMonth()+3, 0).toISOString();
    const response = await gapi.client.calendar.events.list({
      calendarId: calendarId || 'primary',
      timeMin: tmin, timeMax: tmax,
      showDeleted: false, singleEvents: true,
      maxResults: 100, orderBy: 'startTime',
    });
    const items = response.result.items || [];
    state.google.events = items.map(e => ({
      id: e.id,
      title: e.summary || '(sans titre)',
      date: (e.start.date || e.start.dateTime || '').slice(0,10),
      time: e.start.dateTime ? e.start.dateTime.slice(11,16) : '',
    }));
    state.google.connected = true;
    saveState();
    renderCalendar();
    updateGoogleUI(true);
    toast('Google Agenda synchronisé ! (' + items.length + ' événements)', 'success');
  } catch(e) {
    toast('Erreur de synchronisation Google: ' + e.message, 'error');
  }
}

function updateGoogleUI(connected) {
  document.getElementById('google-auth-status').textContent = connected ? '✅ Connecté à Google Agenda.' : 'Non connecté à Google.';
  document.getElementById('google-disconnect-btn').style.display = connected ? '' : 'none';
  const bar = document.getElementById('google-sync-bar');
  if (bar) bar.style.display = connected ? '' : 'none';
}

document.getElementById('google-connect-btn').addEventListener('click', () => {
  state.google.clientId = document.getElementById('google-client-id').value.trim();
  state.google.apiKey   = document.getElementById('google-api-key').value.trim();
  state.google.calendarId = document.getElementById('google-calendar-id').value.trim() || 'primary';
  if (!state.google.clientId || !state.google.apiKey) {
    toast('Client ID et Clé API requis.', 'error'); return;
  }
  saveState();
  initGoogleAPI();
  setTimeout(() => {
    if (gisInited && tokenClient) tokenClient.requestAccessToken();
    else toast('Chargement de l\'API Google en cours… réessayez.', 'info');
  }, 1500);
});

document.getElementById('google-disconnect-btn').addEventListener('click', () => {
  state.google.connected = false;
  state.google.events = [];
  saveState(); updateGoogleUI(false); renderCalendar();
  toast('Google Agenda déconnecté', 'info');
});

if (document.getElementById('refresh-google-btn')) {
  document.getElementById('refresh-google-btn').addEventListener('click', fetchGoogleEvents);
}

// ─── DASHBOARD ────────────────────────────────────────
function renderDashboard() {
  const activeTasks = state.tasks.filter(t => !t.done).length;
  const doneTasks   = state.tasks.filter(t => t.done).length;
  const dueSoon     = state.tasks.filter(t => !t.done && isThisWeek(t.due)).length;
  const overdue     = state.tasks.filter(t => !t.done && isOverdue(t.due)).length;
  const today       = new Date().toISOString().slice(0,10);
  const notesToday  = state.notes.filter(n => n.updatedAt?.slice(0,10) === today).length;

  document.getElementById('stat-tasks').textContent = activeTasks;
  document.getElementById('stat-tasks-done').textContent = doneTasks + ' terminées';
  document.getElementById('stat-notes').textContent = state.notes.length;
  document.getElementById('stat-notes-today').textContent = notesToday + ' aujourd\'hui';
  document.getElementById('stat-due').textContent = dueSoon;
  document.getElementById('stat-overdue').textContent = overdue + ' en retard';
  document.getElementById('stat-projects').textContent = state.projects.length;

  // Recent tasks
  const rt = document.getElementById('dash-recent-tasks');
  const recent = state.tasks.filter(t=>!t.done).slice(0,5);
  if (!recent.length) {
    rt.innerHTML = `<div class="empty-state"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><p>Aucune tâche active.</p></div>`;
  } else {
    rt.innerHTML = recent.map(t => `
      <div class="task-item" style="margin-bottom:.4rem">
        <input type="checkbox" class="task-checkbox" ${t.done?'checked':''} 
          aria-label="Marquer '${escHtml(t.title)}' comme terminée"
          onchange="toggleTask('${t.id}')">
        <div class="task-body">
          <div class="task-name">${escHtml(t.title)}</div>
          ${t.due?`<div class="task-sub"><span>${fmtDate(t.due)}</span></div>`:''}
        </div>
      </div>`).join('');
  }

  // Recent notes
  const rn = document.getElementById('dash-recent-notes');
  const recentNotes = state.notes.slice(0,4);
  if (!recentNotes.length) {
    rn.innerHTML = `<div class="empty-state"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg><p>Aucune note.</p></div>`;
  } else {
    rn.innerHTML = recentNotes.map(n => `
      <div style="padding:.5rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:.85rem;font-weight:600">${escHtml(n.title||'Sans titre')}</div>
        <div style="font-size:.75rem;color:var(--text3)">${n.updatedAt?.slice(0,10)||''}</div>
      </div>`).join('');
  }
}

// ─── PROJECTS ─────────────────────────────────────────
function renderProjectsNav() {
  const nav = document.getElementById('projects-nav');
  if (!nav) return;
  nav.innerHTML = state.projects.map(p => `
    <li>
      <button class="nav-item" style="font-size:.82rem">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0" aria-hidden="true"></span>
        ${escHtml(p.name)}
      </button>
    </li>`).join('');
}

function renderProjectsSettings() {
  const el = document.getElementById('projects-list-settings');
  if (!el) return;
  el.innerHTML = state.projects.length
    ? state.projects.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .7rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:.3rem">
          <span style="font-size:.85rem;font-weight:500">${escHtml(p.name)}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')" aria-label="Supprimer le projet ${escHtml(p.name)}">Supprimer</button>
        </div>`).join('')
    : '<p style="font-size:.82rem;color:var(--text3)">Aucun projet.</p>';
}

function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id);
  saveState(); renderProjectsNav(); renderProjectsSettings();
  toast('Projet supprimé', 'info');
}

document.getElementById('add-project-btn').addEventListener('click', () => {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) { toast('Nom requis', 'error'); return; }
  state.projects.push({ id: uid(), name });
  document.getElementById('new-project-name').value = '';
  saveState(); renderProjectsNav(); renderProjectsSettings();
  toast('Projet créé !', 'success');
});

// ─── SETTINGS PAGE ────────────────────────────────────
function renderSettingsPage() {
  // Populate profile fields
  document.getElementById('profile-name').value  = state.profile.name || '';
  document.getElementById('profile-email').value = state.profile.email || '';
  document.getElementById('profile-role').value  = state.profile.role || '';
  document.getElementById('google-client-id').value  = state.google.clientId || '';
  document.getElementById('google-api-key').value    = state.google.apiKey || '';
  document.getElementById('google-calendar-id').value= state.google.calendarId || 'primary';
  updateGoogleUI(state.google.connected);
  renderProjectsSettings();

  const fsr = document.getElementById('font-size-range');
  fsr.value = state.settings.fontSize || 15;
  document.getElementById('font-size-label').textContent = fsr.value + 'px';
  document.getElementById('accent-color-picker').value = state.settings.accent || '#2d6a4f';
}

document.querySelectorAll('[data-settings]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-settings]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('settings-' + btn.dataset.settings)?.classList.add('active');
  });
});

document.getElementById('save-profile-btn').addEventListener('click', () => {
  state.profile.name  = document.getElementById('profile-name').value.trim();
  state.profile.email = document.getElementById('profile-email').value.trim();
  state.profile.role  = document.getElementById('profile-role').value.trim();
  saveState(); updateUserUI();
  toast('Profil sauvegardé !', 'success');
});

document.getElementById('theme-light-btn').addEventListener('click', () => { applyTheme('light'); saveState(); });
document.getElementById('theme-dark-btn').addEventListener('click', () => { applyTheme('dark'); saveState(); });

document.getElementById('accent-color-picker').addEventListener('input', e => {
  document.documentElement.style.setProperty('--accent', e.target.value);
  state.settings.accent = e.target.value;
  saveState();
});

document.getElementById('font-size-range').addEventListener('input', e => {
  document.documentElement.style.fontSize = e.target.value + 'px';
  document.getElementById('font-size-label').textContent = e.target.value + 'px';
  state.settings.fontSize = parseInt(e.target.value);
  saveState();
});

// ─── USER UI ──────────────────────────────────────────
function updateUserUI() {
  const name = state.profile.name || 'Utilisateur';
  const role = state.profile.role || 'TaskFlow';
  const initials = name.split(' ').map(w=>w[0]?.toUpperCase()||'').join('').slice(0,2) || '?';
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-role').textContent = role;
  document.getElementById('user-avatar-initials').textContent = initials;
}

// ─── MOBILE MENU ──────────────────────────────────────
document.getElementById('menu-toggle').addEventListener('click', function() {
  const sidebar = document.getElementById('sidebar');
  const open = sidebar.classList.toggle('open');
  this.setAttribute('aria-expanded', open);
});

document.getElementById('sidebar-backdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
});

// ─── EXPORT / IMPORT ──────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'taskflow-export.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Export téléchargé', 'success');
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      state = { ...defaultState(), ...imported };
      saveState(); initUI();
      toast('Données importées avec succès !', 'success');
    } catch {
      toast('Fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('clear-data-btn').addEventListener('click', () => {
  if (!confirm('Effacer TOUTES les données locales ? Cette action est irréversible.')) return;
  state = defaultState(); saveState(); initUI();
  toast('Données effacées', 'info');
});

// ─── GLOBAL SEARCH ────────────────────────────────────
document.getElementById('global-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) return;
  const taskMatch = state.tasks.find(t => t.title.toLowerCase().includes(q));
  const noteMatch = state.notes.find(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  if (taskMatch) { navigate('tasks'); }
  else if (noteMatch) { navigate('notes'); loadNote(noteMatch.id); }
});

// ─── ESCAPE HTML ──────────────────────────────────────
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ─── INIT ─────────────────────────────────────────────
async function initUI() {
  applyTheme(state.settings.theme || 'light');
  if (state.settings.accent) document.documentElement.style.setProperty('--accent', state.settings.accent);
  if (state.settings.fontSize) document.documentElement.style.fontSize = state.settings.fontSize + 'px';
  updateUserUI();
  renderProjectsNav();
  renderDashboard();
  if (state.google.connected) updateGoogleUI(true);
}

async function init() {
  loadState();
  await loadFromServer();
  initUI();
  navigate('dashboard');
}

init();