# QuillHaven Technical Stack

## Core Technologies
- **Frontend**: Next.js 15+ with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for session management and performance
- **AI Integration**: Google Gemini AI for content generation
- **Editor**: Monaco Editor for chapter editing interface
- **Authentication**: JWT-based authentication system

## Development Tools
- **Code Quality**: ESLint, Prettier, Husky for pre-commit hooks
- **Containerization**: Docker for local development environment
- **Testing**: Jest, React Testing Library, end-to-end testing
- **Version Control**: Git with conventional commit standards

## Key Libraries & Frameworks
- **UI Components**: Custom components with Tailwind CSS
- **Form Handling**: React Hook Form with validation
- **State Management**: React Context API and custom hooks
- **File Processing**: Libraries for DOCX, PDF, EPUB export generation
- **Email**: Email service integration for authentication flows

## Common Commands

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start Docker containers (PostgreSQL, Redis)
docker-compose up -d

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### Testing
```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Database Operations
```bash
# Reset database
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio

# Seed database with test data
npm run db:seed
```

## Performance Requirements
- Chapter generation: Complete within 60 seconds for 5,000-word chapters
- Page load times: All pages load within 3 seconds
- Auto-save: Content saves every 30 seconds during editing
- Concurrent users: Support minimum 1,000 concurrent users