const STORAGE_KEY = "libros-inventario-v1";
const ADMIN_PASSWORD = "1234";

const state = {
  books: [],
  sales: []
};

let pendingAction = null;
let editingId = "";
let addingStockId = "";
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
    if (saved && Array.isArray(saved.books)) state.books = saved.books.map(normalizeBook);
    if (saved && Array.isArray(saved.sales)) state.sales = saved.sales.map(normalizeSale);
  } catch {
    state.books = [];
    state.sales = [];
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

function todayStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildBackupPayload() {
  return {
    app: "inventario-libros",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      books: state.books,
      sales: state.sales
    }
  };
}

function exportBackup() {
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `respaldo-libros-${todayStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Respaldo guardado");
}

function normalizeBook(book) {
  const stock = Number(book.stock) || 0;
  let normalizedAssignments = Array.isArray(book.assignments)
    ? book.assignments.map(normalizeAssignment).filter((assignment) => assignment.client)
    : [];

  if (!normalizedAssignments.length && String(book.client || "").trim()) {
    normalizedAssignments = [normalizeAssignment({
      client: book.client,
      phone: book.phone,
      createdAt: book.updatedAt || book.createdAt
    })];
  }

  return {
    id: book.id || uid(),
    name: String(book.name || "").trim(),
    author: String(book.author || "").trim(),
    assignments: normalizedAssignments.slice(0, stock),
    pages: Number(book.pages) || 0,
    price: Number(book.price) || 0,
    stock,
    createdAt: book.createdAt || new Date().toISOString(),
    updatedAt: book.updatedAt || new Date().toISOString()
  };
}

function normalizeAssignment(assignment) {
  return {
    id: assignment.id || uid(),
    client: String(assignment.client || "").trim(),
    phone: String(assignment.phone || "").trim(),
    createdAt: assignment.createdAt || new Date().toISOString()
  };
}

function normalizeSale(sale) {
  return {
    id: sale.id || uid(),
    bookId: sale.bookId || "",
    bookName: String(sale.bookName || "").trim(),
    client: String(sale.client || "").trim(),
    phone: String(sale.phone || "").trim(),
    qty: Number(sale.qty) || 0,
    price: Number(sale.price) || 0,
    total: Number(sale.total) || 0,
    date: sale.date || new Date().toISOString()
  };
}

async function importBackup(file) {
  if (!file) return;
  const text = await file.text();
  const payload = JSON.parse(text);
  const imported = payload.data || payload;
  if (!Array.isArray(imported.books)) {
    throw new Error("Formato de respaldo invalido");
  }
  state.books = imported.books.map(normalizeBook).filter((book) => {
    return book.name && book.pages > 0 && book.price > 0 && book.stock >= 0;
  });
  state.sales = Array.isArray(imported.sales)
    ? imported.sales.map(normalizeSale).filter((sale) => sale.bookName && sale.qty > 0)
    : [];
  save();
  render();
}

function bookValue(book) {
  return (Number(book.price) || 0) * (Number(book.stock) || 0);
}

function assignments(book) {
  if (!Array.isArray(book.assignments)) book.assignments = [];
  return book.assignments;
}

function assignedCount(book) {
  return assignments(book).length;
}

function availableStock(book) {
  return Math.max((Number(book.stock) || 0) - assignedCount(book), 0);
}

function assignmentClient(assignment) {
  return String(assignment?.client || "").trim();
}

function assignmentPhone(assignment) {
  return String(assignment?.phone || "").trim();
}

function bookLabel(book, assignment = null) {
  const client = assignmentClient(assignment);
  return client ? `${book.name} - ${client}` : book.name;
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

function saleSelection() {
  const [bookId, assignmentId = "free"] = $("#saleBook").value.split("|");
  const book = state.books.find((item) => item.id === bookId);
  const assignment = book && assignmentId !== "free"
    ? assignments(book).find((item) => item.id === assignmentId)
    : null;
  return { book, assignment, isAssigned: Boolean(assignment) };
}

function saleBook() {
  return saleSelection().book;
}

function filteredBooks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  if (!query) return state.books;
  return state.books.filter((book) => {
    return book.name.toLowerCase().includes(query)
      || book.author.toLowerCase().includes(query)
      || assignments(book).some((assignment) => {
        return assignmentClient(assignment).toLowerCase().includes(query)
          || assignmentPhone(assignment).toLowerCase().includes(query);
      });
  });
}

function renderBookItems(rows) {
  if (!rows.length) {
    return `<div class="empty">No hay libros para mostrar.</div>`;
  }

  return rows.map(({ book, assignment, qty }) => {
    const client = assignmentClient(assignment);
    const phone = assignmentPhone(assignment);
    const author = book.author ? escapeHtml(book.author) : "Sin autor";
    return `
    <article class="book-item">
      <div class="book-top">
        <div class="book-title">
          <strong>${escapeHtml(book.name)}</strong>
          <span class="book-sub">${author}</span>
          <span class="pill-row">
            ${client ? `<span class="client-pill">Cliente: ${escapeHtml(client)}</span>` : `<span class="client-pill neutral">Sin cliente</span>`}
            ${phone ? `<span class="phone-pill">Tel: ${escapeHtml(phone)}</span>` : ""}
          </span>
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
          <strong>${number(qty)}</strong>
        </div>
        <div class="metric">
          <span class="meta">Valor</span>
          <strong>${money((Number(book.price) || 0) * qty)}</strong>
        </div>
      </div>
      <div class="book-actions">
        <button class="secondary" type="button" data-action="stock" data-id="${book.id}">Agregar</button>
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

  const availableRows = books
    .map((book) => ({ book, assignment: null, qty: availableStock(book) }))
    .filter((row) => row.qty > 0);
  const assignedRows = books.flatMap((book) => {
    return assignments(book).map((assignment) => ({ book, assignment, qty: 1 }));
  });
  const availableUnits = availableRows.reduce((sum, row) => sum + row.qty, 0);
  list.innerHTML = `
    <section class="inventory-group">
      <div class="group-head">
        <h3>Sin cliente asignado</h3>
        <span>${number(availableUnits)} un.</span>
      </div>
      ${renderBookItems(availableRows)}
    </section>
    <section class="inventory-group">
      <div class="group-head">
        <h3>Asignados a clientes</h3>
        <span>${number(assignedRows.length)} un.</span>
      </div>
      ${renderBookItems(assignedRows)}
    </section>
  `;
}

function renderClientOptions() {
  const clients = Array.from(new Set(state.books.flatMap((book) => {
    return assignments(book).map(assignmentClient).filter(Boolean);
  })))
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

function renderSaleOptions() {
  const select = $("#saleBook");
  const current = select.value;
  const saleOptions = state.books
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .flatMap((book) => {
      const free = availableStock(book);
      const freeValue = `${book.id}|free`;
      const freeOption = free > 0
        ? [{ value: freeValue, html: `<option value="${freeValue}">${escapeHtml(book.name)} (${number(free)} disp.)</option>` }]
        : [];
      const assignedOptions = assignments(book).map((assignment) => {
        const value = `${book.id}|${assignment.id}`;
        return { value, html: `<option value="${value}">${escapeHtml(bookLabel(book, assignment))} (1 disp.)</option>` };
      });
      return freeOption.concat(assignedOptions);
    });

  if (!saleOptions.length) {
    select.innerHTML = `<option value="">No hay stock disponible</option>`;
    $("#saleClientHint").textContent = "Sin cliente";
    $("#salePreview").textContent = "$0";
    return;
  }

  select.innerHTML = saleOptions.map((option) => option.html).join("");
  select.value = saleOptions.some((option) => option.value === current)
    ? current
    : select.options[0].value;
  salePreview();
}

function salePreview() {
  const { book, assignment } = saleSelection();
  const qty = Number($("#saleQty").value) || 0;
  if (!book) {
    $("#saleClientHint").textContent = "Sin cliente";
    $("#salePreview").textContent = "$0";
    return;
  }
  const client = assignmentClient(assignment);
  const phone = assignmentPhone(assignment);
  $("#saleClientHint").textContent = client ? `${client}${phone ? ` - ${phone}` : ""}` : "Sin cliente";
  $("#salePreview").textContent = money(qty * (Number(book.price) || 0));
}

function renderRecentSales() {
  const list = $("#recentSales");
  if (!state.sales.length) {
    list.innerHTML = `<div class="empty">Aun no hay ventas.</div>`;
    return;
  }
  list.innerHTML = state.sales
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)
    .map((sale) => `
      <article class="sale-item">
        <div>
          <strong>${escapeHtml(sale.client ? `${sale.bookName} - ${sale.client}` : sale.bookName)}</strong>
          <span>${number(sale.qty)} un. | ${money(sale.total)}</span>
        </div>
        <small>${new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(sale.date))}</small>
      </article>
    `).join("");
}

function render() {
  renderClientOptions();
  renderQuickSummary();
  renderInventory();
  renderSaleOptions();
  renderRecentSales();
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
  const client = $("#bookClient").value.trim();
  const phone = $("#bookPhone").value.trim();
  const stock = Number($("#bookStock").value) || 0;
  const book = {
    id: uid(),
    name: $("#bookName").value.trim(),
    author: $("#bookAuthor").value.trim(),
    assignments: client ? [normalizeAssignment({ client, phone })] : [],
    pages: Number($("#bookPages").value) || 0,
    price: Number($("#bookPrice").value) || 0,
    stock,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!book.name || book.pages <= 0 || book.price <= 0 || book.stock < 0) {
    showToast("Completa todos los datos del libro");
    return;
  }
  if (client && stock < 1) {
    showToast("Para asignar cliente necesitas al menos 1 unidad");
    return;
  }

  state.books.push(book);
  save();
  resetCreateForm();
  render();
  setTab("inventory");
  showToast("Libro guardado");
}

function sellBook(event) {
  event.preventDefault();
  const { book, assignment, isAssigned } = saleSelection();
  const qty = Number($("#saleQty").value) || 0;
  if (!book) {
    showToast("Selecciona un libro");
    return;
  }
  if (qty <= 0) {
    showToast("Ingresa una cantidad valida");
    return;
  }
  const maxStock = isAssigned ? 1 : availableStock(book);
  if (qty > maxStock) {
    showToast("No hay stock suficiente");
    return;
  }

  book.stock = Number(book.stock) - qty;
  if (isAssigned) {
    book.assignments = assignments(book).filter((item) => item.id !== assignment.id);
  }
  book.updatedAt = new Date().toISOString();
  state.sales.push({
    id: uid(),
    bookId: book.id,
    bookName: book.name,
    client: assignmentClient(assignment),
    phone: assignmentPhone(assignment),
    qty,
    price: Number(book.price) || 0,
    total: qty * (Number(book.price) || 0),
    date: new Date().toISOString()
  });
  save();
  $("#saleQty").value = "";
  render();
  showToast("Venta registrada");
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

function openStockDialog(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) {
    showToast("Libro no encontrado");
    return;
  }
  addingStockId = id;
  $("#stockBookName").textContent = book.name;
  $("#stockQty").value = "";
  $("#stockClient").value = "";
  $("#stockPhone").value = "";
  openModal("#stockModal");
  setTimeout(() => $("#stockQty").focus(), 50);
}

function saveStockAdd(event) {
  event.preventDefault();
  const book = state.books.find((item) => item.id === addingStockId);
  if (!book) {
    showToast("Libro no encontrado");
    return;
  }
  const qty = Number($("#stockQty").value) || 0;
  if (qty <= 0) {
    showToast("Ingresa unidades validas");
    return;
  }
  const client = $("#stockClient").value.trim();
  const phone = $("#stockPhone").value.trim();
  book.stock = Number(book.stock) + qty;
  if (client) {
    assignments(book).push(normalizeAssignment({ client, phone }));
  }
  book.updatedAt = new Date().toISOString();
  save();
  addingStockId = "";
  closeModal("#stockModal");
  render();
  showToast("Unidades agregadas");
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
  const firstAssignment = assignments(book)[0];
  $("#editName").value = book.name;
  $("#editAuthor").value = book.author;
  $("#editClient").value = assignmentClient(firstAssignment);
  $("#editPhone").value = assignmentPhone(firstAssignment);
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

  const client = $("#editClient").value.trim();
  const phone = $("#editPhone").value.trim();
  let nextAssignments = assignments(book).slice();
  if (client) {
    if (nextAssignments[0]) {
      nextAssignments[0] = { ...nextAssignments[0], client, phone };
    } else {
      nextAssignments = [normalizeAssignment({ client, phone })];
    }
  } else {
    nextAssignments = [];
  }

  const next = {
    ...book,
    name: $("#editName").value.trim(),
    author: $("#editAuthor").value.trim(),
    assignments: nextAssignments,
    pages: Number($("#editPages").value) || 0,
    price: Number($("#editPrice").value) || 0,
    stock: Number($("#editStock").value) || 0,
    updatedAt: new Date().toISOString()
  };

  if (!next.name || next.pages <= 0 || next.price <= 0 || next.stock < 0) {
    showToast("Completa todos los datos del libro");
    return;
  }
  if (next.stock < next.assignments.length) {
    showToast("El stock no puede ser menor a las unidades asignadas");
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
  if (button.dataset.action === "stock") {
    openStockDialog(button.dataset.id);
    return;
  }
  requestPassword(button.dataset.action, button.dataset.id);
}

function bindEvents() {
  $$(".bottom-nav button").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("#bookForm").addEventListener("submit", addBook);
  $("#bookPrice").addEventListener("input", createPreview);
  $("#bookStock").addEventListener("input", createPreview);
  $("#saleForm").addEventListener("submit", sellBook);
  $("#saleBook").addEventListener("change", salePreview);
  $("#saleQty").addEventListener("input", salePreview);
  $("#searchInput").addEventListener("input", renderInventory);
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importFile").addEventListener("change", async (event) => {
    try {
      await importBackup(event.target.files[0]);
      showToast("Respaldo importado");
    } catch {
      showToast("No se pudo importar");
    } finally {
      event.target.value = "";
    }
  });
  $("#bookList").addEventListener("click", handleInventoryClick);
  $("#passwordForm").addEventListener("submit", verifyPassword);
  $("#stockForm").addEventListener("submit", saveStockAdd);
  $("#cancelStockBtn").addEventListener("click", () => {
    addingStockId = "";
    closeModal("#stockModal");
  });
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
