'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'

type LoginMode = 'select' | 'admin' | 'salarie' | 'benevole'
type PseudoStep = 'pseudo' | 'create-password' | 'login'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pseudoStep, setPseudoStep] = useState<PseudoStep>('pseudo')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  // --- Admin login handlers ---
  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleLogin() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError('Erreur lors de la connexion Google')
    }
  }

  // --- Pseudo login handlers ---
  async function handlePseudoLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim()) return
    setError('')
    setLoading(true)

    try {
      const roleType = mode as 'salarie' | 'benevole'
      const res = await fetch('/api/auth/pseudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim(), roleType, action: 'lookup' }),
      })
      const data = await res.json()

      if (!data.exists) {
        setError('Pseudo introuvable. Verifiez l\'orthographe ou contactez votre administrateur.')
        setLoading(false)
        return
      }

      if (data.passwordSet) {
        setPseudoStep('login')
      } else {
        setPseudoStep('create-password')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    }
    setLoading(false)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      const roleType = mode as 'salarie' | 'benevole'
      const res = await fetch('/api/auth/pseudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim(), roleType, action: 'set-password', password: newPassword }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      // Password set - sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: newPassword,
      })

      if (signInError) {
        setError('Mot de passe cree, mais erreur lors de la connexion. Reessayez.')
        setPseudoStep('login')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erreur de connexion au serveur')
      setLoading(false)
    }
  }

  async function handlePseudoLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!password) return
    setLoading(true)

    try {
      const roleType = mode as 'salarie' | 'benevole'
      const res = await fetch('/api/auth/pseudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim(), roleType, action: 'login' }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      })

      if (signInError) {
        setError('Mot de passe incorrect')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erreur de connexion au serveur')
      setLoading(false)
    }
  }

  function handleBack() {
    setMode('select')
    setError('')
    setPseudo('')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPseudoStep('pseudo')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dark">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-surface border border-border text-muted hover:text-text transition-colors z-50"
        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-md animate-fade-up">
        <div className="bg-surface rounded-2xl p-8 glow border border-border">
          {/* Logo */}
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Optimus" className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-primary-light">Optimus</h1>
            <p className="text-muted text-sm mt-1">Gestion intelligente</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          {/* =================== MODE SELECT =================== */}
          {mode === 'select' && (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted mb-4">Je suis...</p>

              <button
                onClick={() => setMode('admin')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-dark border border-border
                  hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors">Administrateur</p>
                  <p className="text-xs text-muted">Connexion Google ou email</p>
                </div>
              </button>

              <button
                onClick={() => setMode('salarie')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-dark border border-border
                  hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text group-hover:text-blue-400 transition-colors">Salarie</p>
                  <p className="text-xs text-muted">Connexion avec pseudo</p>
                </div>
              </button>

              <button
                onClick={() => setMode('benevole')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-dark border border-border
                  hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text group-hover:text-green-400 transition-colors">Benevole</p>
                  <p className="text-xs text-muted">Connexion avec pseudo</p>
                </div>
              </button>
            </div>
          )}

          {/* =================== ADMIN MODE =================== */}
          {mode === 'admin' && (
            <>
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>

              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-lg
                  bg-white text-gray-700 font-semibold text-sm
                  hover:bg-gray-100 transition-colors
                  border border-gray-300 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Se connecter avec Google
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.fr"
                    required
                    className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                      focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                      placeholder:text-muted/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                      focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                      placeholder:text-muted/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-semibold text-white text-sm
                    gradient-primary hover:opacity-90 transition-opacity
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg shadow-primary/25"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </>
          )}

          {/* =================== PSEUDO MODE (salarie/benevole) =================== */}
          {(mode === 'salarie' || mode === 'benevole') && (
            <>
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>

              <div className="text-center mb-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                  ${mode === 'salarie' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'}`}>
                  {mode === 'salarie' ? 'Salarie' : 'Benevole'}
                </span>
              </div>

              {/* Step: Enter pseudo */}
              {pseudoStep === 'pseudo' && (
                <form onSubmit={handlePseudoLookup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Votre prenom (pseudo)
                    </label>
                    <input
                      type="text"
                      value={pseudo}
                      onChange={(e) => setPseudo(e.target.value)}
                      placeholder="Ex: Marie"
                      required
                      autoFocus
                      className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg font-semibold text-white text-sm
                      gradient-primary hover:opacity-90 transition-opacity
                      disabled:opacity-50 disabled:cursor-not-allowed
                      shadow-lg shadow-primary/25"
                  >
                    {loading ? 'Recherche...' : 'Continuer'}
                  </button>
                </form>
              )}

              {/* Step: Create password (first time) */}
              {pseudoStep === 'create-password' && (
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
                    Bienvenue <strong>{pseudo}</strong> ! Creez votre mot de passe pour la premiere connexion.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 caracteres"
                      required
                      autoFocus
                      className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg font-semibold text-white text-sm
                      gradient-primary hover:opacity-90 transition-opacity
                      disabled:opacity-50 disabled:cursor-not-allowed
                      shadow-lg shadow-primary/25"
                  >
                    {loading ? 'Creation...' : 'Creer mon mot de passe et me connecter'}
                  </button>
                </form>
              )}

              {/* Step: Login with password */}
              {pseudoStep === 'login' && (
                <form onSubmit={handlePseudoLogin} className="space-y-4">
                  <div className="p-3 rounded-lg bg-surface-dark border border-border text-sm text-muted">
                    Connexion en tant que <strong className="text-text">{pseudo}</strong>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                        focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                        placeholder:text-muted/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg font-semibold text-white text-sm
                      gradient-primary hover:opacity-90 transition-opacity
                      disabled:opacity-50 disabled:cursor-not-allowed
                      shadow-lg shadow-primary/25"
                  >
                    {loading ? 'Connexion...' : 'Se connecter'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
