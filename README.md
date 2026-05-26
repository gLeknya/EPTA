# 🌿 ЕПТА - Социальная сеть

## 🚀 Запуск (одна команда!)

```bash
cd FronEnd
npm start
```

Откройте http://localhost:3000

## 📋 Первый запуск

### 1. Установить Python зависимости (один раз):
```bash
cd enta_new
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r server_python/requirements.txt
deactivate
```

### 2. Запустить сайт:
```bash
cd FronEnd
npm start
```

Всё! Backend и Frontend запустятся автоматически.

## 📁 Структура

```
FronEnd/
├── server.js       # Запускает backend + frontend
├── api.js          # API-адаптер
├── you/            # Профиль
├── lenta/          # Лента
├── png/            # Иконки
└── oboi/           # Медиа

enta_new/
└── server_python/  # Python backend (автозапуск)
```

## 🔧 Как это работает

1. `npm start` запускает `server.js`
2. `server.js` автоматически запускает Python backend
3. Frontend проксирует `/api/*` на backend
4. Всё работает на одном порту: 3000

## 📚 Документация

- `FronEnd/README.md` - полная документация API
- `FronEnd/INTEGRATION_GUIDE.md` - руководство

**Готово!** 🎉
