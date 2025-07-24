import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { SecuritySettings } from '@/components/security/SecuritySettings'

export default function SecurityPage() {
  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <AuthHeader />

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Security Settings
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  Manage your account security, two-factor authentication, and
                  active sessions
                </p>
              </div>

              <SecuritySettings />
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
