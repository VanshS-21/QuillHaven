import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { AuthHeader } from '@/components/auth/AuthHeader'

export default function DashboardPage() {
  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <AuthHeader />

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8">
                <h2 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Welcome to your Dashboard
                </h2>
                <p className="text-slate-600 dark:text-slate-300">
                  Your AI-powered writing workspace is ready. Start creating
                  your next masterpiece.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="mb-8 grid gap-6 md:grid-cols-3">
                <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    New Project
                  </h3>
                  <p className="mb-4 text-slate-600 dark:text-slate-300">
                    Start a new writing project with AI assistance
                  </p>
                  <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
                    Create Project
                  </button>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
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
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    My Projects
                  </h3>
                  <p className="mb-4 text-slate-600 dark:text-slate-300">
                    View and manage your existing projects
                  </p>
                  <button className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700">
                    View Projects
                  </button>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
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
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Analytics
                  </h3>
                  <p className="mb-4 text-slate-600 dark:text-slate-300">
                    Track your writing progress and insights
                  </p>
                  <button className="w-full rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700">
                    View Analytics
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
                <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Recent Activity
                </h3>
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                    <svg
                      className="h-8 w-8 text-slate-400"
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
                  <p className="text-slate-600 dark:text-slate-300">
                    No recent activity. Start by creating your first project!
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
