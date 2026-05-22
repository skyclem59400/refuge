'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import type {
  CraDay,
  CraDaySource,
  CraEntry,
  CraMonthlyStatus,
  CraMonthlyView,
  DayOfWeek,
  EstablishmentMember,
  LeaveRequest,
  LeaveType,
  MemberWorkSchedule,
} from '@/lib/types/database'

/**
 * Server actions du workflow CRA (saisie + validation + envoi).
 *
 * Flow :
 *   draft (Mary saisit) → submitted (Mary a soumis) →
 *     - validated_by_member (Le collab a OK)  → sent (au comptable)
 *     - change_requested (Le collab demande modif) → repasse en draft après résolution
 *
 * Pré-remplissage d'un mois :
 *   - Pour chaque jour, on prend dans l'ordre : férié → arrêt long → congé approuvé →
 *     congé en attente → cra_entries override → semaine type → fallback travaillé 7h.
 */

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function emptyDay(date: string, weekday: DayOfWeek, source: CraDaySource): CraDay {
  return {
    date,
    weekday,
    source,
    is_rest_day: true,
    start_am: null,
    end_am: null,
    start_pm: null,
    end_pm: null,
    hours_total: 0,
  }
}

/**
 * Construit la vue mensuelle complète d'un CRA pour un membre.
 * Le tableau renvoyé a une ligne par jour calendaire du mois (28-31 jours).
 */
export async function getMonthlySaisie(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: CraMonthlyView; error?: string }> {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    // 1. Membre + droits
    const { data: memberRow, error: memberErr } = await admin
      .from('establishment_members')
      .select('*')
      .eq('id', memberId)
      .eq('establishment_id', establishmentId)
      .single()
    if (memberErr || !memberRow) return { error: 'Membre introuvable' }
    const member = memberRow as EstablishmentMember

    // Enrichir nom
    let memberName = member.pseudo || 'Collaborateur'
    if (member.user_id) {
      const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [member.user_id] })
      if (usersInfo && Array.isArray(usersInfo) && usersInfo[0]) {
        memberName = usersInfo[0].full_name || memberName
      }
    }

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const startISO = ymd(monthStart)
    const endISO = ymd(monthEnd)

    // 2. Sources de données en parallèle
    const [scheduleRes, entriesRes, leavesRes, typesRes, holidaysRes, statusRes, astreintesRes] = await Promise.all([
      admin
        .from('member_work_schedules')
        .select('*')
        .eq('member_id', memberId)
        .is('valid_until', null),
      admin
        .from('cra_entries')
        .select('*')
        .eq('member_id', memberId)
        .gte('date', startISO)
        .lte('date', endISO),
      admin
        .from('leave_requests')
        .select('*')
        .eq('member_id', memberId)
        .in('status', ['approved', 'pending'])
        .lte('start_date', endISO)
        .gte('end_date', startISO),
      admin
        .from('leave_types')
        .select('*')
        .eq('establishment_id', establishmentId),
      admin
        .from('public_holidays')
        .select('*')
        .gte('date', startISO)
        .lte('date', endISO),
      admin
        .from('cra_monthly_status')
        .select('*')
        .eq('member_id', memberId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle(),
      admin
        .from('cra_astreintes')
        .select('week_start_monday')
        .eq('member_id', memberId)
        .gte('week_start_monday', startISO)
        .lte('week_start_monday', endISO)
        .order('week_start_monday'),
    ])

    if (scheduleRes.error) return { error: scheduleRes.error.message }
    if (entriesRes.error) return { error: entriesRes.error.message }
    if (leavesRes.error) return { error: leavesRes.error.message }
    if (typesRes.error) return { error: typesRes.error.message }

    const schedule = (scheduleRes.data || []) as MemberWorkSchedule[]
    const entries = (entriesRes.data || []) as CraEntry[]
    const leaves = (leavesRes.data || []) as LeaveRequest[]
    const types = (typesRes.data || []) as LeaveType[]
    const typeMap = new Map(types.map((t) => [t.id, t]))
    const holidaysMap = new Map<string, string>(
      ((holidaysRes.data || []) as Array<{ date: string; label?: string; name?: string }>).map((h) => [
        h.date,
        h.label || h.name || 'Férié',
      ])
    )

    const scheduleByDow = new Map<DayOfWeek, MemberWorkSchedule>()
    for (const s of schedule) scheduleByDow.set(s.day_of_week as DayOfWeek, s)
    const entryByDate = new Map<string, CraEntry>()
    for (const e of entries) entryByDate.set(e.date, e)

    const status = statusRes.data as CraMonthlyStatus | null
    const astreinteWeeks = ((astreintesRes.data || []) as Array<{ week_start_monday: string }>)
      .map((a) => a.week_start_monday)

    // 3. Construction jour par jour
    const days: CraDay[] = []
    let totalWorked = 0
    let totalLeave = 0
    let totalRest = 0

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const date = ymd(d)
      const weekday = d.getDay() as DayOfWeek
      const holidayName = holidaysMap.get(date)

      // 3a. Férié
      if (holidayName) {
        // 3a.bis : Override jour précis prioritaire (cra_entries)
        const overrideOnHoliday = entryByDate.get(date)
        if (overrideOnHoliday) {
          const h = overrideOnHoliday.hours_total ?? 0
          days.push({
            date,
            weekday,
            source: 'override',
            is_rest_day: overrideOnHoliday.is_rest_day,
            start_am: overrideOnHoliday.start_am,
            end_am: overrideOnHoliday.end_am,
            start_pm: overrideOnHoliday.start_pm,
            end_pm: overrideOnHoliday.end_pm,
            hours_total: Number(h),
            notes: overrideOnHoliday.notes,
            holiday_name: holidayName,
          })
          if (overrideOnHoliday.is_rest_day) totalRest += 1
          else totalWorked += Number(h)
          continue
        }

        // 3a.ter : Si le membre a un horaire jour férié défini, l'appliquer
        const hasHolidaySchedule =
          member.holiday_start_am || member.holiday_end_am ||
          member.holiday_start_pm || member.holiday_end_pm
        if (hasHolidaySchedule) {
          const h = hoursBetween(member.holiday_start_am, member.holiday_end_am)
            + hoursBetween(member.holiday_start_pm, member.holiday_end_pm)
          days.push({
            date,
            weekday,
            source: 'holiday',
            is_rest_day: false,
            start_am: member.holiday_start_am,
            end_am: member.holiday_end_am,
            start_pm: member.holiday_start_pm,
            end_pm: member.holiday_end_pm,
            hours_total: h,
            holiday_name: holidayName,
          })
          totalWorked += h
          continue
        }

        // Sinon : férié = repos (comportement par défaut)
        days.push({ ...emptyDay(date, weekday, 'holiday'), holiday_name: holidayName })
        continue
      }

      // 3b. Arrêt longue durée
      const onExtended =
        member.availability_status === 'on_extended_leave' &&
        (!member.extended_leave_from || date >= member.extended_leave_from) &&
        (!member.extended_leave_until || date <= member.extended_leave_until)
      if (onExtended) {
        days.push({
          ...emptyDay(date, weekday, 'extended_leave'),
          leave_label: 'Arrêt longue durée',
          leave_status: 'approved',
        })
        continue
      }

      // 3c. Congé (full_day uniquement pour le moment ; les hourly seront ajoutés à l'override)
      const dayLeaves = leaves.filter(
        (l) => l.start_date <= date && l.end_date >= date && l.granularity !== 'hourly'
      )
      if (dayLeaves.length > 0) {
        const top = dayLeaves[0]
        const t = typeMap.get(top.leave_type_id)
        days.push({
          ...emptyDay(date, weekday, 'leave'),
          leave_label: t?.name || 'Congé',
          leave_type_id: top.leave_type_id,
          leave_status: top.status as 'approved' | 'pending',
        })
        totalLeave += 7
        continue
      }

      // 3d. Override (cra_entries) — priorité sur le template
      const override = entryByDate.get(date)
      if (override) {
        const h = override.hours_total ?? 0
        days.push({
          date,
          weekday,
          source: 'override',
          is_rest_day: override.is_rest_day,
          start_am: override.start_am,
          end_am: override.end_am,
          start_pm: override.start_pm,
          end_pm: override.end_pm,
          hours_total: Number(h),
          notes: override.notes,
        })
        if (override.is_rest_day) totalRest += 1
        else totalWorked += Number(h)
        continue
      }

      // 3e. Template (semaine type)
      const tpl = scheduleByDow.get(weekday)
      if (tpl) {
        const h = hoursBetween(tpl.start_am, tpl.end_am) + hoursBetween(tpl.start_pm, tpl.end_pm)
        days.push({
          date,
          weekday,
          source: 'template',
          is_rest_day: tpl.is_rest_day,
          start_am: tpl.start_am,
          end_am: tpl.end_am,
          start_pm: tpl.start_pm,
          end_pm: tpl.end_pm,
          hours_total: h,
        })
        if (tpl.is_rest_day) totalRest += 1
        else totalWorked += h
        continue
      }

      // 3f. Aucun template → jour considéré en repos par défaut (cas Matthieu)
      days.push(emptyDay(date, weekday, 'template'))
      totalRest += 1
    }

    return {
      data: {
        member_id: member.id,
        member_name: memberName,
        member_pseudo: member.pseudo || null,
        year,
        month,
        days,
        total_worked_hours: Math.round(totalWorked * 100) / 100,
        total_leave_hours: Math.round(totalLeave * 100) / 100,
        total_rest_days: totalRest,
        astreinte_weeks: astreinteWeeks,
        status: status?.status || 'draft',
        status_record_id: status?.id || null,
        submitted_at: status?.submitted_at || null,
        validated_at: status?.validated_at || null,
        admin_validated_at: status?.admin_validated_at || null,
        change_request_comment: status?.change_request_comment || null,
        sent_at: status?.sent_at || null,
        sent_to: status?.sent_to || null,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export interface CraEntryInput {
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  notes?: string | null
}

/** Upsert d'une surcharge journalière */
export async function upsertCraEntry(
  memberId: string,
  date: string,
  payload: CraEntryInput
): Promise<{ data?: CraEntry; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Validation horaire max 17h
    for (const t of [payload.end_am, payload.end_pm]) {
      if (t && t > '17:00') return { error: 'Aucun horaire ne peut dépasser 17h00 (règle SDA).' }
    }

    if (payload.is_rest_day) {
      payload.start_am = null
      payload.end_am = null
      payload.start_pm = null
      payload.end_pm = null
    }

    const { data: existing } = await admin
      .from('cra_entries')
      .select('id')
      .eq('member_id', memberId)
      .eq('date', date)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await admin
        .from('cra_entries')
        .update({
          is_rest_day: payload.is_rest_day,
          start_am: payload.start_am,
          end_am: payload.end_am,
          start_pm: payload.start_pm,
          end_pm: payload.end_pm,
          notes: payload.notes ?? null,
          entered_by: user?.id || null,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return { error: error.message }
      return { data: data as CraEntry }
    }

    const { data, error } = await admin
      .from('cra_entries')
      .insert({
        member_id: memberId,
        establishment_id: establishmentId,
        date,
        is_rest_day: payload.is_rest_day,
        start_am: payload.start_am,
        end_am: payload.end_am,
        start_pm: payload.start_pm,
        end_pm: payload.end_pm,
        notes: payload.notes ?? null,
        entered_by: user?.id || null,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: data as CraEntry }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Supprime un override → retour au template */
export async function deleteCraEntry(
  memberId: string,
  date: string
): Promise<{ data?: true; error?: string }> {
  try {
    await requirePermission('manage_leaves')
    const admin = createAdminClient()
    const { error } = await admin
      .from('cra_entries')
      .delete()
      .eq('member_id', memberId)
      .eq('date', date)
    if (error) return { error: error.message }
    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Garantit l'existence d'une ligne cra_monthly_status, retourne l'ID */
async function ensureMonthlyStatus(
  memberId: string,
  establishmentId: string,
  year: number,
  month: number
): Promise<{ id: string; status: string } | { error: string }> {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('cra_monthly_status')
    .select('id, status')
    .eq('member_id', memberId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (existing) return { id: existing.id, status: existing.status }

  const { data, error } = await admin
    .from('cra_monthly_status')
    .insert({
      member_id: memberId,
      establishment_id: establishmentId,
      year,
      month,
      status: 'draft',
    })
    .select('id, status')
    .single()
  if (error) return { error: error.message }
  return { id: data.id, status: data.status }
}

/** Mary soumet le CRA au collaborateur */
export async function submitCraToMember(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: true; error?: string }> {
  try {
    const { establishmentId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const r = await ensureMonthlyStatus(memberId, establishmentId, year, month)
    if ('error' in r) return { error: r.error }

    const { error } = await admin
      .from('cra_monthly_status')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: user?.id || null,
        change_requested_at: null,
        change_request_comment: null,
      })
      .eq('id', r.id)
    if (error) return { error: error.message }

    // Notification au collaborateur (in-app + email)
    const { data: memberData } = await admin
      .from('establishment_members')
      .select('user_id, pseudo')
      .eq('id', memberId)
      .single()
    if (memberData?.user_id) {
      await admin.from('notifications').insert({
        establishment_id: establishmentId,
        user_id: memberData.user_id,
        type: 'cra_submitted',
        title: `Votre CRA de ${monthLabel(month)} ${year} est prêt`,
        body: 'Vous pouvez le consulter et le valider dans votre espace collaborateur.',
        link: `/espace-collaborateur/cra/${year}/${month}`,
        metadata: { year, month, member_id: memberId },
      })

      // Email transactionnel fire-and-forget (ne pas bloquer la soumission si échec)
      void (async () => {
        try {
          const { data: usersInfo } = await admin.rpc('get_users_info', {
            user_ids: [memberData.user_id],
          })
          const recipient = Array.isArray(usersInfo) ? usersInfo[0] : null
          if (!recipient?.email) return
          const { data: estab } = await admin
            .from('establishments')
            .select('name')
            .eq('id', establishmentId)
            .single()
          const { sendCraSubmittedEmail } = await import('@/lib/email/cra-submitted')
          await sendCraSubmittedEmail({
            to: recipient.email,
            toName: recipient.full_name || memberData.pseudo || 'Collaborateur',
            year,
            month,
            establishmentName: estab?.name || 'Refuge SDA',
          })
        } catch (err) {
          console.error('[submitCraToMember] email send failed', err)
        }
      })()
    }

    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Le collaborateur valide son propre CRA */
export async function validateCraAsMember(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: true; error?: string }> {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    // Vérifier que le user authentifié est bien le membre
    const { data: membership } = await admin
      .from('establishment_members')
      .select('id, user_id')
      .eq('id', memberId)
      .single()
    if (!membership || membership.user_id !== userId) {
      return { error: 'Vous ne pouvez valider que votre propre CRA.' }
    }

    const r = await ensureMonthlyStatus(memberId, establishmentId, year, month)
    if ('error' in r) return { error: r.error }
    if (r.status !== 'submitted' && r.status !== 'change_requested') {
      return { error: 'Le CRA n\'est pas en attente de votre validation.' }
    }

    const { error } = await admin
      .from('cra_monthly_status')
      .update({
        status: 'validated_by_member',
        validated_at: new Date().toISOString(),
        validated_by: userId,
      })
      .eq('id', r.id)
    if (error) return { error: error.message }

    // Le collaborateur a validé → les ADMINS (Clément, Céline) sont en charge
    // de la validation finale avant envoi comptable.
    await notifyAdminsOfCraEvent({
      establishmentId,
      memberId,
      year,
      month,
      type: 'cra_pending_admin_validation',
      title: `Validation admin requise : CRA ${monthLabel(month)} ${year}`,
      body: 'Le collaborateur a validé son CRA. Merci de le contrôler avant envoi au comptable.',
      link: `/admin/cra/validations?member=${memberId}&year=${year}&month=${month}`,
    })

    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Validation finale par un admin (Clément ou Céline) — bloque jusqu'a l'envoi comptable */
export async function validateCraAsAdmin(
  memberId: string,
  year: number,
  month: number
): Promise<{ data?: true; error?: string }> {
  try {
    const { userId, establishmentId, membership } = await requireEstablishment()
    if (membership.role_type !== 'admin') {
      return { error: 'Seul un administrateur (Clément ou Céline) peut valider un CRA.' }
    }
    const admin = createAdminClient()

    const r = await ensureMonthlyStatus(memberId, establishmentId, year, month)
    if ('error' in r) return { error: r.error }
    if (r.status !== 'validated_by_member') {
      return { error: 'Le CRA doit être validé par le collaborateur avant validation admin.' }
    }

    const { error } = await admin
      .from('cra_monthly_status')
      .update({
        status: 'validated_by_admin',
        admin_validated_at: new Date().toISOString(),
        admin_validated_by: userId,
      })
      .eq('id', r.id)
    if (error) return { error: error.message }

    // Mary peut maintenant envoyer au comptable → notifie les managers
    await notifyManagersOfCraEvent({
      establishmentId,
      memberId,
      year,
      month,
      type: 'cra_admin_validated',
      title: `CRA validé admin : ${monthLabel(month)} ${year}`,
      body: 'Vous pouvez maintenant l\'envoyer au comptable.',
    })

    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Le collaborateur demande une modification — Clément + Mary notifiés */
export async function requestCraChange(
  memberId: string,
  year: number,
  month: number,
  comment: string
): Promise<{ data?: true; error?: string }> {
  try {
    const { userId, establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    if (!comment || comment.trim().length < 5) {
      return { error: 'Merci de préciser ce qui doit être modifié (au moins 5 caractères).' }
    }

    const { data: membership } = await admin
      .from('establishment_members')
      .select('id, user_id')
      .eq('id', memberId)
      .single()
    if (!membership || membership.user_id !== userId) {
      return { error: 'Vous ne pouvez demander une modification que sur votre propre CRA.' }
    }

    const r = await ensureMonthlyStatus(memberId, establishmentId, year, month)
    if ('error' in r) return { error: r.error }
    if (r.status !== 'submitted' && r.status !== 'validated_by_member') {
      return { error: "Le CRA n'est pas dans un état permettant une demande de modification." }
    }

    const now = new Date().toISOString()
    const { error: updErr } = await admin
      .from('cra_monthly_status')
      .update({
        status: 'change_requested',
        change_requested_at: now,
        change_request_comment: comment.trim(),
      })
      .eq('id', r.id)
    if (updErr) return { error: updErr.message }

    // Trace audit
    await admin.from('cra_change_requests').insert({
      cra_status_id: r.id,
      member_id: memberId,
      establishment_id: establishmentId,
      requested_by: userId,
      comment: comment.trim(),
    })

    // Notifier les managers (Mary) ET le président (Clément)
    await notifyManagersOfCraEvent({
      establishmentId,
      memberId,
      year,
      month,
      type: 'cra_change_requested',
      title: `Demande de modification CRA : ${monthLabel(month)} ${year}`,
      body: comment.trim().slice(0, 200),
    })
    await notifyPresidentOfCraEvent({
      establishmentId,
      memberId,
      year,
      month,
      type: 'cra_change_requested',
      title: `Demande de modification CRA : ${monthLabel(month)} ${year}`,
      body: comment.trim().slice(0, 200),
    })

    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Mary marque une demande de modification comme résolue */
export async function resolveChangeRequest(
  changeRequestId: string,
  resolutionNotes: string
): Promise<{ data?: true; error?: string }> {
  try {
    const { userId } = await requirePermission('manage_leaves')
    const admin = createAdminClient()

    const { data: cr, error: crErr } = await admin
      .from('cra_change_requests')
      .select('*')
      .eq('id', changeRequestId)
      .single()
    if (crErr || !cr) return { error: 'Demande introuvable' }

    const { error: updErr } = await admin
      .from('cra_change_requests')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: resolutionNotes,
      })
      .eq('id', changeRequestId)
    if (updErr) return { error: updErr.message }

    // Repasser le mois en draft pour que Mary puisse modifier
    await admin
      .from('cra_monthly_status')
      .update({
        status: 'draft',
        change_requested_at: null,
        change_request_comment: null,
      })
      .eq('id', cr.cra_status_id)

    return { data: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Liste les demandes ouvertes pour Clément */
export async function listOpenChangeRequests() {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('cra_change_requests')
      .select('*, cra_status:cra_monthly_status(*), member:establishment_members(*)')
      .eq('establishment_id', establishmentId)
      .is('resolved_at', null)
      .order('requested_at', { ascending: false })
    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ============================================================
// Helpers
// ============================================================

const MONTH_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
function monthLabel(month: number): string {
  return MONTH_FR[month - 1] || String(month)
}

async function notifyManagersOfCraEvent(params: {
  establishmentId: string
  memberId: string
  year: number
  month: number
  type: string
  title: string
  body: string
}) {
  const admin = createAdminClient()
  // Récupérer les permission_groups avec manage_leaves
  const { data: groups } = await admin
    .from('permission_groups')
    .select('id')
    .eq('establishment_id', params.establishmentId)
    .eq('manage_leaves', true)
  if (!groups || groups.length === 0) return
  const groupIds = groups.map((g) => g.id)
  const { data: memberGroups } = await admin
    .from('member_groups')
    .select('member_id')
    .in('group_id', groupIds)
  if (!memberGroups || memberGroups.length === 0) return
  const memberIds = [...new Set(memberGroups.map((mg) => mg.member_id))]
  const { data: members } = await admin
    .from('establishment_members')
    .select('user_id')
    .in('id', memberIds)
  if (!members || members.length === 0) return
  const userIds = [...new Set(members.map((m) => m.user_id))]
  const link = `/admin/cra/saisie?member=${params.memberId}&year=${params.year}&month=${params.month}`
  await admin.from('notifications').insert(
    userIds.map((uid) => ({
      establishment_id: params.establishmentId,
      user_id: uid,
      type: params.type,
      title: params.title,
      body: params.body,
      link,
      metadata: { member_id: params.memberId, year: params.year, month: params.month },
    }))
  )
}

/** Notifie tous les admins de l'établissement (Clément + Céline pour SDA) */
async function notifyAdminsOfCraEvent(params: {
  establishmentId: string
  memberId: string
  year: number
  month: number
  type: string
  title: string
  body: string
  link?: string
}) {
  const admin = createAdminClient()
  const { data: admins } = await admin
    .from('establishment_members')
    .select('user_id, id')
    .eq('establishment_id', params.establishmentId)
    .eq('role', 'admin')
  if (!admins) return
  const userIds = admins.map((p) => p.user_id).filter(Boolean) as string[]
  if (userIds.length === 0) return
  const link = params.link || `/admin/cra/validations`
  await admin.from('notifications').insert(
    userIds.map((uid) => ({
      establishment_id: params.establishmentId,
      user_id: uid,
      type: params.type,
      title: params.title,
      body: params.body,
      link,
      metadata: { member_id: params.memberId, year: params.year, month: params.month, audience: 'admin' },
    }))
  )
}

/** Notifie uniquement le Président pour les demandes de modification */
async function notifyPresidentOfCraEvent(params: {
  establishmentId: string
  memberId: string
  year: number
  month: number
  type: string
  title: string
  body: string
}) {
  // Aujourd'hui le Président = admin également → on réutilise notifyAdminsOfCraEvent
  // avec un préfixe spécifique pour différencier dans la cloche.
  await notifyAdminsOfCraEvent({
    ...params,
    title: '[Président] ' + params.title,
    link: `/admin/cra/demandes`,
  })
}
