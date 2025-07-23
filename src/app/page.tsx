import { SignedIn, SignedOut } from '@clerk/nextjs'
import Link from 'next/link'
import { AuthHeader } from '@/components/auth/AuthHeader'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <AuthHeader />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold text-slate-900 dark:text-slate-100">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QuillHaven
            </span>
          </h1>
          <p className="mb-8 text-xl leading-relaxed text-slate-600 dark:text-slate-300">
            AI-powered writing platform designed for long-form, chapter-based
            storytelling. Create compelling, coherent narratives with advanced
            context-aware AI assistance.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Chapter-Based Organization
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Organize your stories with intuitive chapter-based project
                management designed for long-form narratives.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Context-Aware AI
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Advanced AI that maintains narrative coherence across your
                entire novel, understanding characters and plot.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Secure & Private
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Your creative work is protected with enterprise-grade security
                and privacy compliance.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <SignedOut>
              <div className="space-x-4">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Sign In
                </Link>
              </div>
            </SignedOut>

            <SignedIn>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
            </SignedIn>

            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Building the core infrastructure for your writing journey
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
