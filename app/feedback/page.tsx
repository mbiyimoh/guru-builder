import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { FeedbackPageContent } from './FeedbackPageContent'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <FeedbackPageContent userId={user.id} />
}
