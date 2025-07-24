import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { SecurityProvider } from '@/components/security/SecurityProvider'
import { getSecurityConfig } from '@/lib/config/security'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'QuillHaven - AI-Powered Writing Platform',
  description:
    'Create compelling, coherent long-form narratives with advanced context-aware AI assistance designed for chapter-based storytelling.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const securityConfig = getSecurityConfig()

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#2563eb',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#1e293b',
        },
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
          footerActionLink:
            'text-blue-600 hover:text-blue-700 transition-colors',
          dividerLine: 'bg-slate-200 dark:bg-slate-700',
          dividerText: 'text-slate-500 dark:text-slate-400',
          formFieldErrorText: 'text-red-600 dark:text-red-400',
          formFieldSuccessText: 'text-green-600 dark:text-green-400',
          formFieldWarningText: 'text-yellow-600 dark:text-yellow-400',
          alertText: 'text-slate-700 dark:text-slate-300',
          formResendCodeLink:
            'text-blue-600 hover:text-blue-700 transition-colors',
          otpCodeFieldInput:
            'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-blue-500',
        },
      }}
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <SecurityProvider securityConfig={securityConfig}>
        <html lang="en">
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            {children}
          </body>
        </html>
      </SecurityProvider>
    </ClerkProvider>
  )
}
