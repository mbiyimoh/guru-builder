'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus } from 'lucide-react'

export function FeedbackButton() {
  const router = useRouter()

  return (
    <Button
      onClick={() => router.push('/feedback')}
      className="fixed bottom-6 left-6 z-50 rounded-full shadow-lg h-12 w-12 p-0"
      size="icon"
      title="Send Feedback"
    >
      <MessageSquarePlus className="h-5 w-5" />
    </Button>
  )
}
