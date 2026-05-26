# ⚡ Быстрый старт ЕПТА v2.0

## 🎯 Запуск за 3 шага

### 1️⃣ Установка (один раз)

```bash
# Установить все зависимости
npm run setup

# Создать Python venv
cd python_services
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..

# Скопировать Python backend из старого проекта
cp -r ../enta_new/server_python/* python_services/app/
```

### 2️⃣ Запуск

```bash
npm run dev
```

### 3️⃣ Открыть

http://localhost:3000

---

## 📋 Что запускается

- ✅ Frontend (React) - порт 3000
- ✅ Backend (Node.js) - порт 4000  
- ✅ Python API (FastAPI) - порт 8000

---

## 🔑 Первый вход

1. Откройте http://localhost:3000
2. Введите любое имя пользователя
3. Пароль опционален
4. Готово!

---

## 🛑 Остановка

`Ctrl + C` в терминале

---

## 📁 Структура

```
epta-social/
├── frontend/         # React приложение
├── backend/          # Node.js сервер
├── python_services/  # FastAPI backend
└── package.json      # Главный файл
```

---

## 🔧 Альтернативный запуск

Если `npm run dev` не работает, запустите отдельно:

```bash
# Терминал 1
cd frontend && npm run dev

# Терминал 2
cd backend && npm run dev

# Терминал 3
cd python_services
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

---

## 💡 Полезные команды

```bash
# Установить зависимости
npm run setup

# Запустить всё
npm run dev

# Только frontend
npm run dev:frontend

# Только backend
npm run dev:backend

# Только Python
npm run dev:python

# Собрать для продакшена
npm run build
```

---

## 🐛 Проблемы?

### Порт занят
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill
```

### Python не запускается
```bash
cd python_services
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Нет файлов в python_services/app/
```bash
# Скопировать из старого проекта
cp -r ../enta_new/server_python/* python_services/app/
```

---

## 📚 Больше информации

См. [README.md](README.md) для полной документации

---

**Готово! Проект запущен** 🎉
