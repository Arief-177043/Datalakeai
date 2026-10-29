# DataLake AI — Full-stack starter (No Docker)

A React + TypeScript data lake dashboard with a Node.js/Express API, PostgreSQL persistence for user accounts and dataset CRUD, and email/password authentication.

> **Docker is not required or used.** Install and run PostgreSQL directly on your computer, or use a hosted PostgreSQL provider.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL 15+
- Auth: bcrypt password hashing, signed JWT access tokens, protected API routes
- API protections: Helmet security headers, CORS allowlist, request body limits, authentication rate limiting, Zod input validation, parameterized SQL

## Requirements

- Node.js 20+ and npm
- PostgreSQL 15+ installed locally (Docker is not needed)

## 1. Install and configure PostgreSQL locally

1. Install PostgreSQL from the official installer: https://www.postgresql.org/download/
2. During setup, remember the password you set for the PostgreSQL administrator user (commonly `postgres`). Ensure the PostgreSQL service is running.
3. Create a database named `datalake_ai` using pgAdmin or the `psql` command line.

Using `psql` on Windows, macOS, or Linux (adjust the executable path if PostgreSQL is not on PATH):

```sql
CREATE DATABASE datalake_ai;
```

Run that SQL while connected as the PostgreSQL administrator, for example:

```bash
psql -U postgres -d postgres
```

Then apply the project schema from the repository root:

```bash
psql -U postgres -d datalake_ai -f server/sql/schema.sql
```

If you prefer pgAdmin, select the `datalake_ai` database, open **Query Tool**, load `server/sql/schema.sql`, and execute it.

## 2. Configure and start the backend

```bash
cd server
```

Copy `server/.env.example` to `server/.env` (Windows PowerShell: `Copy-Item .env.example .env`; macOS/Linux: `cp .env.example .env`). Edit `server/.env` and set `DATABASE_URL` to match your local PostgreSQL username, password, host, and database. Example:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/datalake_ai
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN=8h
CLIENT_ORIGIN=http://localhost:5173
```

Replace the password and JWT secret with your own values. URL-encode special characters in the database password if needed. Keep `.env` private and never commit it.

Install backend dependencies and start the API:

```bash
npm install
npm run dev
```

The API runs at `http://localhost:4000`. Health check: `http://localhost:4000/api/health`.

## 3. Start the frontend

Open a second terminal at the repository root (the folder containing the root `package.json`). Copy `.env.example` to `.env` if needed, then run:

```bash
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173`. The frontend API base defaults to `http://localhost:4000/api`; configure `VITE_API_URL` in the root `.env` if the backend runs elsewhere. Restart Vite after environment changes.

## Authentication flow

1. Open the frontend and choose **Create an account**.
2. Register with your name, email, and a password of at least 8 characters.
3. Sign in with those credentials. Passwords are hashed with bcrypt before storage.
4. The frontend stores the short-lived JWT in local storage and sends it as a Bearer token for protected requests. Use **Sign Out** in the profile menu to clear the local session.

There is no seeded/default account. Create an account through the registration screen.

## API endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | No | API/database health check |
| POST | `/api/auth/register` | No | Create an account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/auth/me` | Bearer token | Current session claims |
| GET | `/api/datasets` | Bearer token | List datasets owned by current user |
| GET | `/api/datasets/:id` | Bearer token | Read one owned dataset |
| POST | `/api/datasets` | Bearer token | Create dataset |
| PATCH | `/api/datasets/:id` | Bearer token | Update an owned dataset |
| DELETE | `/api/datasets/:id` | Bearer token | Delete an owned dataset |

## Current persistence scope

- **PostgreSQL:** users and datasets (CRUD, owner-scoped access).
- **Original frontend mock state:** ingestion, processing, quality reports, versions, lineage, storage explorer, jobs, monitoring, access-control demo data, and settings. Those screens remain demonstration data and are not persisted by the backend yet.

## Production notes

Before production deployment, use HTTPS, a managed PostgreSQL service or properly secured database host, a strong secret manager-provided JWT secret, backups, schema migrations, and appropriate monitoring. JWT localStorage is a starter approach; consider secure HttpOnly cookies and CSRF protections for higher-security deployments.
