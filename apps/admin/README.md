# PayloadX Admin

Standalone React app for platform analytics (users, live sessions, load, traffic, CTR, section events).

## Run

```bash
# from repo root
npm install
npm run admin
```

App opens at [http://localhost:5174](http://localhost:5174).

## Access

1. Sign in with Google using **sundansharma600@gmail.com**, or email/password for that account.
2. That email is built-in as platform admin (also set via backend `ADMIN_EMAILS`).
3. Optionally point API base URL at local (`http://localhost:3001`) or cloud.

For Google sign-in on localhost, add `http://localhost:5174` under **Authorized JavaScript origins** for the OAuth client in Google Cloud Console.

## API

Uses backend routes:

- `GET /api/admin/overview`
- `GET /api/admin/live`
- `GET /api/admin/users`
- `POST /api/analytics/events` (ingested from desktop clients)
