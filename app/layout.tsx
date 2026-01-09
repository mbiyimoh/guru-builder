import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { getCurrentUser, signOut } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { FeedbackButton } from '@/components/feedback'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Guru Builder',
  description: 'Build AI teaching assistants through autonomous research and structured recommendations',
}

async function handleSignOut() {
  'use server'
  await signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          {/* Navigation */}
          <nav className="relative border-b bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link href="/" className="flex items-center text-xl font-bold">
                    Guru Builder
                  </Link>
                  {user && (
                    <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                      <Link
                        href="/projects"
                        className="inline-flex items-center px-1 pt-1 text-sm font-medium hover:text-muted-foreground"
                      >
                        Projects
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  {user ? (
                    <>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                      <form action={handleSignOut}>
                        <button
                          type="submit"
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                        Sign in
                      </Link>
                      <Link
                        href="/signup"
                        className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
                      >
                        Sign up
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Refined gradient border - subtle but visible */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
          </nav>

          {/* Main content */}
          <main className="flex-1 bg-background">
            {children}
          </main>

          {/* Feedback Button - only show when authenticated */}
          {user && <FeedbackButton />}

          {/* Footer */}
          <footer className="border-t bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Guru Builder - AI Knowledge Corpus Management System
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
