const tokenForm = document.querySelector("#tokenForm");
const tokenInput = document.querySelector("#adminToken");
const list = document.querySelector("#applications");
const statusBox = document.querySelector("#adminStatus");

const params = new URLSearchParams(window.location.search);
const tokenFromUrl = params.get("token");
if (tokenFromUrl) {
  localStorage.setItem("adminToken", tokenFromUrl);
  tokenInput.value = tokenFromUrl;
} else {
  tokenInput.value = localStorage.getItem("adminToken") || "";
}

tokenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadApplications();
});

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || "Запрос не выполнен.");
  return data;
}

function statusLabel(status) {
  if (status === "accepted") return "Принята";
  if (status === "rejected") return "Не принята";
  return "Новая";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderApplications(applications) {
  if (!applications.length) {
    list.innerHTML = `<article class="empty">Заявок пока нет.</article>`;
    return;
  }

  list.innerHTML = applications.map((item) => `
    <article class="application-card">
      <div class="card-head">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(item.position)} · ${formatDate(item.createdAt)}</p>
        </div>
        <span class="badge ${item.status}">${statusLabel(item.status)}</span>
      </div>
      <dl>
        <dt>Email</dt><dd><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></dd>
        <dt>Телефон</dt><dd>${escapeHtml(item.phone || "Не указан")}</dd>
        <dt>Опыт</dt><dd>${escapeHtml(item.experience || "Не указан")}</dd>
        <dt>О себе</dt><dd>${escapeHtml(item.message || "Не указано")}</dd>
      </dl>
      <div class="card-actions">
        <button class="button small" data-id="${item.id}" data-decision="accepted">Принять</button>
        <button class="button small danger" data-id="${item.id}" data-decision="rejected">Не принять</button>
      </div>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadApplications() {
  const token = localStorage.getItem("adminToken") || tokenInput.value.trim();
  if (!token) {
    statusBox.textContent = "Введите админ-токен.";
    return;
  }

  statusBox.textContent = "Загружаем заявки...";
  try {
    const applications = await requestJson(`/api/admin/applications?token=${encodeURIComponent(token)}`);
    statusBox.textContent = "";
    renderApplications(applications);
  } catch (error) {
    statusBox.textContent = error.message;
    list.innerHTML = "";
  }
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-decision]");
  if (!button) return;

  const token = localStorage.getItem("adminToken") || tokenInput.value.trim();
  button.disabled = true;
  statusBox.textContent = "Сохраняем решение...";

  try {
    await requestJson("/api/admin/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        id: button.dataset.id,
        decision: button.dataset.decision
      })
    });
    await loadApplications();
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadApplications();
