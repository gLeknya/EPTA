# database.py
# SQLAlchemy engine and session initialization supporting PostgreSQL with clean SQLite fallback

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Fallback to local SQLite if DATABASE_URL is unspecified to guarantee app start in preview mode
if not DATABASE_URL or not DATABASE_URL.startswith("postgresql"):
    DATABASE_URL = "sqlite:///./epta_db.sqlite"
    print(f"[DB] DATABASE_URL is empty or not PostgreSQL. Falling back to SQLite: {DATABASE_URL}")

connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

# Initialize engine with performance configuration
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args
    )
    # Enable WAL mode for SQLite and foreign keys
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency override for FastAPI route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
