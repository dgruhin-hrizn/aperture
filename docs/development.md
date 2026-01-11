# Development Guide

This guide covers local development setup, available scripts, and contribution guidelines.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Clone and Install](#1-clone-and-install)
  - [Start the Database](#2-start-the-database)
  - [Configure Environment](#3-configure-environment)
  - [Run Migrations](#4-run-migrations)
  - [Start Development Servers](#5-start-development-servers)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Creating Migrations](#creating-migrations)
- [Building for Production](#building-for-production)
- [Docker Development](#docker-development)
- [Testing with External Access](#testing-with-external-access)
- [Code Style](#code-style)

---

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose
- An Emby or Jellyfin server (for testing)
- OpenAI API key

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/dgruhin-hrizn/aperture.git
cd aperture
pnpm install
```

### 2. Start the Database

```bash
docker compose up -d db
```

This starts a PostgreSQL container with pgvector extension.

### 3. Configure Environment

Set the database URL environment variable:

```bash
export DATABASE_URL=postgres://app:app@localhost:5432/aperture
```

Or add it to your shell profile (e.g., `~/.zshrc` or `~/.bashrc`).

> **Note**: All other configuration (OpenAI, Media Server, paths, etc.) is done via the Setup Wizard on first launch. Settings are stored in the database.

### 4. Run Migrations

```bash
pnpm db:migrate
```

### 5. Start Development Servers

```bash
pnpm dev
```

This starts:

- API server at http://localhost:3456
- Web dev server at http://localhost:3457 (with proxy to API)

---

## Available Scripts

| Script             | Description                       |
| ------------------ | --------------------------------- |
| `pnpm dev`         | Start API and web dev servers     |
| `pnpm dev:api`     | Start only the API server         |
| `pnpm dev:web`     | Start only the web dev server     |
| `pnpm build`       | Build all packages                |
| `pnpm typecheck`   | Type check all packages           |
| `pnpm lint`        | Lint all packages                 |
| `pnpm db:migrate`  | Run database migrations           |
| `pnpm docker:up`   | Start Docker stack                |
| `pnpm docker:down` | Stop Docker stack                 |
| `pnpm docker:db`   | Start only the database container |

---

## Project Structure

```
aperture/
├── apps/
│   ├── api/              # Fastify API server
│   │   └── src/
│   │       ├── routes/   # API route handlers
│   │       ├── lib/      # Utilities (logger, scheduler)
│   │       └── index.ts  # Server entry point
│   └── web/              # React frontend
│       └── src/
│           ├── pages/    # Page components
│           ├── components/ # Shared components
│           └── hooks/    # React hooks
├── packages/
│   ├── core/             # Shared business logic
│   │   └── src/
│   │       ├── recommender/ # Recommendation engine
│   │       ├── media/    # Media server providers
│   │       ├── trakt/    # Trakt.tv integration
│   │       └── jobs/     # Job scheduling
│   └── ui/               # Shared UI components
├── db/
│   └── migrations/       # SQL migration files
└── docker/               # Docker configuration
```

---

## Creating Migrations

Migrations are plain SQL files in `db/migrations/`. Name them with a sequential number:

```bash
# Example: 0055_my_new_feature.sql
```

Run migrations:

```bash
pnpm db:migrate
```

---

## Building for Production

```bash
# Build all packages
pnpm build

# Or build specific packages
pnpm --filter @aperture/core build
pnpm --filter @aperture/api build
pnpm --filter @aperture/web build
```

---

## Docker Development

### Build from Source

```bash
docker compose up -d --build
```

### Using Pre-built Image

```bash
docker compose up -d
```

### View Logs

```bash
docker compose logs -f app
```

---

## Testing with External Access

For testing OAuth flows (like Trakt) that require external callbacks:

### 1. Configure Vite for Network Access

The web dev server is configured to accept external connections. Update `apps/web/vite.config.ts` if needed:

```typescript
server: {
  host: true,
  allowedHosts: ['your-domain.com']
}
```

### 2. Configure CORS

Set `APP_BASE_URL` in your `docker-compose.yml` or as an environment variable:

```bash
APP_BASE_URL=https://your-domain.com
```

### 3. Set Up Reverse Proxy

If using Nginx Proxy Manager or similar:

- Proxy `/api/*` requests to `localhost:3456`
- Proxy all other requests to `localhost:3457`

---

## Code Style

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting
- Conventional commits recommended
