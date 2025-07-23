# Database Migrations

This directory will contain Prisma migration files when using `prisma migrate` instead of `prisma db push`.

## Current Setup

The project is currently using `prisma db push` for development, which directly syncs the schema without creating migration files.

## Migration Commands

```bash
# Create and apply a new migration
npx prisma migrate dev --name migration_name

# Apply pending migrations
npx prisma migrate deploy

# Reset database and apply all migrations
npx prisma migrate reset
```

## Schema Changes

When making schema changes:

1. Update `schema.prisma`
2. Run `npm run db:generate` to update Prisma client
3. Run `npm run db:push` to sync with database (development)
4. Or run `npx prisma migrate dev` to create migration (production)

## Production Deployment

For production deployments, use migrations instead of db push:

```bash
npm run db:migrate  # Applies migrations
npm run db:seed     # Seeds initial data
```
