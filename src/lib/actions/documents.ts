'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DocumentType, DocumentStatus } from '@/lib/types/database'

export async function createDocument(data: {
  type: DocumentType
  client_id: string | null
  client_name: string
  client_email: string | null
  client_address: string | null
  client_postal_code: string | null
  client_city: string | null
  nb_adultes: number
  prix_adulte: number
  nb_enfants: number
  prix_enfant: number
  total: number
  notes: string | null
}) {
  const supabase = await createClient()

  // Auto-numbering via RPC
  const { data: numero, error: rpcError } = await supabase.rpc('get_next_document_number', {
    doc_type: data.type,
  })

  if (rpcError) {
    return { error: 'Erreur de numerotation: ' + rpcError.message }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      ...data,
      numero,
      date: new Date().toISOString().split('T')[0],
      status: 'draft' as DocumentStatus,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath('/dashboard')
  return { data: doc }
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()

  // Clear conversion links pointing to this document
  // If a devis was converted to this facture, clear the devis's converted_to_id
  await supabase
    .from('documents')
    .update({ converted_to_id: null })
    .eq('converted_to_id', id)

  // If this facture was converted from a devis, clear this document's converted_from_id
  await supabase
    .from('documents')
    .update({ converted_from_id: null })
    .eq('converted_from_id', id)

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function convertDevisToFacture(devisId: string) {
  const supabase = await createClient()

  // 1. Fetch devis
  const { data: devis, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', devisId)
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

  // 2. Get next facture number
  const { data: numero, error: rpcError } = await supabase.rpc('get_next_document_number', {
    doc_type: 'facture',
  })

  if (rpcError) {
    return { error: 'Erreur de numerotation: ' + rpcError.message }
  }

  // 3. Create facture
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
      total: devis.total,
      notes: devis.notes,
      status: 'draft' as DocumentStatus,
      converted_from_id: devis.id,
    })
    .select()
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  // 4. Link devis to facture
  await supabase
    .from('documents')
    .update({ converted_to_id: facture.id })
    .eq('id', devisId)

  revalidatePath('/documents')
  revalidatePath('/dashboard')
  return { data: facture }
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  const supabase = await createClient()
  const { error } = await supabase.from('documents').update({ status }).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/documents')
  revalidatePath('/dashboard')
  return { success: true }
}
