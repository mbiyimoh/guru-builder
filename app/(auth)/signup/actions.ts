'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isEmailWhitelisted } from '@/lib/auth'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Check whitelist BEFORE calling Supabase
  if (!isEmailWhitelisted(email)) {
    redirect('/signup?error=' + encodeURIComponent('This email is not authorized to create an account. Contact an administrator for access.'))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Since we're not doing email verification, user is immediately active
      data: {
        email_confirmed: true,
      },
    },
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/projects')
}
