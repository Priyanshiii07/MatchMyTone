# MatchMyTone MongoDB setup (Windows)

MongoDB is now the only database used by MatchMyTone. The Flask API uses the database name `matchmytone` and can switch from local MongoDB to Atlas by changing `MONGODB_URI` only.

## 1. Check whether MongoDB Server is installed

Compass is only a GUI; it does not prove that the MongoDB Community Server is installed.

```powershell
Get-Command mongod -ErrorAction SilentlyContinue
Get-Command mongosh -ErrorAction SilentlyContinue
Get-Service -Name MongoDB,MongoDBServer -ErrorAction SilentlyContinue
Test-Path 'C:\Program Files\MongoDB\Server'
```

If `mongod` and the service are missing, install Community Server. In an Administrator PowerShell:

```powershell
winget search MongoDB
winget install --id MongoDB.Server -e
```

If that package ID is not available, download **MongoDB Community Server for Windows MSI** from mongodb.com, choose the Complete installation, and enable **Install MongoD as a Service**.

Close and reopen VS Code after installation, then verify:

```powershell
Get-Command mongod
Get-Command mongosh
Get-Service MongoDB
```

## 2. Start MongoDB locally

```powershell
Start-Service MongoDB
Get-Service MongoDB
mongosh 'mongodb://127.0.0.1:27017/matchmytone' --eval 'db.runCommand({ ping: 1 })'
```

If `mongosh` is not installed, the repository's Python check is equivalent:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe test_connection.py
```

If no service was installed, start the server using its actual installed path. Find it with:

```powershell
Get-ChildItem 'C:\Program Files\MongoDB\Server' -Filter mongod.exe -Recurse
```

Then run the returned path in a separate terminal:

```powershell
& 'C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe' --dbpath 'C:\data\db'
```

## 3. Connect MongoDB Compass

Open Compass and use:

```text
mongodb://127.0.0.1:27017
```

The `matchmytone` database appears after the first successful insert. The backend initialization script also creates the collections and indexes.

## 4. Configure the backend

From the repository root:

```powershell
Copy-Item backend\.env.example backend\.env -Force
notepad backend\.env
```

For local MongoDB, use:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/matchmytone
MONGODB_DB=matchmytone
SECRET_KEY=use-a-long-random-value
JWT_SECRET_KEY=use-a-different-long-random-value
REQUIRE_EMAIL_VERIFICATION=false
BACKEND_URL=http://127.0.0.1:5000
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.8-flash
OPENAI_API_KEY=optional-fallback-key
RESEND_API_KEY=optional-for-email
```

See `backend/.env.example` for every setting and its default. Color Analysis reads the AI keys from this backend `.env` file. After changing `.env`, stop and restart `python app.py`, because settings are only read at startup. Do not put it in `web/.env.local` or any `NEXT_PUBLIC_*` variable. If it is blank, the API correctly returns a configuration error instead of fabricating a result. Never paste credentials into chat or commit `backend/.env`.

## 5. Install dependencies and initialize the database

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt   # runtime dependencies plus pytest
python test_connection.py
python init_db.py
python verify_mongo.py
```

The initialization is safe to repeat and never drops collections or user documents. `verify_mongo.py` checks the connection, required collections, and named indexes without modifying data.
The equivalent `mongosh` scripts are [backend/scripts/init_mongo.js](./backend/scripts/init_mongo.js) and [backend/scripts/verify_mongo.js](./backend/scripts/verify_mongo.js).

## Collections and indexes

The backend initializes these collections in the `matchmytone` database:

| Collection | Purpose and key fields | Indexes |
| --- | --- | --- |
| `users` | `id`, normalized `email`, `name`, `password_hash`, `is_verified`, timestamps | Unique `email`, unique `name`, sparse unique `phone` |
| `user_profiles` | One document per `user_id`; phone, gender, date of birth, age, timestamps | Unique `user_id` |
| `color_analysis_results` | User-owned season, undertone, colors, provider/model, `request_id`, timestamps (the selfie itself is not stored) | `user_id` + `created_at` descending; unique `user_id` + `request_id` |
| `skincare_analysis_results` | User-owned answers and skincare result, timestamps | `user_id` + `created_at` descending; unique `user_id` + `request_id` |
| `face_analysis_results` | User-owned questionnaire answers and face result, timestamps | `user_id` + `created_at` descending; unique `user_id` + `request_id` |
| `body_analysis_results` | User-owned questionnaire answers and body result, timestamps | `user_id` + `created_at` descending; unique `user_id` + `request_id` |
| `email_verification_tokens` | Hashed token, `user_id`, email, `used`, `expires_at` | Unique token hash and TTL expiry |
| `password_reset_tokens` | Hashed token, `user_id`, `used`, `expires_at` | Unique token hash and TTL expiry |

Analysis queries always include the authenticated user's `user_id`, so one account cannot read another account's history.

Any legacy collections left by the earlier migration (`skincare_results`, `email_verifications`, or `password_resets`) are intentionally not dropped. They are not used by the active backend; leaving them in place preserves any existing documents until you explicitly approve a data migration or cleanup.

## 6. Start the backend and frontend

In PowerShell terminal 1:

```powershell
Set-Location backend
.\.venv\Scripts\Activate.ps1
python app.py
```

In PowerShell terminal 2:

```powershell
Set-Location web
npm install
$env:MATCHMYTONE_API_BASE_URL='http://127.0.0.1:5000/api'
npm run dev
```

Open `http://localhost:3000`. The API health check is `http://127.0.0.1:5000/api/health`.

## 7. Test registration, login, and MongoDB persistence

Automated tests (no backend needs to be running). They use a separate `matchmytone_test` database that is dropped afterwards, and they never call real AI providers:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q
```

Live smoke test against a running backend (requires `pip install requests`; it creates test accounts in the configured database):

```powershell
Set-Location backend
.\.venv\Scripts\Activate.ps1
python smoke_auth.py
```

The smoke test verifies registration, duplicate rejection, hashed-password behavior, valid and invalid login, profile retrieval/editing, saved results, and unauthenticated access rejection.

In Compass, refresh `matchmytone` and inspect:

- `users`: account identity and `password_hash` (never a plaintext password)
- `user_profiles`: editable profile fields
- `skincare_analysis_results`, `body_analysis_results`, `face_analysis_results`, `color_analysis_results`: user-owned analysis history
- `email_verification_tokens` and `password_reset_tokens`: short-lived auth records when those flows are used

## 8. Atlas later

Create an Atlas database named `matchmytone`, allow the backend IP, create a least-privilege database user, and replace only this local setting:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/?retryWrites=true&w=majority
MONGODB_DB=matchmytone
```

Do not change application code or collection names. Use a separate Atlas user for production and keep the URI in the hosting provider's environment settings.
