# MatchMyTone web

This is the new Next.js web foundation. The existing Expo mobile application and Flask backend remain outside this directory and are intentionally unchanged.

## Local development

```bash
npm install
copy .env.example .env.local   # Windows
npm run dev
```

Open http://localhost:3000.

`NEXT_PUBLIC_API_BASE_URL` is the only browser-visible configuration in this phase. Gemini credentials must remain server-side and are deliberately not included in this web app yet.

## Production build

```bash
npm run build
npm start
```
