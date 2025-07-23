# QuillHaven

QuillHaven is an AI-powered writing platform designed specifically for long-form, chapter-based storytelling. It helps fiction writers create compelling, coherent long-form narratives by providing advanced context-aware AI assistance.

## Tech Stack

- **Framework**: Next.js 14.x with TypeScript 5.4+
- **Database**: PostgreSQL 15.x with Prisma ORM v5.x (coming soon)
- **AI Services**: Gemini API (primary), Claude API (backup) (coming soon)
- **Hosting**: Vercel (application), Supabase (database) (coming soon)
- **Styling**: TailwindCSS 4.0.x with Radix UI components

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/quillhaven.git
   cd quillhaven
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your specific configuration.

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Development Workflow

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
quillhaven/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   └── ui/           # UI components
│   └── lib/              # Utility functions
├── public/               # Static assets
└── ...config files
```

## Features (Coming Soon)

- Chapter-based project organization
- Context-aware AI assistance
- Character and plot consistency tracking
- Real-time collaboration
- Version history and backups

## License

This project is proprietary and confidential.

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com).
