const form = document.querySelector("#applicationForm");
const statusBox = document.querySelector("#formStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusBox.textContent = "Отправляем заявку...";
  statusBox.className = "status";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Не удалось отправить заявку.");

    form.reset();
    statusBox.textContent = "Готово. Заявка отправлена.";
    statusBox.classList.add("success");
  } catch (error) {
    statusBox.textContent = error.message;
    statusBox.classList.add("error");
  }
});
