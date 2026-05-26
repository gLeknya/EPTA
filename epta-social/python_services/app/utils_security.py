# utils_security.py
# High-security cryptographic and file storage abstraction layer for ЕПТА Foundation Hardening

import os
import re
import uuid
import jwt
import hashlib
import binascii
from datetime import datetime, timedelta
from fastapi import HTTPException, UploadFile, status
from typing import Optional, Union

_jwt_secret = os.getenv("JWT_SECRET")
if not _jwt_secret:
    if os.getenv("NODE_ENV") == "production":
        raise ValueError("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!")
    _jwt_secret = "epta_dev_only_jwt_secret_do_not_use_in_prod"
SECRET_KEY = _jwt_secret
ALGORITHM = "HS256"

# Password hashing (Robust pure-python SHA-256 with 100,000 iterations PBKDF2 - standard and robust)
def get_password_hash(password: str) -> str:
    salt = binascii.hexlify(os.urandom(16))
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"pbkdf2_sha256$100000${salt.decode('utf-8')}${binascii.hexlify(key).decode('utf-8')}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not hashed_password.startswith("pbkdf2_sha256$"):
        return False
    try:
        parts = hashed_password.split('$')
        iterations = int(parts[1])
        salt = parts[2].encode('utf-8')
        original_hash = parts[3]
        key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, iterations)
        return binascii.hexlify(key).decode('utf-8') == original_hash
    except Exception:
        return False

# JWT Access and Refresh generator
def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=60) # Short-lived access
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=30) # Long-lived refresh
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4())
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Действие токена авторизации истекло")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен авторизации")


# --- S3 Compatible Cloud Upload and Validation Abstraction Layer ---
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp"
}

MAX_FILE_SIZE_MB = 10  # Max size allowed in single request

def sanitize_filename(filename: str) -> str:
    """Strip everything except simple ASCII letters, digits, dots and hyphens."""
    base = os.path.basename(filename)
    base = re.sub(r'[^a-zA-Z0-9.\-_]', '_', base)
    # Generate random unique name structure to avoid naming spoof attacks
    ext = os.path.splitext(base)[1]
    return f"epta_upload_{uuid.uuid4()[:12]}{ext}"

def validate_and_save_upload(file_data_base64: str) -> str:
    """
    Validates a base64 encoded image string representing an upload, checks size, integrity,
    MIME type and returns a secure, sandboxed path URL.
    """
    # Look for header metadata "data:image/png;base64,...."
    mime = "image/jpeg"
    clean_data = file_data_base64
    
    if file_data_base64.startswith("data:"):
        match = re.match(r"^data:(image/[a-zA-Z+]+);base64,", file_data_base64)
        if match:
            mime = match.group(1)
            clean_data = file_data_base64[len(match.group(0)):]
            
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый формат файла {mime}. Только JPEG, PNG, GIF, WEBP!"
        )

    import base64
    try:
        binary_data = base64.b64decode(clean_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Ошибка декодирования бинарных данных.")

    size_mb = len(binary_data) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"Размер файла {size_mb:.2f}MB превышает лимит {MAX_FILE_SIZE_MB}MB.")

    # S3 Compatible Stub or local upload system
    upload_dir = os.path.join(os.getcwd(), "public", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"image_{uuid.uuid4().hex[:16]}{ALLOWED_MIME_TYPES[mime]}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(binary_data)

    print(f"[SECURITY UPLOAD SUCCESS] Saved securely: {filename}")
    return f"/uploads/{filename}"
