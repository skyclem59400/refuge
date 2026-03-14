import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

interface PseudoRequest {
  pseudo: string
  roleType: 'salarie' | 'benevole'
  action: 'lookup' | 'set-password' | 'login'
  password?: string
}

interface MemberRecord {
  id: string
  user_id: string
  pseudo: string
  role_type: string
  is_pseudo_user: boolean
  password_set: boolean
}

// ── Validation ──

function validateRequestBody(body: PseudoRequest): Response | null {
  if (!body.pseudo || !body.roleType || !body.action) {
    return Response.json(
      { error: 'Champs requis: pseudo, roleType, action' },
      { status: 400 }
    )
  }

  if (!['salarie', 'benevole'].includes(body.roleType)) {
    return Response.json(
      { error: 'roleType invalide' },
      { status: 400 }
    )
  }

  return null
}

// ── Member Lookup ──

async function findMemberByPseudo(
  admin: SupabaseClient,
  pseudoLower: string,
  roleType: string
): Promise<MemberRecord | null> {
  const { data: member, error } = await admin
    .from('establishment_members')
    .select('id, user_id, pseudo, role_type, is_pseudo_user, password_set')
    .eq('pseudo', pseudoLower)
    .eq('role_type', roleType)
    .eq('is_pseudo_user', true)
    .limit(1)
    .single()

  if (error || !member) return null
  return member as MemberRecord
}

async function getGeneratedEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: authUser, error } = await admin.auth.admin.getUserById(userId)
  if (error || !authUser?.user?.email) return null
  return authUser.user.email
}

// ── Action Handlers ──

function handleLookup(member: MemberRecord | null): Response {
  if (!member) {
    return Response.json({ exists: false, passwordSet: false })
  }
  return Response.json({ exists: true, passwordSet: member.password_set })
}

async function handleSetPassword(
  admin: SupabaseClient,
  member: MemberRecord,
  generatedEmail: string,
  password?: string
): Promise<Response> {
  if (!password || password.length < 6) {
    return Response.json(
      { error: 'Le mot de passe doit contenir au moins 6 caracteres' },
      { status: 400 }
    )
  }

  if (member.password_set) {
    return Response.json(
      { error: 'Le mot de passe a deja ete defini. Contactez votre administrateur pour le reinitialiser.' },
      { status: 400 }
    )
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    member.user_id,
    { password }
  )

  if (updateError) {
    return Response.json(
      { error: 'Erreur lors de la definition du mot de passe' },
      { status: 500 }
    )
  }

  await admin
    .from('establishment_members')
    .update({ password_set: true })
    .eq('id', member.id)

  return Response.json({ email: generatedEmail })
}

function handleLogin(member: MemberRecord, generatedEmail: string): Response {
  if (!member.password_set) {
    return Response.json(
      { error: 'Vous devez d\'abord creer votre mot de passe' },
      { status: 400 }
    )
  }

  return Response.json({ email: generatedEmail })
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  try {
    const body: PseudoRequest = await request.json()
    const { pseudo, roleType, action, password } = body

    const validationError = validateRequestBody(body)
    if (validationError) return validationError

    const admin = createAdminClient()
    const pseudoLower = pseudo.trim().toLowerCase()
    const member = await findMemberByPseudo(admin, pseudoLower, roleType)

    if (action === 'lookup') {
      return handleLookup(member)
    }

    // For set-password and login, member must exist
    if (!member) {
      return Response.json(
        { error: 'Pseudo introuvable. Contactez votre administrateur.' },
        { status: 404 }
      )
    }

    const generatedEmail = await getGeneratedEmail(admin, member.user_id)
    if (!generatedEmail) {
      return Response.json(
        { error: 'Erreur interne: utilisateur introuvable' },
        { status: 500 }
      )
    }

    if (action === 'set-password') {
      return handleSetPassword(admin, member, generatedEmail, password)
    }

    if (action === 'login') {
      return handleLogin(member, generatedEmail)
    }

    return Response.json({ error: 'Action invalide' }, { status: 400 })
  } catch (e) {
    console.error('Pseudo auth error:', e)
    return Response.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
