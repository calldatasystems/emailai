# Database Setup

## Overview

This project uses PostgreSQL with separate databases for development and production:

- **Development**: `emailai_dev` on port 5433
- **Production**: `emailai` on port 5432

## Development Database

### Starting the Dev Database

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL on port 5433 (database: `emailai_dev`)
- Redis on port 6381
- Redis HTTP proxy on port 8080

### Stopping the Dev Database

```bash
docker compose -f docker-compose.dev.yml down
```

### Viewing Dev Database Logs

```bash
docker compose -f docker-compose.dev.yml logs -f db-dev
```

### Connecting to Dev Database

```bash
psql postgresql://postgres:password@localhost:5433/emailai_dev
```

Or using Docker:

```bash
docker exec -it email-ai-dev psql -U postgres -d emailai_dev
```

### Running Migrations on Dev Database

Make sure your `.env.local` points to the dev database, then:

```bash
pnpm db:migrate
```

## Production Database

### Starting the Production Database

```bash
docker compose up -d
```

This starts the production database on port 5432.

### Connecting to Production Database

```bash
psql postgresql://postgres:password@localhost:5432/emailai
```

## Database Management

### Reset Dev Database

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
```

### View All Running Databases

```bash
docker ps | grep postgres
```

### Backup Database

```bash
docker exec email-ai-dev pg_dump -U postgres emailai_dev > backup.sql
```

### Restore Database

```bash
docker exec -i email-ai-dev psql -U postgres emailai_dev < backup.sql
```

## Configuration

The `.env.local` file is configured to use the dev database by default:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5433/emailai_dev?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5433/emailai_dev?schema=public"
```

To use the production database, change the port from `5433` to `5432` and database name from `emailai_dev` to `emailai`.
