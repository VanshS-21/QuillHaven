# QuillHaven Development Setup

## Prerequisites

1. **Node.js 18+** - Install from [nodejs.org](https://nodejs.org/)
2. **Docker Desktop** - Install from [docker.com](https://www.docker.com/products/docker-desktop/)
3. **Git** - For version control

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Services

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d

# Verify containers are running
docker-compose ps
```

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Available Scripts

### Development

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production version
- `npm run start` - Start production server

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

### Database

- `docker-compose up -d` - Start PostgreSQL and Redis
- `docker-compose down` - Stop containers
- `docker-compose logs postgres` - View PostgreSQL logs
- `docker-compose logs redis` - View Redis logs

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── chapter/        # Chapter management
│   ├── common/         # Shared components
│   ├── context/        # Context management
│   ├── project/        # Project management
│   └── ui/             # Base UI components
├── hooks/              # Custom React hooks
├── lib/                # Core business logic
├── services/           # API and external services
│   ├── ai/            # AI integration
│   ├── api/           # API services
│   ├── auth/          # Authentication
│   ├── export/        # File export
│   └── storage/       # Storage utilities
└── utils/              # Utility functions
    ├── constants/     # Application constants
    ├── formatting/    # Formatting helpers
    ├── helpers/       # General helpers
    ├── types/         # TypeScript types
    └── validation/    # Validation functions
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL="postgresql://quillhaven:quillhaven_dev_password@localhost:5432/quillhaven"

# Redis
REDIS_URL="redis://localhost:6379"

# AI Service (Gemini)
GEMINI_API_KEY="your_gemini_api_key_here"

# Authentication
JWT_SECRET="your_jwt_secret_here"
NEXTAUTH_SECRET="your_nextauth_secret_here"
NEXTAUTH_URL="http://localhost:3000"
```

## Troubleshooting

### Docker Issues

- Ensure Docker Desktop is running
- Check container status: `docker-compose ps`
- View logs: `docker-compose logs [service-name]`
- Reset containers: `docker-compose down && docker-compose up -d`

### Development Issues

- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript: `npm run type-check`
- Fix formatting: `npm run lint:fix && npm run format`
