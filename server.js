const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-this-long-secret";
const DATA_FILE = path.join(__dirname, "applications.json");

app.use(express.json({ limit: "250kb" }));
app.use(express.static(__dirname));

async function readApplications() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeApplications(applications) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(applications, null, 2));
}

function createMailer() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "ADMIN_EMAIL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    return {
      ready: false,
      missing,
      sendMail: async (message) => {
        console.log("Email is not configured. Message preview:", message);
      }
    };
  }

  return nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || "true") === "true",
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
}

const mailer = createMailer();

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function requireAdmin(req, res, next) {
  const token = req.query.token || req.body.token;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Неверный админ-токен." });
  }
  next();
}

function renderApplicationEmail(application) {
  const acceptUrl = `${BASE_URL}/admin/decision?id=${application.id}&decision=accepted&token=${ADMIN_TOKEN}`;
  const rejectUrl = `${BASE_URL}/admin/decision?id=${application.id}&decision=rejected&token=${ADMIN_TOKEN}`;

  return `
    <h2>Новая заявка на работу</h2>
    <p><b>Компания:</b> КОКСтейшн Интернашинал / COckStation International</p>
    <p><b>Имя:</b> ${application.name}</p>
    <p><b>Email:</b> ${application.email}</p>
    <p><b>Телефон:</b> ${application.phone || "Не указан"}</p>
    <p><b>Должность:</b> ${application.position}</p>
    <p><b>Опыт:</b> ${application.experience || "Не указан"}</p>
    <p><b>Сообщение:</b><br>${application.message || "Не указано"}</p>
    <p>
      <a href="${acceptUrl}" style="display:inline-block;padding:12px 18px;background:#16803c;color:#fff;text-decoration:none;border-radius:8px;">Принять</a>
      <a href="${rejectUrl}" style="display:inline-block;padding:12px 18px;background:#b42318;color:#fff;text-decoration:none;border-radius:8px;margin-left:8px;">Не принять</a>
    </p>
  `;
}

async function sendApplicationToAdmin(application) {
  await mailer.sendMail({
    from: `"COckStation International" <${process.env.SMTP_USER || "site@example.com"}>`,
    to: ADMIN_EMAIL || process.env.SMTP_USER || "admin@example.com",
    replyTo: application.email,
    subject: `Новая заявка: ${application.name}`,
    html: renderApplicationEmail(application)
  });
}

async function sendDecisionToApplicant(application) {
  const accepted = application.status === "accepted";
  await mailer.sendMail({
    from: `"COckStation International" <${process.env.SMTP_USER || "site@example.com"}>`,
    to: application.email,
    subject: accepted ? "Ваша заявка принята" : "Ответ по вашей заявке",
    html: `
      <h2>${accepted ? "Ваша заявка принята" : "Спасибо за вашу заявку"}</h2>
      <p>${accepted
        ? "Мы приняли вашу заявку. Скоро с вами свяжется представитель компании."
        : "К сожалению, сейчас мы не готовы принять вашу заявку."}</p>
      <p>КОКСтейшн Интернашинал / COckStation International</p>
    `
  });
}

app.post("/api/applications", async (req, res) => {
  const application = {
    id: crypto.randomUUID(),
    name: cleanText(req.body.name, 100),
    email: cleanText(req.body.email, 150),
    phone: cleanText(req.body.phone, 50),
    position: cleanText(req.body.position, 100),
    experience: cleanText(req.body.experience, 60),
    message: cleanText(req.body.message, 1200),
    status: "new",
    createdAt: new Date().toISOString(),
    decidedAt: null
  };

  if (!application.name || !isEmail(application.email) || !application.position) {
    return res.status(400).json({ error: "Заполните имя, правильный email и должность." });
  }

  const applications = await readApplications();
  applications.unshift(application);
  await writeApplications(applications);

  try {
    await sendApplicationToAdmin(application);
  } catch (error) {
    console.error("Failed to send admin email:", error);
    return res.status(500).json({
      error: "Заявка сохранена, но письмо администратору не отправилось. Проверьте настройки SMTP."
    });
  }

  res.json({ ok: true, message: "Заявка отправлена." });
});

app.get("/api/admin/applications", requireAdmin, async (_req, res) => {
  res.json(await readApplications());
});

app.post("/api/admin/decision", requireAdmin, async (req, res) => {
  const { id, decision } = req.body;
  if (!["accepted", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Неверное решение." });
  }

  const applications = await readApplications();
  const application = applications.find((item) => item.id === id);
  if (!application) return res.status(404).json({ error: "Заявка не найдена." });

  application.status = decision;
  application.decidedAt = new Date().toISOString();
  await writeApplications(applications);

  try {
    await sendDecisionToApplicant(application);
  } catch (error) {
    console.error("Failed to send applicant email:", error);
  }

  res.json({ ok: true, application });
});

app.get("/admin/decision", async (req, res) => {
  const { id, decision, token } = req.query;
  if (token !== ADMIN_TOKEN) return res.status(403).send("Неверный админ-токен.");
  if (!["accepted", "rejected"].includes(decision)) return res.status(400).send("Неверное решение.");

  const applications = await readApplications();
  const application = applications.find((item) => item.id === id);
  if (!application) return res.status(404).send("Заявка не найдена.");

  application.status = decision;
  application.decidedAt = new Date().toISOString();
  await writeApplications(applications);

  try {
    await sendDecisionToApplicant(application);
  } catch (error) {
    console.error("Failed to send applicant email:", error);
  }

  res.send(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Решение сохранено</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="decision-page">
        <main class="decision-box">
          <h1>Решение сохранено</h1>
          <p>Заявка от ${application.name}: ${decision === "accepted" ? "принята" : "не принята"}.</p>
          <a class="button" href="/admin.html?token=${ADMIN_TOKEN}">Открыть админ-панель</a>
        </main>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Site is running: http://localhost:${PORT}`);
});
