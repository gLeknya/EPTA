# 🏗️ Архитектура ЕПТА v2.0

## Обзор

Проект построен на современной модульной архитектуре с четким разделением ответственности.

## Стек технологий

### Frontend
- **React 18** - UI библиотека
- **TypeScript** - type safety
- **Vite** - быстрая сборка
- **Zustand** - state management
- **React Router** - роутинг

### Backend (Node.js)
- **Express** - HTTP сервер
- **WebSocket** - real-time
- **TypeScript** - type safety

### Backend (Python)
- **FastAPI** - REST API
- **SQLAlchemy** - ORM
- **Pydantic** - валидация
- **JWT** - аутентификация

## Архитектурные принципы

### 1. Feature-based структура

Вместо разделения по типам файлов (components, utils, etc), код организован по фичам:

```
features/
├── posts/
│   ├── api.ts
│   ├── store.ts
│   ├── types.ts
│   └── components/
├── auth/
└── comments/
```

**Преимущества:**
- Легко найти весь код фичи
- Легко удалить фичу
- Независимые модули

### 2. Разделение ответственности

```
Frontend → REST API → Python Backend → Database
Frontend → WebSocket → Node Backend → Redis
```

- **Frontend** - UI и клиентская логика
- **Node Backend** - WebSocket, proxy, статика
- **Python Backend** - бизнес-логика, БД, валидация

### 3. Type Safety

TypeScript везде:
- Frontend полностью типизирован
- Backend (Node) типизирован
- Общие типы в `@types`

### 4. Path Aliases

Вместо:
```ts
import { api } from '../../../api/client';
```

Используем:
```ts
import { api } from '@api/client';
```

## Структура Frontend

```
frontend/src/
├── pages/              # Страницы приложения
│   ├── Feed/          # Лента постов
│   ├── Profile/       # Профиль
│   └── Auth/          # Авторизация
│
├── components/        # Переиспользуемые компоненты
│   ├── ui/           # UI kit (Button, Modal, Input)
│   └── layout/       # Layout компоненты
│
├── features/         # Бизнес-логика по фичам
│   ├── posts/
│   ├── auth/
│   └── comments/
│
├── store/            # Zustand stores
│   ├── auth.ts
│   ├── posts.ts
│   └── notifications.ts
│
├── api/              # API клиент
│   └── client.ts
│
├── types/            # TypeScript типы
│   └── api.ts
│
└── styles/           # Глобальные стили
    └── global.css
```

## Структура Backend (Node)

```
backend/src/
├── routes/           # HTTP роуты
│   └── health.ts
│
├── websocket/        # WebSocket сервер
│   ├── server.ts
│   └── handlers.ts
│
├── services/         # Сервисы
│   └── proxy.ts     # Proxy к Python API
│
└── middleware/       # Middleware
    ├── cors.ts
    └── errorHandler.ts
```

## Структура Python Backend

```
python_services/app/
├── api/              # API endpoints
│   ├── v1/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── posts.py
│   │   └── comments.py
│   └── deps.py
│
├── models/           # SQLAlchemy модели
│   ├── user.py
│   ├── post.py
│   └── comment.py
│
├── schemas/          # Pydantic схемы
│   ├── user.py
│   └── post.py
│
├── database/         # Database
│   └── session.py
│
└── main.py           # FastAPI app
```

## Поток данных

### Аутентификация

```
1. User вводит credentials
2. Frontend → POST /api/auth/login → Python
3. Python проверяет, создает JWT
4. Python → Frontend (accessToken + refreshToken)
5. Frontend сохраняет token в localStorage
6. Frontend использует token в headers
```

### Создание поста

```
1. User вводит текст
2. Frontend → usePostsStore.createPost()
3. Store → api.createPost()
4. API → POST /api/posts → Python
5. Python валидирует, сохраняет в БД
6. Python → Frontend (новый пост)
7. Store обновляет state
8. UI автоматически обновляется
```

### Real-time уведомления

```
1. Frontend подключается к WebSocket
2. Python создает событие
3. Python → Redis pub/sub
4. Node Backend слушает Redis
5. Node → WebSocket → Frontend
6. Frontend показывает уведомление
```

## State Management (Zustand)

Вместо Redux используем Zustand - проще и легче:

```ts
// Создание store
export const usePostsStore = create<PostsState>((set) => ({
  posts: [],
  loadPosts: async () => {
    const data = await api.getPosts();
    set({ posts: data.posts });
  }
}));

// Использование
function Feed() {
  const { posts, loadPosts } = usePostsStore();
  // ...
}
```

**Преимущества:**
- Меньше boilerplate
- Проще понять
- Лучше TypeScript support
- Меньше размер бандла

## API клиент

Единый клиент для всех API запросов:

```ts
class APIClient {
  // Автоматический refresh токенов
  // Обработка ошибок
  // Типизация
}

export const api = new APIClient();
```

**Фичи:**
- Автоматический refresh при 401
- Типизированные методы
- Централизованная обработка ошибок

## Безопасность

### JWT токены
- Access token (15 мин) - в localStorage
- Refresh token (30 дней) - в HttpOnly cookie

### CORS
- Whitelist разрешенных origin
- Credentials: include

### Валидация
- Pydantic схемы на backend
- TypeScript типы на frontend

## Масштабирование

### Добавление новой страницы

1. Создать `pages/NewPage/index.tsx`
2. Добавить роут в `App.tsx`
3. Готово!

### Добавление новой фичи

1. Создать `features/newFeature/`
2. Добавить API методы
3. Создать store
4. Использовать в компонентах

### Добавление нового сервиса

1. Создать папку в `python_services/`
2. Добавить в docker-compose
3. Настроить proxy в Node backend

## Что улучшено

### Было (старая версия)
- ❌ Хаотичная структура
- ❌ Дублирование кода
- ❌ localStorage для state
- ❌ Относительные импорты
- ❌ Нет типизации
- ❌ Сложно добавлять фичи

### Стало (v2.0)
- ✅ Feature-based архитектура
- ✅ DRY принцип
- ✅ Zustand для state
- ✅ Path aliases
- ✅ TypeScript везде
- ✅ Модульная структура

## Производительность

### Frontend
- Vite - мгновенный HMR
- Code splitting по роутам
- Lazy loading компонентов

### Backend
- FastAPI - один из самых быстрых Python фреймворков
- SQLAlchemy - эффективные запросы
- Redis - кеширование

## Тестирование

### Frontend
```bash
npm run test
```

### Backend
```bash
pytest
```

## Деплой

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker-compose up
```

## Заключение

Архитектура v2.0 решает все проблемы старой версии и готова к масштабированию.
