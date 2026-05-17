/**
 * Validation Cloudflare Turnstile (anti-bot).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Pas de secret configuré → fail-open en dev, mais log warning
    console.warn('[turnstile] TURNSTILE_SECRET_KEY non configuré, vérification skip')
    return true
  }

  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.append('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      console.warn('[turnstile] échec validation', data['error-codes'])
    }
    return Boolean(data.success)
  } catch (e) {
    console.error('[turnstile] erreur réseau', e)
    return false
  }
}
