const STORAGE_KEY = "libros-inventario-v1";
const ADMIN_PASSWORD = "1234";

const state = {
  books: []
};

let pendingAction = null;
let editingId = "";
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function money(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function number(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `book-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.books)) state.books = saved.books;
  } catch {
    state.books = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function bookValue(book) {
  return (Number(book.price) || 0) * (Number(book.stock) || 0);
}

function clientName(book) {
  return String(book.client || "").trim();
}

function totals() {
  return state.books.reduce((acc, book) => {
    acc.titles += 1;
    acc.stock += Number(book.stock) || 0;
    acc.value += bookValue(book);
    acc.pages += (Number(book.pages) || 0) * (Number(book.stock) || 0);
    return acc;
  }, { titles: 0, stock: 0, value: 0, pages: 0 });
}

function setTab(name) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}View`));
  $$(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
}

function renderQuickSummary() {
  const data = totals();
  $("#quickTitles").textContent = number(data.titles);
  $("#quickStock").textContent = number(data.stock);
  $("#quickValue").textContent = money(data.value);
}

function filteredBooks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  if (!query) return state.books;
  return state.books.filter((book) => {
    return book.name.toLowerCase().includes(query)
      || book.author.toLowerCase().includes(query)
      || clientName(book).toLowerCase().includes(query);
  });
}

function renderBookItems(books) {
  if (!books.length) {
    return `<div class="empty">No hay libros para mostrar.</div>`;
  }

  return books.map((book) => {
    const client = clientName(book);
    return `
    <article class="book-item">
      <div class="book-top">
        <div class="book-title">
          <strong>${escapeHtml(book.name)}</strong>
          <span class="book-sub">${escapeHtml(book.author)}</span>
          ${client ? `<span class="client-pill">Cliente: ${escapeHtml(client)}</span>` : `<span class="client-pill neutral">Sin cliente</span>`}
        </div>
      </div>
      <div class="book-details">
        <div class="metric">
          <span class="meta">Paginas</span>
          <strong>${number(book.pages)}</strong>
        </div>
        <div class="metric">
          <span class="meta">Precio venta</span>
          <strong>${money(book.price)}</strong>
        </div>
        <div class="metric">
          <span class="meta">Stock</span>
          <strong>${number(book.stock)}</strong>
        </div>
        <div class="metric">
          <span class="meta">Valor</span>
          <strong>${money(bookValue(book))}</strong>
        </div>
      </div>
      <div class="book-actions">
        <button class="ghost" type="button" data-action="edit" data-id="${book.id}">Modificar</button>
        <button class="danger" type="button" data-action="delete" data-id="${book.id}">Eliminar</button>
      </div>
    </article>
  `;
  }).join("");
}

function renderInventory() {
  const books = filteredBooks().slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  const list = $("#bookList");

  if (!books.length) {
    list.innerHTML = `<div class="empty">No hay libros para mostrar.</div>`;
    return;
  }

  const availableBooks = books.filter((book) => !clientName(book));
  const assignedBooks = books.filter((book) => clientName(book));
  list.innerHTML = `
    <section class="inventory-group">
      <div class="group-head">
        <h3>Sin cliente asignado</h3>
        <span>${number(availableBooks.length)} libro(s)</span>
      </div>
      ${renderBookItems(availableBooks)}
    </section>
    <section class="inventory-group">
      <div class="group-head">
        <h3>Asignados a clientes</h3>
        <span>${number(assignedBooks.length)} libro(s)</span>
      </div>
      ${renderBookItems(assignedBooks)}
    </section>
  `;
}

function renderClientOptions() {
  const clients = Array.from(new Set(state.books.map(clientName).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es"));
  $("#clientOptions").innerHTML = clients.map((client) => `<option value="${escapeHtml(client)}"></option>`).join("");
}

function renderSummary() {
  const data = totals();
  const mostExpensive = state.books.reduce((winner, book) => {
    if (!winner || Number(book.price) > Number(winner.price)) return book;
    return winner;
  }, null);
  const lowStock = state.books
    .filter((book) => Number(book.stock) <= 2)
    .sort((a, b) => Number(a.stock) - Number(b.stock));
  const topStock = state.books
    .slice()
    .sort((a, b) => Number(b.stock) - Number(a.stock))
    .slice(0, 5);
  const maxStock = Math.max(...topStock.map((book) => Number(book.stock) || 0), 1);
  const averagePrice = data.titles ? data.value / Math.max(data.stock, 1) : 0;

  $("#summaryTitles").textContent = number(data.titles);
  $("#summaryUnits").textContent = number(data.stock);
  $("#summaryValue").textContent = money(data.value);
  $("#summaryPages").textContent = number(data.pages);

  $("#insights").innerHTML = [
    ["Libro premium", mostExpensive ? `${mostExpensive.name} (${money(mostExpensive.price)})` : "Sin datos"],
    ["Stock bajo", lowStock.length ? `${lowStock.length} titulo(s) necesitan reposicion` : "Todo se ve bien"],
    ["Precio promedio", data.stock ? money(averagePrice) : "$0"],
    ["Meta sugerida", data.stock < 20 ? "Subir stock a 20 unidades" : "Rotar los titulos lentos"]
  ].map(([label, value]) => `
    <div class="insight">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");

  if (!topStock.length) {
    $("#stockBars").innerHTML = `<div class="empty">Crea libros para ver el ranking.</div>`;
    return;
  }

  $("#stockBars").innerHTML = topStock.map((book) => {
    const percent = Math.max(4, Math.round(((Number(book.stock) || 0) / maxStock) * 100));
    return `
      <div class="bar">
        <div class="bar-head">
          <strong>${escapeHtml(book.name)}</strong>
          <span>${number(book.stock)} un.</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function render() {
  renderClientOptions();
  renderQuickSummary();
  renderInventory();
  renderSummary();
}

function createPreview() {
  const price = Number($("#bookPrice").value) || 0;
  const stock = Number($("#bookStock").value) || 0;
  $("#createPreview").textContent = money(price * stock);
}

function resetCreateForm() {
  $("#bookForm").reset();
  createPreview();
}

function addBook(event) {
  event.preventDefault();
  const book = {
    id: uid(),
    name: $("#bookName").value.trim(),
    author: $("#bookAuthor").value.trim(),
    client: $("#bookClient").value.trim(),
    pages: Number($("#bookPages").value) || 0,
    price: Number($("#bookPrice").value) || 0,
    stock: Number($("#bookStock").value) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!book.name || !book.author || book.pages <= 0 || book.price <= 0 || book.stock < 0) {
    showToast("Completa todos los datos del libro");
    return;
  }

  state.books.push(book);
  save();
  resetCreateForm();
  render();
  setTab("inventory");
  showToast("Libro guardado");
}

function openModal(selector) {
  const modal = $(selector);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(selector) {
  const modal = $(selector);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function requestPassword(action, id) {
  pendingAction = { action, id };
  $("#passwordInput").value = "";
  $("#passwordModal p").textContent = action === "delete"
    ? "Ingresa la clave para eliminar este libro."
    : "Ingresa la clave para modificar este libro.";
  openModal("#passwordModal");
  setTimeout(() => $("#passwordInput").focus(), 50);
}

function openEdit(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) {
    showToast("Libro no encontrado");
    return;
  }
  editingId = id;
  $("#editName").value = book.name;
  $("#editAuthor").value = book.author;
  $("#editClient").value = clientName(book);
  $("#editPages").value = book.pages;
  $("#editPrice").value = book.price;
  $("#editStock").value = book.stock;
  openModal("#editModal");
}

function deleteBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  const confirmed = window.confirm(`Eliminar "${book.name}" del inventario?`);
  if (!confirmed) return;
  state.books = state.books.filter((item) => item.id !== id);
  save();
  render();
  showToast("Libro eliminado");
}

function verifyPassword(event) {
  event.preventDefault();
  if ($("#passwordInput").value !== ADMIN_PASSWORD) {
    $("#passwordInput").value = "";
    showToast("Clave incorrecta");
    return;
  }

  const action = pendingAction;
  pendingAction = null;
  closeModal("#passwordModal");

  if (!action) return;
  if (action.action === "edit") openEdit(action.id);
  if (action.action === "delete") deleteBook(action.id);
}

function saveEdit(event) {
  event.preventDefault();
  const book = state.books.find((item) => item.id === editingId);
  if (!book) {
    showToast("Libro no encontrado");
    return;
  }

  const next = {
    ...book,
    name: $("#editName").value.trim(),
    author: $("#editAuthor").value.trim(),
    client: $("#editClient").value.trim(),
    pages: Number($("#editPages").value) || 0,
    price: Number($("#editPrice").value) || 0,
    stock: Number($("#editStock").value) || 0,
    updatedAt: new Date().toISOString()
  };

  if (!next.name || !next.author || next.pages <= 0 || next.price <= 0 || next.stock < 0) {
    showToast("Completa todos los datos del libro");
    return;
  }

  Object.assign(book, next);
  save();
  editingId = "";
  closeModal("#editModal");
  render();
  showToast("Libro modificado");
}

function handleInventoryClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  requestPassword(button.dataset.action, button.dataset.id);
}

function bindEvents() {
  $$(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("#bookForm").addEventListener("submit", addBook);
  $("#bookPrice").addEventListener("input", createPreview);
  $("#bookStock").addEventListener("input", createPreview);
  $("#searchInput").addEventListener("input", renderInventory);
  $("#bookList").addEventListener("click", handleInventoryClick);
  $("#passwordForm").addEventListener("submit", verifyPassword);
  $("#cancelPasswordBtn").addEventListener("click", () => {
    pendingAction = null;
    closeModal("#passwordModal");
  });
  $("#editForm").addEventListener("submit", saveEdit);
  $("#cancelEditBtn").addEventListener("click", () => {
    editingId = "";
    closeModal("#editModal");
  });
}

load();
bindEvents();
createPreview();
render();
