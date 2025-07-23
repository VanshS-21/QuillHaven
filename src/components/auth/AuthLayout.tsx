import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {title}{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QuillHaven
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>

        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  )
}

export const clerkAppearance = {
  elements: {
    rootBox: 'mx-auto',
    card: 'bg-white dark:bg-slate-800 shadow-xl border-0 rounded-xl',
    headerTitle: 'text-slate-900 dark:text-slate-100',
    headerSubtitle: 'text-slate-600 dark:text-slate-300',
    socialButtonsBlockButton:
      'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
    socialButtonsBlockButtonText: 'text-slate-700 dark:text-slate-300',
    formButtonPrimary:
      'bg-blue-600 hover:bg-blue-700 text-white transition-colors',
    formFieldInput:
      'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-blue-500',
    formFieldLabel: 'text-slate-700 dark:text-slate-300',
    identityPreviewText: 'text-slate-600 dark:text-slate-400',
    identityPreviewEditButton:
      'text-blue-600 hover:text-blue-700 transition-colors',
    footerActionText: 'text-slate-600 dark:text-slate-400',
    footerActionLink: 'text-blue-600 hover:text-blue-700 transition-colors',
    dividerLine: 'bg-slate-200 dark:bg-slate-700',
    dividerText: 'text-slate-500 dark:text-slate-400',
    formFieldErrorText: 'text-red-600 dark:text-red-400',
    formFieldSuccessText: 'text-green-600 dark:text-green-400',
    formFieldWarningText: 'text-yellow-600 dark:text-yellow-400',
    alertText: 'text-slate-700 dark:text-slate-300',
    formResendCodeLink: 'text-blue-600 hover:text-blue-700 transition-colors',
    otpCodeFieldInput:
      'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-blue-500',
  },
}
