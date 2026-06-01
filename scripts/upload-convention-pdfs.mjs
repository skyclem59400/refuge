// Upload des 55 PDFs de conventions vers Supabase Storage,
// puis met à jour `convention_contracts.pdf_url` pour chaque contrat.
//
// Usage : `node scripts/upload-convention-pdfs.mjs`
// Requires : .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET = 'convention-contracts'

async function uploadOne(localPath, contractNumber, contractId) {
  try {
    const buffer = await fs.readFile(localPath)
    const storageKey = `${contractNumber}.pdf`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (upErr) {
      console.error(`  ❌ ${contractNumber} : upload failed -> ${upErr.message}`)
      return false
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storageKey)
    const publicUrl = pub.publicUrl

    const { error: updErr } = await supabase
      .from('convention_contracts')
      .update({ pdf_url: publicUrl })
      .eq('id', contractId)
    if (updErr) {
      console.error(`  ❌ ${contractNumber} : DB update failed -> ${updErr.message}`)
      return false
    }

    console.log(`  ✅ ${contractNumber} -> ${publicUrl}`)
    return true
  } catch (e) {
    console.error(`  ❌ ${contractNumber} : ${e.message}`)
    return false
  }
}

async function main() {
  const { data: contracts, error } = await supabase
    .from('convention_contracts')
    .select('id, contract_number, scope_name, pdf_local_path')
    .order('contract_number', { ascending: true })

  if (error) {
    console.error('Failed to list contracts:', error.message)
    process.exit(1)
  }

  console.log(`📦 ${contracts.length} conventions à uploader\n`)

  let ok = 0
  let ko = 0
  for (const c of contracts) {
    if (!c.pdf_local_path) {
      console.log(`  ⚠️  ${c.contract_number} (${c.scope_name}) : pas de pdf_local_path`)
      ko++
      continue
    }
    const success = await uploadOne(c.pdf_local_path, c.contract_number, c.id)
    if (success) ok++
    else ko++
  }

  console.log(`\n📊 Total : ${ok} OK / ${ko} KO`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
