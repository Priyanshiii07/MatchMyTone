from models import db, ping


if __name__ == "__main__":
    ping()
    print(f"MongoDB connection OK: database={db.name}")
