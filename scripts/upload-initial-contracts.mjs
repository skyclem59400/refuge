#!/usr/bin/env node
/**
 * Upload initial des 6 contrats CDI depuis ~/Downloads/ vers le bucket
 * Supabase `employment-docs` + insertion dans member_documents.
 *
 * Exécution : node --env-file=.env.local scripts/upload-initial-contracts.mjs
 * Pré-requis : .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent côté insert : si un document avec le même file_path existe déjà,
 * Postgres lèvera une erreur unique — on log et on continue.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ SUPABASE_URL ou SERVICE_ROLE_KEY manquant dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ESTABLISHMENT_ID = 'f0a9d4a8-143d-431e-a875-0b2dc1f505ba' // SDA
const UPLOADER_USER_ID = 'c48611ca-532a-457b-a4c5-067b33ab0001' // Clément
const DOWNLOADS = '/Users/clement/Downloads'
const BUCKET = 'employment-docs'

const MAPPING = [
  {
    pdf: 'ROSELLE Franck CDI.pdf',
    memberId: 'ece49e8a-bd5d-4a2f-b20f-0d8f76127f64',
    label: 'CDI initial',
    who: 'Franck ROSELLE',
  },
  {
    pdf: 'FREMAUX Maryline CDI.pdf',
    memberId: '44d5419f-a690-4016-ac21-21471dd9791a',
    label: 'CDI initial',
    who: 'Maryline FREMAUX (Mary)',
  },
  {
    pdf: 'DELVILLE Marina contrat.pdf',
    memberId: '610bf4ca-3952-4b3c-857c-7d6e6ff74ab5',
    label: 'Contrat de travail',
    who: 'Marina DELVILLE',
  },
  {
    pdf: 'SENECHAL Carole CDI.pdf',
    memberId: 'd6d4c766-67f8-4254-9545-b8ee952b662b',
    label: 'CDI initial',
    who: 'Carole SENECHAL',
  },
  {
    pdf: 'DAUX Eric CDI.pdf',
    memberId: '46ff29b5-806a-4619-906a-8a5a3d1f5d8e',
    label: 'CDI initial',
    who: 'Eric DAUX',
  },
  {
    pdf: 'DELOCH Yann CDI.pdf',
    memberId: '34f2d72a-2df4-49cb-90cf-ecee831e5c9d',
    label: 'CDI initial',
    who: 'Yann DELOCH',
  },
]

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function uploadOne({ pdf, memberId, label, who }) {
  const localPath = join(DOWNLOADS, pdf)
  if (!existsSync(localPath)) {
    return { ok: false, who, reason: `fichier introuvable : ${localPath}` }
  }
  const buffer = readFileSync(localPath)
  const size = statSync(localPath).size
  const storagePath = `${ESTABLISHMENT_ID}/${memberId}/contract/${Date.now()}-${safeName(pdf)}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: false, contentType: 'application/pdf' })
  if (upErr) {
    return { ok: false, who, reason: `upload storage: ${upErr.message}` }
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { error: insErr } = await supabase.from('member_documents').insert({
    establishment_id: ESTABLISHMENT_ID,
    member_id: memberId,
    kind: 'contract',
    label,
    signed_date: null,
    file_path: storagePath,
    file_url: publicUrl,
    file_size: size,
    uploaded_by: UPLOADER_USER_ID,
  })

  if (insErr) {
    // Rollback du fichier si l'insert échoue (idem que dans uploadMemberDocument)
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { ok: false, who, reason: `insert DB: ${insErr.message}` }
  }

  return { ok: true, who, label, size }
}

async function main() {
  console.log(`📂 Upload de ${MAPPING.length} contrats vers Supabase…\n`)

  const results = []
  for (const entry of MAPPING) {
    const r = await uploadOne(entry)
    if (r.ok) {
      const kb = (r.size / 1024).toFixed(0)
      console.log(`✓  ${r.who.padEnd(28)} → "${r.label}" (${kb} Ko)`)
    } else {
      console.log(`✗  ${r.who.padEnd(28)} → ${r.reason}`)
    }
    results.push(r)
  }

  const ok = results.filter((r) => r.ok).length
  const ko = results.length - ok
  console.log(`\n📊 Bilan : ${ok} upload(s) OK / ${ko} échec(s)`)
  process.exit(ko === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Erreur fatale :', e)
  process.exit(1)
})
