# Google OAuth — One-Time Setup

This is required once per environment (dev, staging, prod). After this you'll
have a Google OAuth client ID + secret to drop into your `.env`.

## Steps

1. Go to https://console.cloud.google.com/.
2. Top-left, pick or create a project. Name it e.g. "shoplit-dev".
3. Left nav → **APIs & Services → OAuth consent screen**.
   - User type: **External** (so any Google account can sign in during dev).
   - App name: `shoplit (dev)` (use `shoplit` for prod).
   - User support email: yours.
   - Developer contact email: yours.
   - Scopes — add only: `openid`, `userinfo.email`, `userinfo.profile`.
   - Test users (dev only): add your own Google email so you can sign in
     before publishing.
   - Save.
4. Left nav → **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `shoplit-dev`.
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:8080/api/v1/auth/google/callback`
   - Click **Create**.
5. Copy the **Client ID** and **Client secret** into your local `.env`:

```bash
GOOGLE_OAUTH_CLIENT_ID=<paste here>
GOOGLE_OAUTH_CLIENT_SECRET=<paste here>
```

6. Generate a session secret:

```bash
openssl rand -hex 32
# paste into .env as SHOPLIT_SESSION_SECRET
```

7. Restart `make up`. Visit http://localhost:3000/login → "Continue with Google".

## Prod / staging differences

- Use a separate OAuth client per environment (so dev creds can't be used against prod).
- Add the prod redirect URI: `https://api.shoplit.app/api/v1/auth/google/callback`.
- Publish the OAuth consent screen (otherwise only test users can sign in).
- Set a strong session secret per environment.
