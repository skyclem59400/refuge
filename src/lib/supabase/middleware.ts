import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicPath =
    path.startsWith('/login') ||
    path.startsWith('/auth/callback') ||
    path.startsWith('/api/auth/pseudo') ||
    path.startsWith('/api/public/') ||
    path.startsWith('/api/webhooks/')

  // Chemins accessibles a un user connecte mais SANS profil complet
  const isOnboardingPath =
    path.startsWith('/onboarding') ||
    path.startsWith('/api/onboarding') ||
    path.startsWith('/auth/signout') ||
    path.startsWith('/api/auth/signout')

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Onboarding bloquant : tant que l'user n'a pas complete son profil,
  // redirection forcee vers /onboarding (sauf paths autorises).
  if (user && !isPublicPath && !isOnboardingPath) {
    const meta = (user.user_metadata || {}) as { profile_completed?: boolean }
    if (meta.profile_completed !== true) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
