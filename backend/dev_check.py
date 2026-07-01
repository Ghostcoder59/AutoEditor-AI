import os
import sqlite3

BASE = os.path.dirname(__file__)
MODEL = os.path.join(BASE, "cheer_detector_rf.pkl")
DB = os.path.join(BASE, "app.db")

def check_model():
    print("MODEL_PATH:", MODEL)
    print("exists:", os.path.exists(MODEL))
    try:
        size = os.path.getsize(MODEL)
    except Exception as e:
        size = None
    print("size_bytes:", size)
    try:
        with open(MODEL, "r", encoding="utf-8", errors="ignore") as f:
            head = f.read(256)
        print("header_preview:", repr(head[:200]))
    except Exception as e:
        print("header_preview: <binary or unreadable>")

def check_db():
    print("DB_PATH:", DB)
    print("exists:", os.path.exists(DB))
    if not os.path.exists(DB):
        return
    try:
        con = sqlite3.connect(DB)
        cur = con.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cur.fetchall()]
        print("tables:", tables)
        # Show users count if table present
        if 'users' in tables:
            row = con.execute("SELECT count(1) FROM users").fetchone()
            print("users_count:", row[0] if row else 0)
        con.close()
    except Exception as e:
        print("db_error:", str(e))

if __name__ == '__main__':
    check_model()
    check_db()
