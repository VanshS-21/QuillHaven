# Database Schema Documentation

## Overview

This directory contains the Prisma ORM configuration for QuillHaven, including the database schema, migrations, and seeding scripts.

## Schema Structure

### Core Models

#### User

- Authentication and account management
- Subscription tiers (FREE, PREMIUM, PROFESSIONAL)
- Writing preferences stored as JSON
- Email verification and password reset functionality

#### Project

- Writing projects with metadata (title, genre, target length)
- Status tracking (DRAFT, IN_PROGRESS, COMPLETED)
- Word count tracking
- Relationships to all project-related entities

#### Chapter

- Individual chapters with content and metadata
- Ordering system for chapter sequence
- Status tracking (DRAFT, GENERATED, EDITED, FINAL)
- Generation parameters stored as JSON
- Version history support

### Context Management Models

#### Character

- Character database with roles (PROTAGONIST, ANTAGONIST, SUPPORTING, MINOR)
- Development arcs and first appearance tracking
- Relationship management between characters

#### PlotThread

- Plot thread tracking with status progression
- Character associations via many-to-many relationship
- Status tracking (INTRODUCED, DEVELOPING, CLIMAX, RESOLVED)

#### WorldElement

- World-building elements (LOCATION, RULE, CULTURE, HISTORY)
- Interconnected relationships between elements
- Significance tracking for narrative importance

#### TimelineEvent

- Chronological event tracking
- Flexible date format for fictional timelines
- Importance scaling (1-5)

### Supporting Models

#### ChapterVersion

- Version history for chapters
- Content snapshots with word counts
- Automatic version numbering

#### Relationship

- Character relationship mapping
- Flexible relationship types
- Bidirectional relationship support

#### Export

- Export history tracking
- Multiple format support (DOCX, PDF, TXT, EPUB)
- Status tracking and expiration management

#### Session

- JWT token management
- Automatic cleanup of expired sessions

## Database Commands

### Development Setup

```bash
# Start database containers
docker-compose up -d

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Reset database (careful!)
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Migration Management

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Seeded Data

The seed script creates:

- 2 test users with different subscription tiers
- 2 sample projects (fantasy and sci-fi)
- Complete character database with relationships
- Plot threads and world-building elements
- Sample chapters with version history
- Timeline events and export records

### Test Accounts

- `test@quillhaven.com` (Premium tier)
- `premium@quillhaven.com` (Professional tier)
- Password for both: `password123`

## Database Configuration

### Environment Variables

```env
DATABASE_URL="postgresql://quillhaven:quillhaven_dev_password@localhost:5432/quillhaven"
```

### Docker Configuration

- PostgreSQL 15 Alpine
- Port: 5432
- Database: quillhaven
- User: quillhaven
- Password: quillhaven_dev_password

## Schema Features

### Data Integrity

- Foreign key constraints with CASCADE deletion
- Unique constraints on critical relationships
- Proper indexing for performance

### Flexibility

- JSON fields for complex data structures
- Flexible relationship modeling
- Extensible enum types

### Performance

- Optimized indexes on frequently queried fields
- Efficient relationship modeling
- Proper data types for content storage

## Security Considerations

- Password hashing with bcrypt
- Session token management
- Secure user data handling
- Proper access control through relationships

## Future Enhancements

- Database connection pooling
- Read replicas for scaling
- Automated backup strategies
- Performance monitoring
- Data archiving policies
