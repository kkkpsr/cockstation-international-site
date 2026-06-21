# COckStation International Careers

Готовый сайт для регистрации на работу. Заявки сохраняются в `data/applications.json`, приходят владельцу на почту, а принять или отклонить кандидата можно из письма или через админ-панель.

## Как запустить

1. Установите Node.js: https://nodejs.org
2. Откройте папку проекта в VS Code.
3. В терминале выполните:

```bash
npm install
cp .env.example .env
```

4. Откройте файл `.env` и впишите свои данные:

```env
ADMIN_EMAIL=ваша-почта@example.com
ADMIN_TOKEN=придумайте-длинный-секретный-токен
SMTP_USER=ваша-почта@example.com
SMTP_PASS=пароль-приложения-от-почты
```

Для Gmail нужен не обычный пароль, а пароль приложения: Google Account -> Security -> 2-Step Verification -> App passwords.

5. Запустите сайт:

```bash
npm start
```

Сайт откроется на `http://localhost:3000`.

Админ-панель: `http://localhost:3000/admin.html`

## Как выложить сайт

Самый простой вариант:

1. Зарегистрируйтесь на https://render.com
2. Создайте новый проект `Web Service`.
3. Загрузите этот проект в GitHub и выберите репозиторий на Render.
4. Укажите:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. В разделе Environment добавьте переменные из `.env`:
   - `BASE_URL` - адрес вашего сайта на Render, например `https://your-site.onrender.com`
   - `ADMIN_EMAIL`
   - `ADMIN_TOKEN`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`

После публикации все заявки будут приходить на `ADMIN_EMAIL`.
