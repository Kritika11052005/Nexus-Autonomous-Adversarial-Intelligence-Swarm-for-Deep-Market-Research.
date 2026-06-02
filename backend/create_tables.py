import subprocess
import sys

def init_db():
    print("[INIT] Connecting to Neon Cloud Postgres via Prisma ORM...")
    try:
        # Run db push programmatically to synchronize schemas
        subprocess.run(["python", "-m", "prisma", "db", "push", "--accept-data-loss"], check=True)
        print("[INIT] Tables created and synchronized successfully via Prisma!")
    except Exception as e:
        print(f"[INIT] Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    init_db()
