'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireEstablishment, requirePermission } from '@/lib/establishment/permissions'
import type { Document, DocumentType, DocumentStatus, LineItem } from '@/lib/types/database'

export async function getDocument(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error || !data) return { error: 'Document introuvable' }
    return { data: data as Document }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createDocument(data: {
  type: DocumentType
  client_id: string | null
  client_name: string
  client_email: string | null
  client_address: string | null
  client_postal_code: string | null
  client_city: string | null
  line_items: LineItem[]
  total: number
  notes: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data: numero, error: rpcError } = await supabase.rpc('get_next_document_number', {
      doc_type: data.type,
      est_id: establishmentId,
    })

    if (rpcError) {
      return { error: 'Erreur de numerotation: ' + rpcError.message }
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        type: data.type,
        numero,
        date: new Date().toISOString().split('T')[0],
        client_id: data.client_id,
        client_name: data.client_name,
        client_email: data.client_email,
        client_address: data.client_address,
        client_postal_code: data.client_postal_code,
        client_city: data.client_city,
        line_items: data.line_items,
        total: data.total,
        notes: data.notes,
        nb_adultes: 0,
        prix_adulte: 0,
        nb_enfants: 0,
        prix_enfant: 0,
        status: 'draft' as DocumentStatus,
        created_by: user?.id,
        establishment_id: establishmentId,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { data: doc }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateDocument(id: string, data: {
  client_id: string | null
  client_name: string
  client_email: string | null
  client_address: string | null
  client_postal_code: string | null
  client_city: string | null
  line_items: LineItem[]
  total: number
  notes: string | null
}) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data: existing, error: fetchError } = await supabase
      .from('documents')
      .select('type, status')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !existing) {
      return { error: 'Document introuvable' }
    }

    if (existing.type === 'avoir') {
      return { error: 'Un avoir ne peut pas etre modifie' }
    }
    if (existing.type === 'devis' && existing.status === 'converted') {
      return { error: 'Un devis converti ne peut plus etre modifie' }
    }
    if (existing.type === 'facture' && existing.status !== 'draft') {
      return { error: 'Une facture validee ne peut plus etre modifiee' }
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .update({
        client_id: data.client_id,
        client_name: data.client_name,
        client_email: data.client_email,
        client_address: data.client_address,
        client_postal_code: data.client_postal_code,
        client_city: data.client_city,
        line_items: data.line_items,
        total: data.total,
        notes: data.notes,
      })
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { data: doc }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteDocument(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    await supabase
      .from('documents')
      .update({ converted_to_id: null })
      .eq('converted_to_id', id)

    await supabase
      .from('documents')
      .update({ converted_from_id: null })
      .eq('converted_from_id', id)

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function convertDevisToFacture(devisId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data: devis, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', devisId)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !devis) {
      return { error: 'Devis introuvable' }
    }

    if (devis.type !== 'devis') {
      return { error: "Ce document n'est pas un devis" }
    }

    if (devis.converted_to_id) {
      return { error: 'Ce devis a deja ete converti' }
    }

    const { data: numero, error: rpcError } = await supabase.rpc('get_next_document_number', {
      doc_type: 'facture',
      est_id: establishmentId,
    })

    if (rpcError) {
      return { error: 'Erreur de numerotation: ' + rpcError.message }
    }

    const { data: facture, error: insertError } = await supabase
      .from('documents')
      .insert({
        type: 'facture' as DocumentType,
        numero,
        date: new Date().toISOString().split('T')[0],
        client_id: devis.client_id,
        client_name: devis.client_name,
        client_email: devis.client_email,
        client_address: devis.client_address,
        client_postal_code: devis.client_postal_code,
        client_city: devis.client_city,
        nb_adultes: devis.nb_adultes,
        prix_adulte: devis.prix_adulte,
        nb_enfants: devis.nb_enfants,
        prix_enfant: devis.prix_enfant,
        line_items: devis.line_items || [],
        total: devis.total,
        notes: devis.notes,
        status: 'draft' as DocumentStatus,
        converted_from_id: devis.id,
        establishment_id: establishmentId,
      })
      .select()
      .single()

    if (insertError) {
      return { error: insertError.message }
    }

    await supabase
      .from('documents')
      .update({ converted_to_id: facture.id, status: 'converted' as DocumentStatus })
      .eq('id', devisId)

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { data: facture }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function cancelFactureWithAvoir(factureId: string) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data: facture, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', factureId)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !facture) return { error: 'Facture introuvable' }
    if (facture.type !== 'facture') return { error: "Ce document n'est pas une facture" }
    if (facture.status === 'draft') {
      return { error: 'Une facture brouillon peut etre supprimee directement' }
    }
    if (facture.cancelled_by_id) {
      return { error: 'Cette facture a deja ete annulee' }
    }

    const { data: numero, error: rpcError } = await supabase.rpc('get_next_document_number', {
      doc_type: 'avoir',
      est_id: establishmentId,
    })
    if (rpcError) return { error: 'Erreur de numerotation: ' + rpcError.message }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: avoir, error: insertError } = await supabase
      .from('documents')
      .insert({
        type: 'avoir' as DocumentType,
        numero,
        date: new Date().toISOString().split('T')[0],
        client_id: facture.client_id,
        client_name: facture.client_name,
        client_email: facture.client_email,
        client_address: facture.client_address,
        client_postal_code: facture.client_postal_code,
        client_city: facture.client_city,
        nb_adultes: facture.nb_adultes,
        prix_adulte: facture.prix_adulte,
        nb_enfants: facture.nb_enfants,
        prix_enfant: facture.prix_enfant,
        line_items: facture.line_items || [],
        total: facture.total,
        notes: `Avoir pour annulation de la facture ${facture.numero}`,
        status: 'validated' as DocumentStatus,
        converted_from_id: facture.id,
        created_by: user?.id,
        establishment_id: establishmentId,
      })
      .select()
      .single()

    if (insertError) return { error: insertError.message }

    await supabase
      .from('documents')
      .update({
        status: 'cancelled' as DocumentStatus,
        cancelled_by_id: avoir.id,
      })
      .eq('id', factureId)

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { data: avoir }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  try {
    const { establishmentId } = await requirePermission('manage_documents')
    const supabase = await createClient()

    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('type, status, cancelled_by_id')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (fetchError || !doc) return { error: 'Document introuvable' }

    if (doc.type === 'facture' && doc.status !== 'draft' && status === 'draft') {
      return { error: 'Une facture validee ne peut pas revenir en brouillon' }
    }

    if (doc.type === 'facture' && status === 'cancelled' &&
        ['validated', 'sent', 'paid'].includes(doc.status)) {
      return await cancelFactureWithAvoir(id)
    }

    const { error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/documents')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
