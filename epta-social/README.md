# 🌿 ЕПТА - Социальная сеть v2.0

Современная архитектура с React + TypeScript + FastAPI

## 🚀 Быстрый старт

### Первый запуск (один раз)

#### 1. Установить зависимости

```bash
# Корневые зависимости
npm install

# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
npm install
cd ..

# Python backend
cd python_services
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
deactivate
cd ..
```

#### 2. Скопировать Python backend из старого проекта

```bash
# Скопировать файлы из enta_new/server_python в python_services/app/
cp -r ../enta_new/server_python/* python_services/app/
```

### Запуск проекта

```bash
# Запустить всё одной командой
npm run dev
```

Это запустит:
- Frontend на http://localhost:3000
- Python API на http://localhost:8000

**Примечание:** Backend (Node.js) опционален, пока не используется

### Альтернативный запуск (по отдельности)

```bash
# Терминал 1 - Frontend
cd frontend
npm run dev

# Терминал 2 - Backend
cd backend
npm run dev

# Терминал 3 - Python
cd python_services
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

## 📁 Структура проекта

```
epta-social/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/        # Страницы (Feed, Profile, Auth)
│   │   ├── components/   # Переиспользуемые компоненты
│   │   ├── features/     # Фичи (posts, auth, comments)
│   │   ├── store/        # Zustand stores
│   │   ├── api/          # API клиент
│   │   ├── types/        # TypeScript типы
│   │   └── styles/       # Глобальные стили
│   └── package.json
│
├── backend/              # Node.js + Express (WebSocket + Proxy)
│   ├── src/
│   │   ├── routes/       # API роуты
│   │   ├── websocket/    # WebSocket сервер
│   │   └── services/     # Proxy к Python API
│   └── package.json
│
├── python_services/      # FastAPI (основная бизнес-логика)
│   ├── app/
│   │   ├── api/         # REST API endpoints
│   │   ├── models/      # SQLAlchemy модели
│   │   ├── schemas/     # Pydantic схемы
│   │   └── main.py      # FastAPI приложение
│   └── requirements.txt
│
├── .env                  # Конфигурация
├── package.json          # Root package.json
└── README.md
```

## 🏗️ Архитектура

### Frontend (React + TypeScript)
- **Vite** - быстрая сборка
- **React Router** - роутинг
- **Zustand** - state management
- **Path aliases** - чистые импорты (@pages, @store, @api)

### Backend (Node.js)
- **Express** - HTTP сервер
- **WebSocket** - real-time коммуникация
- **Proxy** - проксирует REST API к Python

### Python Services (FastAPI)
- **FastAPI** - REST API
- **SQLAlchemy** - ORM
- **Pydantic** - валидация
- **JWT** - аутентификация

## 🔑 Основные фичи

### Реализовано
- ✅ Аутентификация (JWT)
- ✅ Лента постов
- ✅ Создание постов
- ✅ Лайки
- ✅ Профили пользователей
- ✅ Автоматический refresh токенов

### В разработке
- 🔄 Комментарии
- 🔄 Уведомления
- 🔄 WebSocket real-time
- 🔄 Загрузка изображений

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - вход/регистрация
- `POST /api/auth/logout` - выход
- `POST /api/auth/refresh` - обновление токена
- `GET /api/auth/me` - текущий пользователь

### Posts
- `GET /api/posts` - лента постов
- `POST /api/posts` - создать пост
- `POST /api/posts/:id/like` - лайкнуть
- `POST /api/posts/:id/unlike` - убрать лайк

### Users
- `GET /api/users/:id` - профиль пользователя
- `PATCH /api/users/me/update` - обновить профиль

## 🛠️ Разработка

### Добавить новую страницу

1. Создать компонент в `frontend/src/pages/`
2. Добавить роут в `App.tsx`
3. Создать store если нужно

### Добавить новую фичу

1. Создать папку в `frontend/src/features/`
2. Добавить API методы в `api/client.ts`
3. Создать store в `store/`
4. Создать компоненты

### Добавить API endpoint

1. Добавить роут в `python_services/app/api/`
2. Добавить метод в `frontend/src/api/client.ts`
3. Обновить типы в `types/api.ts`

## 🔧 Конфигурация

### .env файл

```env
NODE_ENV=development
FRONTEND_PORT=3000
BACKEND_PORT=4000
PYTHON_PORT=8000
DATABASE_URL=sqlite:///./epta.db
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

## 📦 Сборка для продакшена

```bash
# Собрать frontend
cd frontend
npm run build

# Собрать backend
cd backend
npm run build

# Запустить
npm start
```

## 🐛 Troubleshooting

### Порт занят
```bash
# Найти процесс
netstat -ano | findstr :3000

# Убить процесс
taskkill /PID <PID> /F
```

### Python venv не активируется
```bash
# Windows
cd python_services
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

### CORS ошибки
Проверьте что:
- Python API запущен на порту 8000
- Frontend проксирует `/api` на `localhost:8000`
- В `.env` правильный `CORS_ORIGIN`

## 📚 Документация

- [Архитектура](docs/ARCHITECTURE.md) - детали архитектуры
- [API](docs/API.md) - полная документация API
- [Deployment](docs/DEPLOYMENT.md) - деплой на продакшен

## 🎯 Что улучшено по сравнению со старой версией

### Архитектура
- ✅ Feature-based структура вместо хаоса
- ✅ TypeScript везде
- ✅ Zustand вместо localStorage
- ✅ Path aliases вместо `../../../`
- ✅ Модульная архитектура

### Разработка
- ✅ Один запуск для всего проекта
- ✅ Hot reload для всех сервисов
- ✅ Чистые импорты
- ✅ Type safety

### Масштабируемость
- ✅ Легко добавлять новые страницы
- ✅ Легко добавлять новые фичи
- ✅ Независимые модули
- ✅ Готово к росту команды

## 👥 Команда

Проект создан для современной разработки социальной сети.

## 📄 Лицензия

ISC
