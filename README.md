# Iron Log

Self-hosted workout and body tracker for you and your friends. It's a mobile-first web app you can install on your phone's home screen, with a Python API behind it.

- **Log workouts set by set**: weight × reps, last session shown next to every set, one-tap "same as last time", rest timer with sound/vibration, automatic PR detection (estimated 1RM).
- **Routines**: build your own or start from a template (PPL 6-day, Upper/Lower 4-day, Full Body 3-day). Each exercise can have an alternative you can swap to mid-workout. Weekly schedule picks the day's routine automatically.
- **Exercise library**: 876 exercises with start/finish photos that play as a loop, step-by-step instructions, muscles and equipment. Search understands gym slang ("pec deck", "RDL", "OHP"). Add custom exercises.
- **Body tracking**: daily weight, calories, protein, steps, cardio, sleep, waist, body fat. Shows the 7-day average against a straight-line target from start weight to goal weight.
- **Progress**: weight chart vs target, weekly check (on track / behind), strength chart per lift, history with volume and PRs.
- **Works with bad gym signal**: edits are saved on the phone first and synced when you're back online.
- **Multi-user**: first account is admin. Sign-up modes: invite code / open / closed. The admin can create invite codes, reset passwords and manage users.
- **Your data**: export everything as JSON and import it on any Iron Log server (merge or replace).

## Stack

| Part | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | SQLite (default) or PostgreSQL (Supabase, Neon, self-hosted). Same code for both. |
| Frontend | React 18, TypeScript, Vite, TanStack Query, React Router. Installable PWA. |
| Deploy | One Docker image (API serves the built frontend) + Caddy/nginx for HTTPS |

## Repository layout

```
iron-log/
├── backend/
│   ├── app/
│   │   ├── main.py              # app factory, middleware (CSRF, security headers), SPA serving
│   │   ├── core/                # config (env vars), password hashing/tokens, rate limiting
│   │   ├── db/                  # SQLAlchemy base, engine/session per request, migration runner
│   │   ├── models/              # ORM tables: user, exercise, routine, workout, body
│   │   ├── schemas/             # Pydantic request/response models (camelCase JSON)
│   │   ├── services/            # all database logic: auth, exercises, routines, workouts, body, admin, transfer
│   │   ├── api/routes/          # thin HTTP routers -> services
│   │   └── data/exercises.json  # built-in exercise library (free-exercise-db, public domain)
│   ├── alembic/versions/        # schema migrations
│   ├── scripts/                 # build_exercises.py, fetch_exercise_images.py
│   └── tests/                   # pytest API tests (run on SQLite and Postgres)
├── frontend/
│   ├── src/api/                 # typed API client + React Query hooks
│   ├── src/pages/               # Workout, Body, Progress, History, Routines, Exercises, Account, Admin, Login, Onboarding
│   ├── src/components/          # layout, exercise picker/demo, charts, sheets
│   ├── src/hooks/               # offline-tolerant autosave, rest timer, toasts
│   └── public/                  # PWA manifest, service worker, icons
├── Dockerfile · docker-compose.yml · .env.example
└── .github/workflows/ci.yml     # lint + tests (SQLite & Postgres) + build + docker build
```

### Database schema

```
users ─┬─ auth_sessions          (hashed session tokens, expiry)
       ├─ user_settings          (start/goal weight, dates, calorie/protein/step targets)
       ├─ routines ── routine_exercises ──> exercises (main + optional alternative)
       ├─ schedule_days          (weekday 0–6 -> routine)
       ├─ workouts ── workout_exercises ── workout_sets
       ├─ body_logs              (one row per date)
       └─ exercises (custom)     (owner_id = user; library rows have owner_id NULL)
invites, app_settings            (admin-managed)
```

Deleting a user cascades to all their data. Every query is scoped to the signed-in user.

## Deploy (Docker, recommended)

On your server (any Linux VM with Docker, e.g. an Oracle Cloud free-tier instance):

```bash
git clone https://github.com/<you>/iron-log.git && cd iron-log
cp .env.example .env          # edit it (see below)
docker compose up -d --build
docker compose logs -f        # "Application startup complete"
```

The app listens on `127.0.0.1:8000`. Put HTTPS in front of it. HTTPS is required for "install to home screen" and secure cookies. The simplest option is [Caddy](https://caddyserver.com), which gets certificates automatically:

```
# /etc/caddy/Caddyfile
ironlog.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

Point a DNS A record at the server, open ports 80/443 in the firewall (on Oracle Cloud: the VCN security list **and** `iptables`), then `sudo systemctl reload caddy`.

Open the site and create the first account. **It becomes the admin.** Then go to Account → Admin → Invite a friend.

### Using Supabase (Postgres) instead of SQLite

1. In Supabase: **Project → Connect → Session pooler**, copy the URI.
2. In `.env`: `IRONLOG_DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. `docker compose up -d --build`. Tables are created by the migrations on startup.

The URI is accepted exactly as Supabase shows it. TLS is turned on automatically, and the transaction pooler (port 6543) works too. Keep the password only in `.env`, which is git-ignored.

### Configuration

All settings are environment variables (in `.env`):

| Variable | Default | Meaning |
|---|---|---|
| `IRONLOG_DATABASE_URL` | SQLite in `/data` | Any SQLAlchemy URL, or a plain `postgresql://` URI |
| `IRONLOG_SIGNUP_MODE` | `invite` | `open`, `invite` or `closed`. Admins can change it in the app. |
| `IRONLOG_SESSION_DAYS` | `90` | How long a sign-in lasts |
| `IRONLOG_COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `IRONLOG_TRUST_PROXY` | `false` | Set `true` behind your own reverse proxy (correct client IPs for rate limiting) |
| `IRONLOG_EXERCISE_IMAGE_BASE` | jsDelivr CDN | Where exercise photos load from |
| `IRONLOG_EXERCISE_IMAGE_DIR` | unset | Serve photos from this folder instead (see below) |
| `IRONLOG_AUTO_MIGRATE` | `true` | Run Alembic migrations on startup |

**Self-host the exercise photos** (~120 MB, no CDN needed):

```bash
docker compose exec ironlog python scripts/fetch_exercise_images.py /data/exercise-images
echo "IRONLOG_EXERCISE_IMAGE_DIR=/data/exercise-images" >> .env && docker compose up -d
```

### Backups

- **Each user**: Account → Export JSON (restorable on any Iron Log server).
- **Whole server, SQLite**: `docker compose exec ironlog python -c "import sqlite3;s=sqlite3.connect('/data/ironlog.db');d=sqlite3.connect('/data/backup.db');s.backup(d)"`, then copy `backup.db` out with `docker cp`.
- **Supabase**: use Supabase's own backups.

### Updating

```bash
git pull && docker compose up -d --build   # migrations run automatically
```

## Local development

```bash
# API (http://127.0.0.1:8000, docs at /api/docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# Web app (http://localhost:5173, proxies /api to :8000)
cd frontend
npm install
npm run dev
```

Tests and lint:

```bash
cd backend && ruff check . && pytest
IRONLOG_TEST_DATABASE_URL=postgresql://user:pw@localhost/ironlog_test pytest   # same suite on Postgres
cd frontend && npm run build                                                  # type-check + bundle
```

New migration after changing models:

```bash
cd backend && alembic revision --autogenerate -m "describe change"
```

## API

All endpoints are under `/api/v1` and documented live at `/api/docs`. State-changing requests must send the header `X-Requested-With: IronLog` (CSRF protection). Auth uses an httpOnly session cookie.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/password`, `/auth/delete-account` · `GET /me` · `GET/PUT /me/settings` · `GET /config` |
| Exercises | `GET /exercises` · `POST /exercises` · `PUT/DELETE /exercises/{id}` · `GET /exercises/{id}/history` |
| Routines | `GET/POST /routines` · `PUT/DELETE /routines/{id}` · `POST /routines/reorder` · `GET/PUT /schedule` · `GET /templates` · `POST /templates/{key}/apply` |
| Workouts | `GET /workouts` · `GET/PUT/DELETE /workouts/{date}` · `GET /workouts/context?before=&ids=` |
| Body | `GET /body` · `PUT/DELETE /body/{date}` |
| Data | `GET /export` · `POST /import?mode=merge\|replace` |
| Admin | `GET /admin` · `PUT /admin/signup` · `POST/DELETE /admin/invites` · `POST /admin/users/{id}/reset-password` · `PUT /admin/users/{id}/admin` · `DELETE /admin/users/{id}` |

## Security notes

- Passwords: scrypt with a per-user salt. Sessions: random 256-bit tokens, stored only as SHA-256 hashes.
- Failed sign-in and sign-up attempts are rate-limited per IP (10 per 15 min).
- CSRF: SameSite=Lax cookie + required custom header. Strict Content-Security-Policy, `X-Frame-Options: DENY`.
- Every data query is filtered by the signed-in user. Tests cover cross-user isolation.

## Credits

Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public domain).
Fonts: Barlow, Barlow Condensed, IBM Plex Mono (SIL Open Font License), bundled with the app.

## License

MIT, see [LICENSE](LICENSE).
