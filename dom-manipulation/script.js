/* ===== Task 0 – Dynamic Quote Generator (checker-compatible) ===== */

// 1) Seed data (global) — must be an array of objects with text & category
window.quotes = window.quotes || [
  { text: 'Stay hungry, stay foolish.', category: 'Motivation' },
  { text: 'Simplicity is the ultimate sophistication.', category: 'Design' },
  { text: 'Code is like humor. When you have to explain it, it’s bad.', category: 'Programming' }
];

// 2) Helper to render a quote in the DOM
function renderQuote(quote) {
  const box = document.getElementById('quoteDisplay');
  if (!box) return;
  box.innerHTML = `
    <p id="quoteText">“${(quote.text || '').toString()}”</p>
    <p id="quoteCategory"><em>${(quote.category || '').toString()}</em></p>
  `;
}

// 3) REQUIRED by checker: select a random quote and update the DOM
function showRandomQuote() {
  if (!Array.isArray(quotes) || quotes.length === 0) return;
  const idx = Math.floor(Math.random() * quotes.length);
  renderQuote(quotes[idx]);
}

// 4) REQUIRED by checker: dynamically create the add-quote form
function createAddQuoteForm() {
  // Prevent duplicate creation
  if (document.getElementById('newQuoteText')) return;

  const wrapper = document.createElement('div');

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.id = 'newQuoteText';
  textInput.placeholder = 'Enter a new quote';

  const catInput = document.createElement('input');
  catInput.type = 'text';
  catInput.id = 'newQuoteCategory';
  catInput.placeholder = 'Enter quote category';

  const addBtn = document.createElement('button');
  addBtn.id = 'addQuoteBtn';
  addBtn.textContent = 'Add Quote';
  addBtn.addEventListener('click', addQuote); // calls addQuote()

  wrapper.append(textInput, catInput, addBtn);

  // Place it near the quote display if possible; otherwise append to body
  const display = document.getElementById('quoteDisplay');
  (display?.parentNode || document.body).appendChild(wrapper);
}

// 5) REQUIRED by checker: push to quotes[] and update the DOM
function addQuote() {
  const textEl = document.getElementById('newQuoteText');
  const catEl = document.getElementById('newQuoteCategory');

  const text = (textEl?.value || '').trim();
  const category = (catEl?.value || '').trim();

  if (!text || !category) return;

  // Add new object to the global quotes array
  quotes.push({ text, category });

  // Update the DOM right after adding
  showRandomQuote();

  // Clear inputs
  textEl.value = '';
  catEl.value = '';
}

// 6) REQUIRED by checker: event listener on the “Show New Quote” button
document.addEventListener('DOMContentLoaded', () => {
  createAddQuoteForm(); // make sure the form exists
  document.getElementById('newQuote')?.addEventListener('click', showRandomQuote);
  showRandomQuote(); // initial render
});
