import { SignUp } from '@clerk/nextjs'
import { AuthLayout, clerkAppearance } from '@/components/auth/AuthLayout'

export default function SignUpPage() {
  return (
    <AuthLayout title="Join" subtitle="Start your AI-powered writing journey">
      <SignUp appearance={clerkAppearance} />
    </AuthLayout>
  )
}
