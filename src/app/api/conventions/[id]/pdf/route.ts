// Sert le PDF d'une convention de fourrière. Source : `pdf_url` (Supabase
// Storage) en priorité, fallback `pdf_local_path` (filesystem du conteneur).
//
// En prod Coolify les chemins locaux `/Users/clement/...` ne sont pas
// montés dans le conteneur, donc on tombera sur "PDF non disponible côté
// serveur" jusqu'à l'upload vers Supabase Storage (TODO livraison 2). En
// local dev (workspace monté), la lecture filesystem marche.
import { promises as fs } from 'node:fs'
import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Non autorisé', { status: 401 })
  }

  const admin = createAdminClient()
  const { data: convention, error } = await admin
    .from('convention_contracts')
    .select('id, pdf_url, pdf_local_path, contract_number, scope_name')
    .eq('id', id)
    .single()

  if (error || !convention) {
    return new Response('Convention introuvable', { status: 404 })
  }

  // Priorité : URL Supabase Storage (livraison 2)
  if (convention.pdf_url) {
    return Response.redirect(convention.pdf_url, 302)
  }

  // Fallback : filesystem local
  if (convention.pdf_local_path) {
    try {
      const buffer = await fs.readFile(convention.pdf_local_path)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${convention.contract_number}.pdf"`,
        },
      })
    } catch (e) {
      return new Response(
        `PDF non disponible côté serveur. Chemin local : ${convention.pdf_local_path}\nErreur : ${(e as Error).message}`,
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      )
    }
  }

  return new Response('Aucun PDF lié à cette convention', { status: 404 })
}
