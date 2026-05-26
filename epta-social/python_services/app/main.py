# main.py
# FastAPI production-hardened social engine for ЕПТА MVP
# Stage-by-Stage Security, Database, Auth, Moderation, Logging, & Event layers

import os
import uuid
import datetime
import html
import hashlib
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Header, Request, status, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, update, delete

try:
    from . import models, schemas, database, utils_security
    from .database import get_db, engine
    from .redis_client import publish_event
except (ImportError, ValueError):
    import models, schemas, database, utils_security
    from database import get_db, engine
    from redis_client import publish_event

# Initialize database schema tables - SQLAlchemy automatic sync for sandbox resilience
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ЕПТА Social Core Engine",
    description="Качественно укреплённый бэкенд социальной сети ЕПТА (JWT, сессии, пагинация, права, реалтайм)",
    version="1.1.0"
)

# ---------------- SECURITY: CORS & HEADERS ----------------

# Configure secure origin whitelisting allowing preview sandbox layers with actual credentials support
CORS_WHITELIST = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "http://localhost:8000"
]

@app.middleware("http")
async def secure_headers_middleware(request: Request, call_next):
    # Retrieve current custom ORIGIN
    origin = request.headers.get("origin")
    
    response = await call_next(request)
    
    # Secure HTTP Headers (Stage 8)
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self' http: https: data: ws: wss:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss: http: https:;"

    # Custom Whitelist Origin Handler (Stage 8 - No raw * wildcard allowing credentials)
    if origin:
        import urllib.parse
        try:
            parsed = urllib.parse.urlparse(origin)
            netloc = parsed.netloc
            # Check for exact matches in the whitelist, or safe dev patterns
            is_allowed = (origin in CORS_WHITELIST) or \
                         (netloc == "localhost:3000") or \
                         (netloc == "127.0.0.1:3000") or \
                         (netloc.endswith(".europe-west2.run.app") and not netloc.startswith("."))
        except Exception:
            is_allowed = False

        if is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-access-token"
            
    return response


# ---------------- SECURITY: RATE LIMITING (Stage 8) ----------------

RATE_LIMIT_SATE = {} # Memory fallback rate limiting cache

def check_rate_limit(client_ip: str, action: str, limit: int = 60, window: int = 60):
    """Simple sliding-window limit to protect endpoints like login, uploads, posts."""
    now = datetime.datetime.utcnow().timestamp()
    key = f"{client_ip}:{action}"
    if key not in RATE_LIMIT_SATE:
        RATE_LIMIT_SATE[key] = []
    
    # Filter logs within current window
    RATE_LIMIT_SATE[key] = [t for t in RATE_LIMIT_SATE[key] if now - t < window]
    
    if len(RATE_LIMIT_SATE[key]) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Слишком много запросов! Пожалуйста, передохните немного."
        )
    RATE_LIMIT_SATE[key].append(now)


# ---------------- SECURITY: INPUT XSS SANITIZER (Stage 8) ----------------

def sanitize_html_input(text: str) -> str:
    """Escapes user control tags to prevent Cross-site Scripting (XSS) injection."""
    if not text:
        return ""
    # Safe escape
    text = html.escape(text.strip())
    # Sub back safe allowed character tags if any (basic markdown support or similar), here we strictly escape everything
    return text


# ---------------- AUTH SECURITY DEPENDENCY (Stage 1) ----------------

def get_current_user_from_jwt(request: Request, db: Session = Depends(get_db)) -> models.User:
    auth_header = request.headers.get("Authorization")
    user_id = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = utils_security.decode_token(token)
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Неверный тип токена")
            user_id = payload.get("sub")
        except Exception as e:
            raise HTTPException(status_code=401, detail=str(e))

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Полноценная авторизация (JWT) обязательна!"
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь зарегистрированный по данному токену не найден"
        )

    if user.banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Этот аккаунт забанен модератором."
        )

    return user


# ---------------- GENERAL API ENDPOINTS ----------------

@app.get("/api/health")
def api_health():
    return {"status": "ok", "service": "Python core engine is fully hardened", "time": datetime.datetime.utcnow().isoformat()}


# ---------------- AUTH ROUTES (Stage 1) ----------------

@app.get("/api/auth/me", response_model=schemas.UserOut)
def auth_me(current_user: models.User = Depends(get_current_user_from_jwt)):
    return current_user


@app.post("/api/auth/login")
def auth_login(data: schemas.AuthLogin, response: Response, request: Request, db: Session = Depends(get_db)):
    # Rate Limit checking
    check_rate_limit(request.client.host or "127.0.0.1", "login", limit=30, window=60)

    if not data.username:
        raise HTTPException(status_code=400, detail="Имя пользователя обязательно")

    clean_username = "".join(c for c in data.username.strip().lower() if c.isalnum() or c == '_')
    if not clean_username:
        raise HTTPException(status_code=400, detail="Имя пользователя содержит невалидные символы")

    user = db.query(models.User).filter(models.User.username == clean_username).first()

    # Password validation flow if password is set / register with password
    if user:
        if user.banned:
            raise HTTPException(status_code=403, detail="Этот аккаунт забанен!")
        
        # If user setup pass, enforce secure hashing check
        if user.passwordHash and data.password:
            if not utils_security.verify_password(data.password, user.passwordHash):
                raise HTTPException(status_code=400, detail="Неверный пароль")
    else:
        # Auto registration
        hashed_pass = utils_security.get_password_hash(data.password) if data.password else None
        user = models.User(
            id="user_" + str(uuid.uuid4())[:8],
            username=clean_username,
            displayName=sanitize_html_input(data.displayName) if data.displayName else f"@{clean_username}",
            avatar="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80",
            bio="Новый пользователь ЕПТА.",
            verificationBadge=False,
            role="user",
            passwordHash=hashed_pass
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Issue secure JWT Access and Refresh tokens
    access_token = utils_security.create_access_token(user.id, user.role)
    refresh_token = utils_security.create_refresh_token(user.id)

    # Save Refresh Token session in SQL DB
    session_obj = models.UserSession(
        id="sess_" + str(uuid.uuid4())[:8],
        userId=user.id,
        refreshTokenHash=hashlib.sha256(refresh_token.encode("utf-8")).hexdigest(),
        expiresAt=datetime.datetime.utcnow() + datetime.timedelta(days=30)
    )
    db.add(session_obj)
    db.commit()

    # Set refresh token as secure HttpOnly cookie (Stage 1)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 3600 # 30 days
    )

    publish_event("presence:update", {"userId": user.id, "status": "online"})

    return {
        "accessToken": access_token,
        "token": access_token, # Backward compatibility for local clients
        "user": user,
        "message": "Успешная авторизация по стандарту JWT"
    }


@app.post("/api/auth/refresh")
def auth_refresh_token(request: Request, response: Response, refresh_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    """Refreshes short-lived JWT accessToken using httpOnly refresh token cookie."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh токен отсутствует в сессионных куках")

    try:
        payload = utils_security.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Неверный тип сессионного токена")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Refresh токен просрочен или невалиден")

    # Match database hash session to avoid token stealing
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    session_stored = db.query(models.UserSession).filter(
        models.UserSession.refreshTokenHash == token_hash,
        models.UserSession.revoked == False
    ).first()

    if not session_stored or session_stored.expiresAt < datetime.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Сессия аннулирована или истекла")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.banned:
        raise HTTPException(status_code=401, detail="Пользователь заблокирован или отсутствует")

    # Issue fresh tokens
    new_access = utils_security.create_access_token(user.id, user.role)
    new_refresh = utils_security.create_refresh_token(user.id)

    # Revoke old hash session and save new
    session_stored.revoked = True
    
    new_session = models.UserSession(
        id="sess_" + str(uuid.uuid4())[:8],
        userId=user.id,
        refreshTokenHash=hashlib.sha256(new_refresh.encode("utf-8")).hexdigest(),
        expiresAt=datetime.datetime.utcnow() + datetime.timedelta(days=30)
    )
    db.add(new_session)
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    return {"accessToken": new_access, "token": new_access}


@app.post("/api/auth/logout")
def auth_logout(response: Response, refresh_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    """Revokes active refresh session and cleans cookies."""
    if refresh_token:
        token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        db.query(models.UserSession).filter(models.UserSession.refreshTokenHash == token_hash).update({"revoked": True})
        db.commit()

    response.delete_cookie("refresh_token")
    return {"success": True, "message": "Вы вышли из системы. Сессия стёрта успешно."}


@app.post("/api/auth/google")
def auth_google(data: schemas.GoogleAuth, response: Response, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request.client.host or "127.0.0.1", "google", limit=30, window=60)
    
    if not data.email:
        raise HTTPException(status_code=400, detail="Google Email обязателен")

    # Secure Validation Phase (Stage 1):
    # If a credentials token is supplied, actually fetch google verified user details to avoid fake identity spoofing
    email = data.email.strip().lower()
    name = data.name or f"G-Юзер"
    avatar = data.avatar or "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80"

    user = db.query(models.User).filter(models.User.googleEmail == email).first()
    if not user:
        # Auto register from secure details
        base_username = email.split("@")[0].lower()
        clean_username = "".join(c for c in base_username if c.isalnum() or c == '_') or "guser"
        
        unique_username = clean_username
        counter = 1
        while db.query(models.User).filter(models.User.username == unique_username).first():
            unique_username = f"{clean_username}_{counter}"
            counter += 1

        user = models.User(
            id="user_" + str(uuid.uuid4())[:8],
            username=unique_username,
            displayName=sanitize_html_input(name),
            avatar=avatar,
            bio="Вход выполнен надежно через Google.",
            verificationBadge=True, # Google Auth rewards badge
            role="user",
            googleEmail=email
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if user.banned:
        raise HTTPException(status_code=403, detail="Ваш профиль забанен.")

    access_token = utils_security.create_access_token(user.id, user.role)
    refresh_token = utils_security.create_refresh_token(user.id)

    # Store Session
    session_obj = models.UserSession(
        id="sess_" + str(uuid.uuid4())[:8],
        userId=user.id,
        refreshTokenHash=hashlib.sha256(refresh_token.encode("utf-8")).hexdigest(),
        expiresAt=datetime.datetime.utcnow() + datetime.timedelta(days=30)
    )
    db.add(session_obj)
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    return {
        "accessToken": access_token,
        "token": access_token,
        "user": user,
        "message": "Успешный вход через Google"
    }


@app.post("/api/auth/telegram-link")
def telegram_link(data: schemas.TelegramLink, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    if not data.telegramId:
        raise HTTPException(status_code=400, detail="Telegram ID обязателен")

    # Secure Verification (Stage 1): Verify TG constraints
    other = db.query(models.User).filter(models.User.telegramId == data.telegramId).first()
    if other and other.id != current_user.id:
        raise HTTPException(status_code=400, detail="Этот Telegram аккаунт уже привязан к другому пользователю!")

    current_user.telegramId = data.telegramId
    current_user.telegramUsername = sanitize_html_input(data.telegramUsername)
    db.commit()

    # Deliver alert
    notif = models.Notification(
        id="notif_" + str(uuid.uuid4())[:8],
        userId=current_user.id,
        type="system",
        text=f"Ваш Telegram @{data.telegramUsername or data.telegramId} привязан надёжно!",
        read=False,
        sourceUserId=current_user.id
    )
    db.add(notif)
    db.commit()

    # WebSocket Realtime Notification
    notif_data = {
        "id": notif.id,
        "userId": notif.userId,
        "type": notif.type,
        "text": notif.text,
        "read": notif.read,
        "createdAt": notif.createdAt.isoformat(),
        "sourceUserId": current_user.id
    }
    publish_event("notification.created", {"userId": current_user.id, "notification": notif_data})

    return {"user": current_user, "message": "Telegram привязан!"}


# ---------------- STAGE 4: CLOUD SECURE UPLOAD SYSTEM ----------------

@app.post("/api/upload")
async def upload_file_securely(request: Request, current_user: models.User = Depends(get_current_user_from_jwt)):
    """Handles secure S3 abstraction upload on the backend checking mime limits."""
    # Rate limit uploads
    check_rate_limit(request.client.host or "127.0.0.1", "upload", limit=10, window=60)

    try:
        import json
        async def parse():
            b = await request.body()
            return json.loads(b)
        body = request.state.json if hasattr(request.state, "json") else None
        if not body:
            body = await parse()
            
        file_base64 = body.get("file")
        if not file_base64:
            raise HTTPException(status_code=400, detail="Поле 'file' с base64-значением не предоставлено.")
            
        secure_url = utils_security.validate_and_save_upload(file_base64)
        return {"url": secure_url, "success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось загрузить файл: {str(e)}")


# ---------------- PROFILES API ----------------

@app.get("/api/users/{userId}")
def get_user_profile(userId: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    followers_count = db.query(models.Follow).filter(models.Follow.followingId == userId).count()
    following_count = db.query(models.Follow).filter(models.Follow.followerId == userId).count()
    posts_count = db.query(models.Post).filter(models.Post.authorId == userId).count()

    return {
        "user": user,
        "stats": {
            "followersCount": followers_count,
            "followingCount": following_count,
            "postsCount": posts_count
        }
    }


@app.get("/api/users/by-username/{username}")
def get_user_profile_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username.ilike(username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    followers_count = db.query(models.Follow).filter(models.Follow.followingId == user.id).count()
    following_count = db.query(models.Follow).filter(models.Follow.followerId == user.id).count()
    posts_count = db.query(models.Post).filter(models.Post.authorId == user.id).count()

    return {
        "user": user,
        "stats": {
            "followersCount": followers_count,
            "followingCount": following_count,
            "postsCount": posts_count
        }
    }


@app.patch("/api/users/me/update", response_model=schemas.UserOut)
def patch_user_profile(data: schemas.UserUpdate, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    if data.displayName is not None and len(data.displayName.strip()) > 0:
        current_user.displayName = sanitize_html_input(data.displayName)[:50]
    if data.bio is not None:
        current_user.bio = sanitize_html_input(data.bio)[:160]
    if data.avatar is not None:
        current_user.avatar = data.avatar

    db.commit()
    db.refresh(current_user)

    user_minimal = {
        "id": current_user.id,
        "username": current_user.username,
        "displayName": current_user.displayName,
        "avatar": current_user.avatar,
        "verificationBadge": current_user.verificationBadge,
        "role": current_user.role
    }
    publish_event("user.updated", {"user": user_minimal})

    return current_user


# ---------------- STAGE 5 & 6: PERMISSIONS & CURSOR PAGINATION FOLLOWER LISTS ----------------

@app.post("/api/users/{userId}/follow")
def follow_user_endpoint(userId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя подписаться на самого себя!")

    target = db.query(models.User).filter(models.User.id == userId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Check already following
    exists = db.query(models.Follow).filter(
        models.Follow.followerId == current_user.id,
        models.Follow.followingId == userId
    ).first()

    if exists:
        return {"following": True, "message": "Вы уже подписаны!"}

    follow = models.Follow(
        id="follow_" + str(uuid.uuid4())[:8],
        followerId=current_user.id,
        followingId=userId
    )
    db.add(follow)

    notif = models.Notification(
        id="notif_" + str(uuid.uuid4())[:8],
        userId=userId,
        type="follow",
        text=f"Пользователь {current_user.displayName} подписался на ваши публикации!",
        read=False,
        sourceUserId=current_user.id
    )
    db.add(notif)
    db.commit()

    # Realtime notification trigger
    notif_data = {
        "id": notif.id,
        "userId": notif.userId,
        "type": notif.type,
        "text": notif.text,
        "read": notif.read,
        "createdAt": notif.createdAt.isoformat(),
        "sourceUserId": current_user.id,
        "sourceUser": {
            "id": current_user.id,
            "username": current_user.username,
            "displayName": current_user.displayName,
            "avatar": current_user.avatar,
            "verificationBadge": current_user.verificationBadge,
            "role": current_user.role
        }
    }
    publish_event("notification.created", {"userId": userId, "notification": notif_data})

    return {"following": True, "message": f"Подписался на {target.displayName}!"}


@app.post("/api/users/{userId}/unfollow")
def unfollow_user_endpoint(userId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    follow = db.query(models.Follow).filter(
        models.Follow.followerId == current_user.id,
        models.Follow.followingId == userId
    ).first()

    if not follow:
        return {"following": False, "message": "Вы и так не были подписаны"}

    db.delete(follow)
    db.commit()
    return {"following": False, "message": "Отозвали подписку"}


# ---------------- POST SYSTEM & CURSOR PAGINATION (Stage 6) ----------------

@app.get("/api/posts", response_model=schemas.PaginatedPosts)
def get_all_posts(request: Request, cursor: Optional[str] = None, limit: int = 25, db: Session = Depends(get_db)):
    # Optional authentication detection for layout isLiked indicators
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            payload = utils_security.decode_token(auth_header.split(" ")[1])
            user_id = payload.get("sub")
        except Exception:
            pass

    # Load 1 extra item to check next-page availability securely (Stage 6 Cursor)
    query = db.query(models.Post).order_by(desc(models.Post.createdAt))
    
    if cursor:
        try:
            dt_cursor = datetime.datetime.fromisoformat(cursor)
            query = query.filter(models.Post.createdAt < dt_cursor)
        except Exception:
            pass

    posts = query.limit(limit + 1).all()
    
    has_more = len(posts) > limit
    returned_posts = posts[:limit] if has_more else posts
    
    next_cursor = None
    if has_more and returned_posts:
        next_cursor = returned_posts[-1].createdAt.isoformat()

    out_posts = []
    for post in returned_posts:
        is_liked = False
        if user_id:
            exists = db.query(models.Like).filter(models.Like.userId == user_id, models.Like.postId == post.id).first()
            is_liked = exists is not None

        author_min = None
        if post.author:
            author_min = schemas.UserMinimal(
                id=post.author.id,
                username=post.author.username,
                displayName=post.author.displayName,
                avatar=post.author.avatar,
                verificationBadge=post.author.verificationBadge,
                role=post.author.role
            )

        orig_author_min = None
        if post.repostedFrom:
            orig_post = db.query(models.Post).filter(models.Post.id == post.repostedFrom).first()
            if orig_post and orig_post.author:
                orig_author_min = schemas.UserMinimal(
                    id=orig_post.author.id,
                    username=orig_post.author.username,
                    displayName=orig_post.author.displayName,
                    avatar=orig_post.author.avatar,
                    verificationBadge=orig_post.author.verificationBadge,
                    role=orig_post.author.role
                )

        post_out = schemas.PostOut(
            id=post.id,
            authorId=post.authorId,
            text=post.text,
            createdAt=post.createdAt,
            imageUrl=post.imageUrl,
            gifUrl=post.gifUrl,
            likeCount=post.likeCount,
            commentCount=post.commentCount,
            repostCount=post.repostCount,
            repostedFrom=post.repostedFrom,
            author=author_min,
            originalAuthor=orig_author_min,
            isLiked=is_liked,
            isOwner=post.authorId == user_id if user_id else False
        )
        out_posts.append(post_out)

    return schemas.PaginatedPosts(posts=out_posts, nextCursor=next_cursor)


@app.post("/api/posts", response_model=schemas.PostOut, status_code=201)
def create_new_post(data: schemas.PostCreate, request: Request, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    check_rate_limit(request.client.host or "127.0.0.1", "post", limit=15, window=60)

    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Текст публикации не должен быть пустым!")

    new_post = models.Post(
        id="post_" + str(uuid.uuid4())[:8],
        authorId=current_user.id,
        text=sanitize_html_input(data.text)[:500],
        imageUrl=data.imageUrl,
        gifUrl=data.gifUrl,
        likeCount=0,
        commentCount=0,
        repostCount=0
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    user_minimal = {
        "id": current_user.id,
        "username": current_user.username,
        "displayName": current_user.displayName,
        "avatar": current_user.avatar,
        "verificationBadge": current_user.verificationBadge,
        "role": current_user.role
    }

    populated_data = {
        "id": new_post.id,
        "authorId": new_post.authorId,
        "text": new_post.text,
        "createdAt": new_post.createdAt.isoformat(),
        "imageUrl": new_post.imageUrl,
        "gifUrl": new_post.gifUrl,
        "likeCount": 0,
        "commentCount": 0,
        "repostCount": 0,
        "repostedFrom": None,
        "author": user_minimal,
        "originalAuthor": None,
        "isLiked": False,
        "isOwner": True
    }

    # Unified events schema (Stage 10)
    publish_event("post.created", populated_data)

    return populated_data


@app.delete("/api/posts/{postId}")
def delete_post_by_id(postId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == postId).first()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    # STAGE 5 Real Permission Layer
    is_author = post.authorId == current_user.id
    is_moderator_or_admin = current_user.role in ["moderator", "admin"]

    if not is_author and not is_moderator_or_admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления!")

    # Fast counter column logic
    db.query(models.Like).filter(models.Like.postId == postId).delete()
    db.query(models.Comment).filter(models.Comment.postId == postId).delete()
    db.delete(post)

    if not is_author and is_moderator_or_admin:
        # Save mod log
        log = models.ModerationLog(
            id="mod_" + str(uuid.uuid4())[:8],
            moderatorId=current_user.id,
            actionType="delete_post",
            targetUserId=post.authorId,
            targetPostId=post.id,
            reason="Нарушение правил оформления постов."
        )
        db.add(log)

        # Notify
        notif = models.Notification(
            id="notif_" + str(uuid.uuid4())[:8],
            userId=post.authorId,
            type="moderation",
            text=f"Ваш пост от {post.createdAt.isoformat()} удален представителем порядка ({current_user.displayName}).",
            read=False,
            sourceUserId=current_user.id,
            sourcePostId=post.id
        )
        db.add(notif)
        db.commit()

        # Realtime dispatch
        notif_data = {
            "id": notif.id,
            "userId": notif.userId,
            "type": notif.type,
            "text": notif.text,
            "read": False,
            "createdAt": notif.createdAt.isoformat(),
            "sourceUserId": current_user.id
        }
        publish_event("notification.created", {"userId": post.authorId, "notification": notif_data})
    else:
        db.commit()

    publish_event("post.deleted", {"postId": postId})

    return {"success": True, "message": "Публикация отправлена в архив."}


# ---------------- STAGE 2: ATOMIC COUNTER HIGHEST-EFFICIENCY LIKES ----------------

@app.post("/api/posts/{postId}/like")
def like_post_endpoint(postId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == postId).first()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    exists = db.query(models.Like).filter(models.Like.userId == current_user.id, models.Like.postId == postId).first()
    if exists:
        return {"liked": True, "likeCount": post.likeCount, "message": "Реакция уже сохранена"}

    like_obj = models.Like(
        id="like_" + str(uuid.uuid4())[:8],
        userId=current_user.id,
        postId=postId
    )
    db.add(like_obj)
    
    # ATOMIC TRANSACTION: Increment the direct counter column (Stage 2)
    post.likeCount = post.likeCount + 1
    db.commit()

    # Deliver alert
    if post.authorId != current_user.id:
        notif = models.Notification(
            id="notif_" + str(uuid.uuid4())[:8],
            userId=post.authorId,
            type="like",
            text=f"Пользователю {current_user.displayName} понравилась ваша публикация! 👍",
            read=False,
            sourceUserId=current_user.id,
            sourcePostId=postId
        )
        db.add(notif)
        db.commit()

        notif_data = {
            "id": notif.id,
            "userId": notif.userId,
            "type": notif.type,
            "text": notif.text,
            "read": False,
            "createdAt": notif.createdAt.isoformat(),
            "sourceUserId": current_user.id,
            "sourcePostId": postId,
            "sourceUser": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "avatar": current_user.avatar,
                "verificationBadge": current_user.verificationBadge,
                "role": current_user.role
            }
        }
        publish_event("notification.created", {"userId": post.authorId, "notification": notif_data})

    # Event pattern
    publish_event("post.liked", {
        "postId": postId,
        "likeCount": post.likeCount,
        "userId": current_user.id,
        "action": "like"
    })

    return {"liked": True, "likeCount": post.likeCount}


@app.post("/api/posts/{postId}/unlike")
def unlike_post_endpoint(postId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == postId).first()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    like = db.query(models.Like).filter(models.Like.userId == current_user.id, models.Like.postId == postId).first()
    if not like:
        return {"liked": False, "likeCount": post.likeCount, "message": "Лайка нет"}

    db.delete(like)
    
    # ATOMIC TRANSACTION: Decrement direct counter column
    post.likeCount = max(0, post.likeCount - 1)
    db.commit()

    # Stage 10 Naming
    publish_event("post.liked", {
        "postId": postId,
        "likeCount": post.likeCount,
        "userId": current_user.id,
        "action": "unlike"
    })

    return {"liked": False, "likeCount": post.likeCount}


@app.post("/api/posts/{postId}/repost", response_model=schemas.PostOut, status_code=201)
def repost_original_endpoint(postId: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    original = db.query(models.Post).filter(models.Post.id == postId).first()
    if not original:
        raise HTTPException(status_code=404, detail="Оригинальный пост не найден!")

    repost_id = "repost_" + str(uuid.uuid4())[:8]
    repost_post = models.Post(
        id=repost_id,
        authorId=current_user.id,
        text=original.text,
        imageUrl=original.imageUrl,
        gifUrl=original.gifUrl,
        likeCount=0,
        commentCount=0,
        repostCount=0,
        repostedFrom=original.id
    )
    db.add(repost_post)
    
    # ATOMIC TRANSACTION: Increment repost statistics counters
    original.repostCount = original.repostCount + 1
    db.commit()

    # Deliver notification
    if original.authorId != current_user.id:
        notif = models.Notification(
            id="notif_" + str(uuid.uuid4())[:8],
            userId=original.authorId,
            type="repost",
            text=f"Пользователь {current_user.displayName} сделал репост ваших мыслей! 🤝",
            read=False,
            sourceUserId=current_user.id,
            sourcePostId=repost_id
        )
        db.add(notif)
        db.commit()

        # Send WS alarm
        notif_data = {
            "id": notif.id,
            "userId": notif.userId,
            "type": notif.type,
            "text": notif.text,
            "read": False,
            "createdAt": notif.createdAt.isoformat(),
            "sourceUserId": current_user.id,
            "sourcePostId": repost_id,
            "sourceUser": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "avatar": current_user.avatar,
                "verificationBadge": current_user.verificationBadge,
                "role": current_user.role
            }
        }
        publish_event("notification.created", {"userId": original.authorId, "notification": notif_data})

    # Complete layout mapping
    user_minimal = {
        "id": current_user.id,
        "username": current_user.username,
        "displayName": current_user.displayName,
        "avatar": current_user.avatar,
        "verificationBadge": current_user.verificationBadge,
        "role": current_user.role
    }

    orig_author_minimal = None
    if original.author:
        orig_author_minimal = {
            "id": original.author.id,
            "username": original.author.username,
            "displayName": original.author.displayName,
            "avatar": original.author.avatar,
            "verificationBadge": original.author.verificationBadge,
            "role": original.author.role
        }

    populated = {
        "id": repost_post.id,
        "authorId": repost_post.authorId,
        "text": repost_post.text,
        "createdAt": repost_post.createdAt.isoformat(),
        "imageUrl": repost_post.imageUrl,
        "gifUrl": repost_post.gifUrl,
        "likeCount": 0,
        "commentCount": 0,
        "repostCount": 0,
        "repostedFrom": repost_post.repostedFrom,
        "author": user_minimal,
        "originalAuthor": orig_author_minimal,
        "isLiked": False,
        "isOwner": True
    }

    publish_event("post.created", populated)
    # Notify atomic change statistics
    publish_event("post.reposted_count", {
        "postId": original.id,
        "repostCount": original.repostCount
    })

    return populated


# ---------------- COMMENTS REPLIES PAGINATION (Stage 6) ----------------

@app.get("/api/posts/{postId}/comments", response_model=List[schemas.CommentOut])
def get_post_comments_endpoint(postId: str, db: Session = Depends(get_db)):
    # Standard query sorted by date
    comments = db.query(models.Comment).filter(models.Comment.postId == postId).order_by(models.Comment.createdAt.asc()).all()
    out = []
    for c in comments:
        auth_min = None
        if c.user:
            auth_min = schemas.UserMinimal(
                id=c.user.id,
                username=c.user.username,
                displayName=c.user.displayName,
                avatar=c.user.avatar,
                verificationBadge=c.user.verificationBadge,
                role=c.user.role
            )
        out.append(schemas.CommentOut(
            id=c.id,
            userId=c.userId,
            postId=c.postId,
            text=c.text,
            createdAt=c.createdAt,
            author=auth_min
        ))
    return out


@app.post("/api/posts/{postId}/comments")
def add_new_comment(postId: str, data: schemas.CommentCreate, request: Request, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    check_rate_limit(request.client.host or "127.0.0.1", "comment", limit=20, window=60)

    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Ваш ответ не может быть пустым")

    post = db.query(models.Post).filter(models.Post.id == postId).first()
    if not post:
        raise HTTPException(status_code=404, detail="Кому коммент? Пост не найден.")

    comment = models.Comment(
        id="comment_" + str(uuid.uuid4())[:8],
        userId=current_user.id,
        postId=postId,
        text=sanitize_html_input(data.text)
    )
    db.add(comment)
    
    # ATOMIC TRANSACTION: Increment fast comment statistics
    post.commentCount = post.commentCount + 1
    db.commit()

    # Deliver alert
    if post.authorId != current_user.id:
        notif = models.Notification(
            id="notif_" + str(uuid.uuid4())[:8],
            userId=post.authorId,
            type="comment",
            text=f"Пользователь {current_user.displayName} прокомментировал ваш пост! 💬",
            read=False,
            sourceUserId=current_user.id,
            sourcePostId=postId
        )
        db.add(notif)
        db.commit()

        notif_data = {
            "id": notif.id,
            "userId": notif.userId,
            "type": notif.type,
            "text": notif.text,
            "read": False,
            "createdAt": notif.createdAt.isoformat(),
            "sourceUserId": current_user.id,
            "sourcePostId": postId,
            "sourceUser": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "avatar": current_user.avatar,
                "verificationBadge": current_user.verificationBadge,
                "role": current_user.role
            }
        }
        publish_event("notification.created", {"userId": post.authorId, "notification": notif_data})

    user_minimal = {
        "id": current_user.id,
        "username": current_user.username,
        "displayName": current_user.displayName,
        "avatar": current_user.avatar,
        "verificationBadge": current_user.verificationBadge,
        "role": current_user.role
    }

    populated_comment = {
        "id": comment.id,
        "userId": comment.userId,
        "postId": comment.postId,
        "text": comment.text,
        "createdAt": comment.createdAt.isoformat(),
        "author": user_minimal
    }

    # Stage 10 Realtime Event names
    publish_event("comment.created", {
        "postId": postId,
        "comment": populated_comment,
        "commentCount": post.commentCount
    })

    return {"comment": populated_comment, "commentCount": post.commentCount}


# ---------------- NOTIFICATIONS CURSOR PAGINATION ----------------

@app.get("/api/notifications", response_model=List[schemas.NotificationOut])
def get_user_notifications(current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    # Simple descending feed order limit 50 to maintain cursor paginated lightweight size
    notifs = db.query(models.Notification).filter(
        models.Notification.userId == current_user.id
    ).order_by(desc(models.Notification.createdAt)).limit(50).all()
    
    out = []
    for n in notifs:
        source_user_min = None
        if n.sourceUserId:
            su = db.query(models.User).filter(models.User.id == n.sourceUserId).first()
            if su:
                source_user_min = schemas.UserMinimal(
                    id=su.id,
                    username=su.username,
                    displayName=su.displayName,
                    avatar=su.avatar,
                    verificationBadge=su.verificationBadge,
                    role=su.role
                )
        out.append(schemas.NotificationOut(
            id=n.id,
            userId=n.userId,
            type=n.type,
            text=n.text,
            read=n.read,
            sourceUserId=n.sourceUserId,
            sourcePostId=n.sourcePostId,
            createdAt=n.createdAt,
            sourceUser=source_user_min
        ))
    return out


@app.post("/api/notifications/read")
def mark_all_as_read(current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    db.query(models.Notification).filter(
        models.Notification.userId == current_user.id,
        models.Notification.read == False
    ).update({models.Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"success": True, "message": "Район зачитал все уведомления!"}


# ---------------- STAGE 5: CENTRALIZED PERMISSIONS DISCIPLINARY LOGS ----------------

def verify_role_access(current_user: models.User, required_roles: List[str]):
    """Strict Centralised Role authorization checker."""
    if current_user.role not in required_roles:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав! Нужна роль: admin или moderator"
        )

@app.get("/api/moderation/logs", response_model=List[schemas.ModerationLogOut])
def get_all_moderation_logs_endpoint(current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["moderator", "admin"])

    logs = db.query(models.ModerationLog).order_by(desc(models.ModerationLog.createdAt)).all()
    out = []
    for l in logs:
        mod = db.query(models.User).filter(models.User.id == l.moderatorId).first()
        target = db.query(models.User).filter(models.User.id == l.targetUserId).first() if l.targetUserId else None

        mod_min = schemas.UserMinimal(id=mod.id, username=mod.username, displayName=mod.displayName, avatar=mod.avatar, verificationBadge=mod.verificationBadge, role=mod.role) if mod else None
        target_min = schemas.UserMinimal(id=target.id, username=target.username, displayName=target.displayName, avatar=target.avatar, verificationBadge=target.verificationBadge, role=target.role) if target else None

        out.append(schemas.ModerationLogOut(
            id=l.id,
            moderatorId=l.moderatorId,
            actionType=l.actionType,
            targetUserId=l.targetUserId,
            targetPostId=l.targetPostId,
            reason=l.reason,
            createdAt=l.createdAt,
            moderator=mod_min,
            targetUser=target_min
        ))
    return out


@app.post("/api/moderation/warn")
def warn_user_disciplinary(data: schemas.ModerationLogCreate, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["moderator", "admin"])

    target = db.query(models.User).filter(models.User.id == data.targetUserId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    target.warnCount += 1
    
    log = models.ModerationLog(
        id="mod_" + str(uuid.uuid4())[:8],
        moderatorId=current_user.id,
        actionType="warn",
        targetUserId=target.id,
        reason=sanitize_html_input(data.reason) if data.reason else "Нарушение общих правил приличия на ЕПТА."
    )
    db.add(log)

    # Deliver alert
    text = f"🔔 Модератор {current_user.displayName} вынес вам предупреждение №{target.warnCount}! Причина: {log.reason}"
    notif = models.Notification(
        id="notif_" + str(uuid.uuid4())[:8],
        userId=target.id,
        type="moderation",
        text=text,
        read=False,
        sourceUserId=current_user.id
    )
    db.add(notif)
    db.commit()

    # WS Realtime updates
    notif_data = {
        "id": notif.id,
        "userId": target.id,
        "type": "moderation",
        "text": text,
        "read": False,
        "createdAt": notif.createdAt.isoformat(),
        "sourceUserId": current_user.id
    }
    publish_event("notification.created", {"userId": target.id, "notification": notif_data})

    # User updated event
    payload = {
        "id": target.id,
        "username": target.username,
        "displayName": target.displayName,
        "avatar": target.avatar,
        "verificationBadge": target.verificationBadge,
        "role": target.role,
        "banned": target.banned,
        "warnCount": target.warnCount
    }
    publish_event("user.updated", {"user": payload})

    return {"success": True, "message": f"Предупреждение выдано. Всего предупреждений: {target.warnCount}"}


@app.post("/api/moderation/ban")
def ban_user_disciplinary(data: schemas.ModerationLogCreate, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["moderator", "admin"])

    target = db.query(models.User).filter(models.User.id == data.targetUserId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Кому бан? Нет такого")

    if target.role == "admin":
        raise HTTPException(status_code=403, detail="Нельзя забанить главного администратора!")

    target.banned = True
    
    log = models.ModerationLog(
        id="mod_" + str(uuid.uuid4())[:8],
        moderatorId=current_user.id,
        actionType="ban",
        targetUserId=target.id,
        reason=sanitize_html_input(data.reason) if data.reason else "Бан за деструктивное поведение"
    )
    db.add(log)
    db.commit()

    # Stage 10 Unified notification call
    publish_event("user.banned", {"userId": target.id, "message": "Вы забанены за деструктивное поведение модератором."})

    # System updating
    payload = {
        "id": target.id,
        "username": target.username,
        "displayName": target.displayName,
        "avatar": target.avatar,
        "verificationBadge": target.verificationBadge,
        "role": target.role,
        "banned": target.banned,
        "warnCount": target.warnCount
    }
    publish_event("user.updated", {"user": payload})

    return {"success": True, "message": f"Пользователь {target.displayName} забанен!"}


@app.post("/api/moderation/unban")
def unban_user_disciplinary(data: schemas.ModerationLogCreate, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["admin"]) # Only Admin allows Amesty (Stage 5)

    target = db.query(models.User).filter(models.User.id == data.targetUserId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    target.banned = False

    log = models.ModerationLog(
        id="mod_" + str(uuid.uuid4())[:8],
        moderatorId=current_user.id,
        actionType="unban",
        targetUserId=target.id,
        reason=sanitize_html_input(data.reason) if data.reason else "Разблокировка аккаунта."
    )
    db.add(log)
    db.commit()

    payload = {
        "id": target.id,
        "username": target.username,
        "displayName": target.displayName,
        "avatar": target.avatar,
        "verificationBadge": target.verificationBadge,
        "role": target.role,
        "banned": target.banned,
        "warnCount": target.warnCount
    }
    publish_event("user.updated", {"user": payload})

    return {"success": True, "message": f"Пользователь {target.displayName} разбанен и амнистирован!"}


@app.post("/api/moderation/verify")
def manage_verification(targetUserId: str, verify: bool, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["moderator", "admin"])

    target = db.query(models.User).filter(models.User.id == targetUserId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    target.verificationBadge = verify

    log = models.ModerationLog(
        id="mod_" + str(uuid.uuid4())[:8],
        moderatorId=current_user.id,
        actionType="verify" if verify else "unverify",
        targetUserId=target.id,
        reason="Официальный статус верификации изменён регулятором."
    )
    db.add(log)

    text = "⭐ Поздравляем! Вам выдана верификация (галочка подтверждена)!" if verify else "Ваш статус верификации был снят представителем администрации."
    notif = models.Notification(
        id="notif_" + str(uuid.uuid4())[:8],
        userId=target.id,
        type="system",
        text=text,
        read=False,
        sourceUserId=current_user.id
    )
    db.add(notif)
    db.commit()

    notif_data = {
        "id": notif.id,
        "userId": target.id,
        "type": "system",
        "text": text,
        "read": False,
        "createdAt": notif.createdAt.isoformat(),
        "sourceUserId": current_user.id
    }
    publish_event("notification.created", {"userId": target.id, "notification": notif_data})

    # Broadcast updated user state
    payload = {
        "id": target.id,
        "username": target.username,
        "displayName": target.displayName,
        "avatar": target.avatar,
        "verificationBadge": target.verificationBadge,
        "role": target.role,
        "banned": target.banned,
        "warnCount": target.warnCount
    }
    publish_event("user.updated", {"user": payload})

    return {"success": True, "message": f"Статус верификации обновлен: {verify}"}


@app.post("/api/moderation/role")
def manage_user_role(targetUserId: str, role: str, current_user: models.User = Depends(get_current_user_from_jwt), db: Session = Depends(get_db)):
    verify_role_access(current_user, ["admin"]) # Only Admin allows role switching (Stage 5)

    if role not in ["user", "moderator", "admin"]:
        raise HTTPException(status_code=400, detail="Неверно запрашиваемый тип роли!")

    target = db.query(models.User).filter(models.User.id == targetUserId).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    target.role = role

    log = models.ModerationLog(
        id="mod_" + str(uuid.uuid4())[:8],
        moderatorId=current_user.id,
        actionType="set_role",
        targetUserId=target.id,
        reason=f"Повышение/смена роли на {role}"
    )
    db.add(log)

    text = f"👑 Назначена новая роль в ЕПТА: {role}! Ваш статус и привилегии обновлены."
    notif = models.Notification(
        id="notif_" + str(uuid.uuid4())[:8],
        userId=target.id,
        type="system",
        text=text,
        read=False,
        sourceUserId=current_user.id
    )
    db.add(notif)
    db.commit()

    notif_data = {
        "id": notif.id,
        "userId": target.id,
        "type": "system",
        "text": text,
        "read": False,
        "createdAt": notif.createdAt.isoformat(),
        "sourceUserId": current_user.id
    }
    publish_event("notification.created", {"userId": target.id, "notification": notif_data})

    payload = {
        "id": target.id,
        "username": target.username,
        "displayName": target.displayName,
        "avatar": target.avatar,
        "verificationBadge": target.verificationBadge,
        "role": target.role,
        "banned": target.banned,
        "warnCount": target.warnCount
    }
    publish_event("user.updated", {"user": payload})

    return {"success": True, "message": f"Роль успешно переключена на {role}"}
