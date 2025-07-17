# QuillHaven Project Structure

## Current Repository Organization

### Documentation & Planning
- **`Docs/`**: Product requirements, research reports, user personas
  - `QuillHaven_PRD.md`: Complete product requirements document
  - `*.pdf`: Research reports and MVP definitions
- **`Flows/`**: System flow diagrams and user journey maps
  - `*.png`: Visual flow diagrams for key user interactions
  - `Flows.txt`: Detailed flow descriptions in text format
- **`WireFrames/`**: UI mockups and interface designs
  - Interface designs for all major screens and components

### Project Configuration
- **`.kiro/`**: Kiro IDE configuration and project specs
  - `specs/quillhaven-platform/`: Implementation specifications and task breakdown
  - `steering/`: AI assistant guidance documents (this folder)

## Planned Application Structure

Based on the implementation tasks, the codebase will follow this structure:

### Frontend Structure
```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── project/         # Project management components
│   ├── chapter/         # Chapter editing and generation
│   ├── context/         # Context management interfaces
│   └── common/          # Shared UI components
├── pages/               # Next.js pages and API routes
│   ├── api/             # Backend API endpoints
│   ├── auth/            # Authentication pages
│   ├── dashboard/       # User dashboard
│   └── project/         # Project-specific pages
├── hooks/               # Custom React hooks
├── services/            # API service layers
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
└── styles/              # Global styles and Tailwind config
```

### Backend Structure
```
src/
├── lib/                 # Core business logic
│   ├── auth/            # Authentication services
│   ├── ai/              # Gemini AI integration
│   ├── export/          # File export services
│   └── context/         # Context management logic
├── prisma/              # Database schema and migrations
│   ├── schema.prisma    # Database schema definition
│   ├── migrations/      # Database migration files
│   └── seed.ts          # Database seeding scripts
└── middleware/          # Express/Next.js middleware
```

## Key Architectural Patterns

### Component Organization
- **Atomic Design**: Components organized by complexity (atoms, molecules, organisms)
- **Feature-Based**: Group related components by feature area
- **Shared Components**: Common UI elements in dedicated folder

### API Structure
- **RESTful Endpoints**: Standard REST patterns for CRUD operations
- **Route Protection**: Authentication middleware for protected routes
- **Error Handling**: Consistent error response format across all endpoints

### Database Design
- **Relational Structure**: PostgreSQL with proper foreign key relationships
- **Context Separation**: Separate tables for characters, plots, world-building
- **Version Control**: Chapter history tracking with timestamps

### State Management
- **Context API**: Global state for authentication and user data
- **Local State**: Component-level state for UI interactions
- **Server State**: React Query/SWR for API data caching

## Development Workflow

### File Naming Conventions
- **Components**: PascalCase (e.g., `ChapterEditor.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useChapterGeneration.ts`)
- **Services**: camelCase (e.g., `aiService.ts`)
- **Types**: PascalCase with descriptive names (e.g., `ProjectTypes.ts`)

### Import Organization
1. External libraries (React, Next.js, etc.)
2. Internal services and utilities
3. Component imports
4. Type imports
5. Relative imports (./components, ../utils)

### Code Organization Principles
- **Single Responsibility**: Each file/function has one clear purpose
- **Separation of Concerns**: Business logic separate from UI components
- **Reusability**: Common functionality extracted into shared utilities
- **Type Safety**: Comprehensive TypeScript coverage throughout