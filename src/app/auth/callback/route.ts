import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Whitelist des emails autorises a se connecter via Google SSO.
// Le SSO Google est reserve a l'administrateur principal. Tous les autres
// roles (admins secondaires, salaries, benevoles) utilisent email/mot de passe.
const GOOGLE_SSO_ALLOWED_EMAILS = ['clement.scailteux@gmail.com']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  function redirectAbsolute(path: string) {
    const forwardedHost = request.headers.get('x-forwarded-host')
    if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${path}`)
    }
    return NextResponse.redirect(`${origin}${path}`)
  }

  if (!code) {
    return redirectAbsolute('/login')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return redirectAbsolute('/login?error=oauth_exchange')
  }

  // Verifier l'identite. Si c'est un login Google et que l'email n'est pas
  // dans la whitelist, on signe out + redirige avec message d'erreur.
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const provider = user.app_metadata?.provider
    const email = (user.email || '').toLowerCase()
    if (provider === 'google' && !GOOGLE_SSO_ALLOWED_EMAILS.includes(email)) {
      await supabase.auth.signOut()
      return redirectAbsolute('/login?error=sso_forbidden')
    }
  }

  return redirectAbsolute(next)
}
