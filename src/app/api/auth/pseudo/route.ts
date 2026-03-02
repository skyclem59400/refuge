import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface PseudoRequest {
  pseudo: string
  roleType: 'salarie' | 'benevole'
  action: 'lookup' | 'set-password' | 'login'
  password?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: PseudoRequest = await request.json()
    const { pseudo, roleType, action, password } = body

    if (!pseudo || !roleType || !action) {
      return Response.json(
        { error: 'Champs requis: pseudo, roleType, action' },
        { status: 400 }
      )
    }

    if (!['salarie', 'benevole'].includes(roleType)) {
      return Response.json(
        { error: 'roleType invalide' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const pseudoLower = pseudo.trim().toLowerCase()

    // Find member by pseudo + role_type
    const { data: member, error: memberError } = await admin
      .from('establishment_members')
      .select('id, user_id, pseudo, role_type, is_pseudo_user, password_set')
      .eq('pseudo', pseudoLower)
      .eq('role_type', roleType)
      .eq('is_pseudo_user', true)
      .limit(1)
      .single()

    if (action === 'lookup') {
      if (memberError || !member) {
        return Response.json({ exists: false, passwordSet: false })
      }
      return Response.json({
        exists: true,
        passwordSet: member.password_set,
      })
    }

    // For set-password and login, member must exist
    if (memberError || !member) {
      return Response.json(
        { error: 'Pseudo introuvable. Contactez votre administrateur.' },
        { status: 404 }
      )
    }

    // Get the generated email from the auth user
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(member.user_id)
    if (authError || !authUser?.user?.email) {
      return Response.json(
        { error: 'Erreur interne: utilisateur introuvable' },
        { status: 500 }
      )
    }

    const generatedEmail = authUser.user.email

    if (action === 'set-password') {
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

    if (action === 'login') {
      if (!member.password_set) {
        return Response.json(
          { error: 'Vous devez d\'abord creer votre mot de passe' },
          { status: 400 }
        )
      }

      return Response.json({ email: generatedEmail })
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
