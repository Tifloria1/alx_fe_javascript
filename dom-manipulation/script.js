/* ==========
   App state / keys
   ========== */
const STORAGE_KEY_QUOTES = 'quotes_v2';
const STORAGE_KEY_LAST_SELECTED_CATEGORY = 'quotes_last_category';
const SESSION_KEY_LAST_VIEWED = 'quotes_last_viewed'; // uses sessionStorage

// In-memory state
let quotes = [];
let filterCategory = 'all';
let searchTerm = '';
let autoSyncTimer = null;

/* ==========
   DOM refs
   ========== */
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const clearLastViewedBtn = document.getElementById('clearLastViewed');

const addForm = document.getElementById('addQuoteForm');
const inputText = document.getElementById('newQuoteText');
const inputAuthor = document.getElementById('newQuoteAuthor');
const inputCategory = document.getElementById('newQuoteCategory');

const listEl = document.getElementById('quotesList');
const emptyEl = document.getElementById('emptyState');
const countEl = document.getElementById('count');

const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');

const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');

const syncInfo = document.getElementById('syncInfo');
const syncNowBtn = document.getElementById('syncNow');
const autoSyncCheckbox = document.getElementById('autoSync');

/* ==========
   Utilities
   ========== */
const uid = () => String(Date.now()) + Math.random().toString(16).slice(2);

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function saveQuotes() {
  localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(quotes));
}

function loadQuotes() {
  try {
    quotes = JSON.parse(localStorage.getItem(STORAGE_KEY_QUOTES)) || [];
  } catch {
    quotes = [];
  }
}

function saveLastCategory() {
  localStorage.setItem(STORAGE_KEY_LAST_SELECTED_CATEGORY, filterCategory);
}
function loadLastCategory() {
  filterCategory = localStorage.getItem(STORAGE_KEY_LAST_SELECTED_CATEGORY) || 'all';
}

function saveLastViewed(quote) {
  sessionStorage.setItem(SESSION_KEY_LAST_VIEWED, JSON.stringify(quote));
}
function loadLastViewed() {
  const raw = sessionStorage.getItem(SESSION_KEY_LAST_VIEWED);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ==========
   DOM renderers
   ========== */
function renderQuote(quote) {
  quoteDisplay.querySelector('.quote__text').textContent = `“${quote.text}”`;
  quoteDisplay.querySelector('.quote__author').textContent = quote.author;
  quoteDisplay.querySelector('.quote__category').textContent = `(${quote.category})`;
}

function populateCategories() {
  const set = new Set(quotes.map(q => q.category.trim()).filter(Boolean));
  const selected = filterCategory;

  // Build options
  categoryFilter.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'All Categories';
  categoryFilter.appendChild(optAll);

  Array.from(set).sort((a,b)=>a.localeCompare(b)).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // Restore selection
  if ([...categoryFilter.options].some(o => o.value === selected)) {
    categoryFilter.value = selected;
  } else {
    categoryFilter.value = 'all';
    filterCategory = 'all';
    saveLastCategory();
  }
}

function filteredQuotes() {
  let items = quotes;
  if (filterCategory !== 'all') {
    items = items.filter(q => q.category.toLowerCase() === filterCategory.toLowerCase());
  }
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    items = items.filter(it =>
      it.text.toLowerCase().includes(q) ||
      it.author.toLowerCase().includes(q)
    );
  }
  return items;
}

function renderList() {
  const items = filteredQuotes();
  listEl.innerHTML = '';

  if (items.length === 0) {
    emptyEl.hidden = false;
    countEl.textContent = '';
    return;
  }

  emptyEl.hidden = true;
  countEl.textContent = `${items.length} item${items.length>1?'s':''}`;

  for (const q of items) {
    const li = document.createElement('li');
    li.className = 'quote-item';
    li.dataset.id = q.id;
    li.innerHTML = `
      <div class="quote-item__top">
        <strong>“${escapeHtml(q.text)}”</strong>
        <button class="quote-item__remove" aria-label="Remove quote">Remove</button>
      </div>
      <div class="muted">— ${escapeHtml(q.author)} <em>(${escapeHtml(q.category)})</em></div>
    `;
    listEl.appendChild(li);
  }
}

/* ==========
   Actions
   ========== */
function showRandomQuote() {
  const items = filteredQuotes();
  if (items.length === 0) return;
  const random = items[Math.floor(Math.random() * items.length)];
  renderQuote(random);
  saveLastViewed(random); // sessionStorage demo
}

function addQuote(text, author, category) {
  const q = {
    id: uid(),
    text: text.trim(),
    author: author.trim(),
    category: category.trim(),
    updatedAt: Date.now()
  };
  quotes.unshift(q);
  saveQuotes();
  populateCategories();
  renderList();
  return q;
}

function removeQuote(id) {
  quotes = quotes.filter(q => q.id !== id);
  saveQuotes();
  populateCategories();
  renderList();
}

/* ==========
   Import / Export
   ========== */
function exportJson() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quotes_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('File must contain an array of quotes');

      // Basic validation/normalization
      const clean = imported.map(it => ({
        id: it.id || uid(),
        text: String(it.text || '').trim(),
        author: String(it.author || 'Unknown').trim(),
        category: String(it.category || 'General').trim(),
        updatedAt: Number(it.updatedAt || Date.now())
      })).filter(it => it.text);

      // Merge: prefer the most recently updated (simple conflict rule)
      const map = new Map(quotes.map(q => [q.id, q]));
      clean.forEach(incoming => {
        const existing = map.get(incoming.id);
        if (!existing || incoming.updatedAt > existing.updatedAt) {
          map.set(incoming.id, incoming);
        }
      });
      quotes = Array.from(map.values()).sort((a,b)=>b.updatedAt-a.updatedAt);

      saveQuotes();
      populateCategories();
      renderList();
      alert('Quotes imported successfully!');
    } catch (err) {
      alert('Invalid JSON file.');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

/* ==========
   Sync with “server” (mock)
   ========== */
/**
 * For demo: fetch some posts from JSONPlaceholder and map to quotes.
 * title -> text, body -> category chunk, userId -> author-ish
 * Conflict rule: prefer "server" if updatedAt missing or older.
 */
async function fetchServerQuotes() {
  // Note: CORS should be allowed for jsonplaceholder; if blocked in your environment,
  // replace with your own mock endpoint or a local JSON file served via dev server.
  const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=4');
  const posts = await res.json();
  return posts.map(p => ({
    id: `server-${p.id}`,
    text: p.title,
    author: `User #${p.userId}`,
    category: (p.body.split(' ')[0] || 'Server').replace(/\W/g,'') || 'Server',
    updatedAt: Date.now() + p.id // deterministic-ish
  }));
}

async function syncWithServer() {
  syncInfo.textContent = 'Syncing with server…';
  try {
    const serverQuotes = await fetchServerQuotes();

    // Merge with conflict resolution: prefer server on conflict
    const map = new Map(quotes.map(q => [q.id, q]));
    for (const sq of serverQuotes) {
      const existing = map.get(sq.id);
      if (!existing || sq.updatedAt >= (existing.updatedAt || 0)) {
        map.set(sq.id, sq);
      }
    }
    const before = quotes.length;
    quotes = Array.from(map.values()).sort((a,b)=>b.updatedAt-a.updatedAt);
    saveQuotes();

    populateCategories();
    renderList();
    syncInfo.textContent = `Sync complete. ${quotes.length - before >= 0 ? '+' : ''}${quotes.length - before} change(s).`;
  } catch (err) {
    console.error(err);
    syncInfo.textContent = 'Sync failed (see console).';
  }
}

/* ==========
   Event wiring
   ========== */
// show random
newQuoteBtn.addEventListener('click', showRandomQuote);

// clear last viewed (sessionStorage)
clearLastViewedBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY_LAST_VIEWED);
  alert('Last viewed quote cleared from session.');
});

// add quote
addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputText.value.trim();
  const author = inputAuthor.value.trim();
  const category = inputCategory.value.trim();
  if (!text || !author || !category) return;
  addQuote(text, author, category);
  addForm.reset();
  inputText.focus();
});

// list remove (event delegation)
listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.quote-item__remove');
  if (!btn) return;
  const li = btn.closest('.quote-item');
  if (!li) return;
  removeQuote(li.dataset.id);
});

// filter
categoryFilter.addEventListener('change', () => {
  filterCategory = categoryFilter.value;
  saveLastCategory();
  renderList();
});

// search
searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value;
  renderList();
});

// export
exportBtn.addEventListener('click', exportJson);

// import
importFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) importFromFile(file);
  importFile.value = ''; // reset
});

// manual sync
syncNowBtn.addEventListener('click', syncWithServer);

// auto sync toggle
autoSyncCheckbox.addEventListener('change', () => {
  if (autoSyncCheckbox.checked) {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(syncWithServer, 30_000);
    syncInfo.textContent = 'Auto sync enabled (every 30s).';
  } else {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    syncInfo.textContent = 'Auto sync disabled.';
  }
});

/* ==========
   Boot
   ========== */
function seedIfEmpty() {
  if (quotes.length) return;
  quotes = [
    { id: uid(), text: 'The best way out is always through.', author: 'Robert Frost', category: 'Motivation', updatedAt: Date.now()-30000 },
    { id: uid(), text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman', category: 'Productivity', updatedAt: Date.now()-20000 },
    { id: uid(), text: 'What we think, we become.', author: 'Buddha', category: 'Mindset', updatedAt: Date.now()-10000 },
  ];
  saveQuotes();
}

(function init(){
  loadQuotes();
  seedIfEmpty();
  loadLastCategory();

  populateCategories();
  renderList();

  // Restore last viewed (session) if exists
  const last = loadLastViewed();
  if (last) renderQuote(last);
  else showRandomQuote(); // show something on first load

  // Restore filter UI
  categoryFilter.value = filterCategory;
})();
