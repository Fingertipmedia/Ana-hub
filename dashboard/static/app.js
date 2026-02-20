const API_BASE = '/api';
let currentBoardSlug = null;

// ---------- Navigation ----------
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const pageId = link.getAttribute('data-page');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    link.classList.add('active');
    loadPage(pageId);
  });
});

async function loadPage(page) {
  if (page.startsWith('kanban-')) {
    const slug = page.replace('kanban-', '');
    loadKanbanBoard(slug);
  } else if (page === 'dashboard') {
    loadDashboard();
  } else if (page === 'settings') {
    loadSettings();
  } else if (page === 'chat') {
    loadChat();
  }
  // others are stubs
}

// ---------- Dashboard ----------
async function loadDashboard() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    document.getElementById('healthStatus').textContent = health.status;
    document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();
    const tokens = await fetch(`${API_BASE}/tokens`).then(r => r.json());
    const total = tokens.models.reduce((sum, m) => sum + m.tokens, 0);
    document.getElementById('tokenUsage').textContent = total.toLocaleString();
    document.getElementById('syncLog').textContent = 'Sync active. Polling every 5 minutes.';
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ---------- Kanban ----------
async function loadKanbanBoard(slug) {
  try {
    const data = await fetch(`${API_BASE}/kanban/board/${slug}`).then(r => r.json());
    if (!data.board) return;
    currentBoardSlug = slug;
    renderKanban(data);
  } catch (err) {
    console.error('Kanban load error:', err);
  }
}

function renderKanban(data) {
  const boardEl = document.getElementById(`board-${data.board.slug}`);
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const columns = ['ideas', 'todo', 'inprogress', 'completed'];
  columns.forEach(col => {
    const colDiv = document.createElement('div');
    colDiv.className = 'column';
    colDiv.dataset.column = col;
    colDiv.innerHTML = `<div class="column-header">${col.toUpperCase()}</div>`;
    const cards = data.cards.filter(c => c.column === col);
    cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.dataset.id = card.id;
      cardDiv.draggable = true;
      cardDiv.innerHTML = `
        <div class="card-title">${card.title}</div>
        <div class="card-meta">
          <span>${card.agent || '—'}</span>
          <span>${card.tokens} tokens</span>
        </div>
        <div class="card-desc">${card.description.substring(0, 80)}…</div>
      `;
      colDiv.appendChild(cardDiv);
    });
    colDiv.addEventListener('dragover', e => e.preventDefault());
    colDiv.addEventListener('drop', onDrop);
    boardEl.appendChild(colDiv);
  });
}

async function onDrop(e) {
  e.preventDefault();
  const cardEl = e.dataTransfer.getData('text/plain');
  if (!cardEl) return;
  const cardId = parseInt(cardEl);
  const newColumn = e.target.closest('.column').dataset.column;
  await fetch(`${API_BASE}/kanban/card/${cardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column: newColumn })
  });
  loadKanbanBoard(currentBoardSlug);
}

// Enable card dragging
document.addEventListener('dragstart', (e) => {
  if (e.target.classList.contains('card')) {
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
  }
});

// ---------- Settings ----------
async function loadSettings() {
  const models = await fetch(`${API_BASE}/settings/models`).then(r => r.json());
  document.getElementById('defaultModel').innerHTML = models.available.map(m =>
    `<option value="${m}" ${m === models.default ? 'selected' : ''}>${m}</option>`
  ).join('');
  const fallbackList = document.getElementById('fallbackChainList');
  fallbackList.innerHTML = models.fallbackChain.map(f => `<span class="tag">${f}</span>`).join('');
  // TODO: implement adding/removing fallbacks
}

// ---------- Chat ----------
async function loadChat() {
  const models = await fetch(`${API_BASE}/settings/models`).then(r => r.json());
  const modelSelect = document.getElementById('chatModel');
  modelSelect.innerHTML = models.available.map(m => `<option value="${m}">${m}</option>`).join('');
  modelSelect.value = models.default;

  // Load sessions (stub)
  document.getElementById('chatSessions').innerHTML = '<p>Chat sessions will appear here.</p>';
}

// ---------- Initial load ----------
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});