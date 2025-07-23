import { SignIn } from '@clerk/nextjs'
import { AuthLayout, clerkAppearance } from '@/components/auth/AuthLayout'

export default function SignInPage() {
  return (
    <AuthLayout
      title="Welcome back to"
      subtitle="Continue your writing journey"
    >
      <SignIn appearance={clerkAppearance} />
    </AuthLayout>
  )
}
