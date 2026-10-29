"""Initialize MongoDB collections and indexes safely and repeatedly."""

from models import db, initialize_database, ping


if __name__ == "__main__":
    ping()
    initialize_database()
    print(f"MongoDB connection OK: {db.name}")
    print("Collections/indexes initialized without deleting existing data.")
