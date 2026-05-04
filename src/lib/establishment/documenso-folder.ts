import { createAdminClient } from '@/lib/supabase/server'
import { createFolder } from '@/lib/documenso/client'

/**
 * Garantit qu'un établissement a un dossier Documenso associé.
 *
 * - Si la colonne `documenso_folder_id` est déjà remplie, retourne sa valeur.
 * - Sinon, crée un nouveau dossier Documenso (via API v2-beta), enregistre
 *   l'ID en DB et le retourne.
 *
 * Best-effort : si la création échoue (Documenso down, token invalide…), on
 * loggue et retourne null. Le code appelant doit pouvoir continuer sans
 * dossier (le contrat sera créé à la racine, l'admin pourra le déplacer
 * manuellement depuis l'UI Documenso).
 */
export async function ensureDocumensoFolder(
  establishmentId: string,
  establishmentName: string,
): Promise<string | null> {
  const admin = createAdminClient()

  const { data: est, error } = await admin
    .from('establishments')
    .select('documenso_folder_id')
    .eq('id', establishmentId)
    .maybeSingle()

  if (error) {
    console.error('[documenso-folder] failed to read establishment:', error.message)
    return null
  }

  const existing = (est as { documenso_folder_id: string | null } | null)?.documenso_folder_id
  if (existing) return existing

  try {
    const folder = await createFolder(establishmentName)
    const { error: updateError } = await admin
      .from('establishments')
      .update({ documenso_folder_id: folder.id })
      .eq('id', establishmentId)
    if (updateError) {
      console.error('[documenso-folder] folder created but DB update failed:', updateError.message)
      // Le folder existe côté Documenso mais pas en DB — pas critique, prochain appel
      // tentera de re-créer ce qui produira un doublon. Logué pour intervention manuelle.
    }
    return folder.id
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[documenso-folder] createFolder("${establishmentName}") failed:`, msg)
    return null
  }
}
