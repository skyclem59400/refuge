'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Check, Trash2, X, Loader2, Mail, FileDown, CheckCircle2 } from 'lucide-react'
import {
  addVetVisitLine,
  updateVetVisitLine,
  deleteVetVisitLine,
  validateVetVisitLine,
  unvalidateVetVisitLine,
} from '@/lib/actions/vet-visits'
import { sendVetVisitRecap, getVetVisitRecapDownloadUrl } from '@/lib/actions/vet-visit-recap'
import { getSpeciesEmoji } from '@/lib/species'
import type {
  VetVisitWithLines,
  VetVisitLineWithAnimal,
  VetVisitActKey,
  VetVisitActs,
  Animal,
} from '@/lib/types/database'

const ACT_COLUMNS: { key: VetVisitActKey; label: string; color: string }[] = [
  { key: 'puce',          label: 'PUCE',         color: 'bg-cyan-200/30 text-cyan-700' },
  { key: 'cession',       label: 'CESSION',      color: 'bg-red-200/40 text-red-700' },
  { key: 'vaccin_chien',  label: 'VACCIN CHIEN', color: 'bg-yellow-200/40 text-yellow-700' },
  { key: 'visite_divers', label: 'VISITE DIVERS',color: 'bg-orange-200/40 text-orange-700' },
  { key: 'importation',   label: 'IMPORTATION',  color: 'bg-purple-200/30 text-purple-700' },
  { key: 'vaccin_chat',   label: 'VACCIN CHAT',  color: 'bg-blue-200/30 text-blue-700' },
  { key: 'test_leucose',  label: 'TEST LEUCOSE', color: 'bg-green-200/40 text-green-700' },
  { key: 'consultation',  label: 'CONSULTATION', color: 'bg-pink-200/30 text-pink-700' },
  { key: 'sterilization', label: 'STÉRILISATION',color: 'bg-indigo-200/30 text-indigo-700' },
  { key: 'antiparasitic', label: 'ANTIPARAS.',   color: 'bg-teal-200/30 text-teal-700' },
  { key: 'radio',         label: 'RADIO',        color: 'bg-amber-200/30 text-amber-700' },
]

type AnimalLite = Pick<Animal, 'id' | 'name' | 'medal_number' | 'species' | 'box_id' | 'breed' | 'breed_cross' | 'color' | 'chip_number'>

interface Props {
  visit: VetVisitWithLines
  availableAnimals: AnimalLite[]
}

export function VetVisitTableClient({ visit, availableAnimals }: Readonly<Props>) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingLineId, setPendingLineId] = useState<string | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [search, setSearch] = useState('')

  // État local des lignes (pour optimistic updates)
  const [lines, setLines] = useState<VetVisitLineWithAnimal[]>(visit.lines)

  const filteredAnimals = search.length >= 2
    ? availableAnimals
        .filter((a) => {
          const q = search.toLowerCase()
          return a.name.toLowerCase().includes(q)
            || (a.medal_number && a.medal_number.toLowerCase().includes(q))
            || (a.chip_number && a.chip_number.toLowerCase().includes(q))
        })
        .filter((a) => !lines.some((l) => l.animal_id === a.id))
        .slice(0, 8)
    : []

  function handleAddAnimal(animal: AnimalLite) {
    startTransition(async () => {
      const res = await addVetVisitLine({ visit_id: visit.id, animal_id: animal.id })
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        const newLine: VetVisitLineWithAnimal = {
          ...res.data,
          animal: {
            id: animal.id,
            name: animal.name,
            species: animal.species,
            medal_number: animal.medal_number,
            breed: animal.breed,
            breed_cross: animal.breed_cross,
            color: animal.color,
            box_id: animal.box_id,
            chip_number: animal.chip_number,
          },
        }
        setLines((prev) => [...prev, newLine])
        setSearch('')
        setShowAddPanel(false)
        toast.success(`${animal.name} ajouté au planning`)
      }
    })
  }

  function handleToggleAct(lineId: string, actKey: VetVisitActKey) {
    setLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l
      const acts = { ...(l.acts || {}) }
      acts[actKey] = !acts[actKey]
      return { ...l, acts }
    }))

    const line = lines.find((l) => l.id === lineId)
    if (!line) return
    const updatedActs = { ...(line.acts || {}), [actKey]: !line.acts?.[actKey] }

    void updateVetVisitLine(lineId, { acts: updatedActs }).then((res) => {
      if (res.error) toast.error(res.error)
    })
  }

  function handleFieldChange(lineId: string, field: 'chip_number' | 'observations' | 'complement' | 'cost' | 'weight', value: string) {
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, [field]: field === 'cost' || field === 'weight' ? (value ? parseFloat(value) : null) : (value || null) } : l))

    void updateVetVisitLine(lineId, {
      [field]: field === 'cost' || field === 'weight' ? (value ? parseFloat(value) : null) : value,
    } as Parameters<typeof updateVetVisitLine>[1]).then((res) => {
      if (res.error) toast.error(res.error)
    })
  }

  function handleValidate(lineId: string) {
    setPendingLineId(lineId)
    startTransition(async () => {
      const res = await validateVetVisitLine(lineId)
      setPendingLineId(null)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`✅ ${res.created} acte(s) enregistré(s) sur la fiche animal`)
        router.refresh()
        // Mettre à jour localement
        setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, validated_at: new Date().toISOString() } : l))
      }
    })
  }

  function handleUnvalidate(lineId: string) {
    if (!confirm('Annuler la validation ? Les actes santé déjà créés sur l\'animal NE SERONT PAS supprimés (sécurité). À supprimer manuellement si nécessaire.')) return
    startTransition(async () => {
      const res = await unvalidateVetVisitLine(lineId)
      if (res.error) {
        toast.error(res.error)
      } else {
        setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, validated_at: null } : l))
        toast.success('Validation annulée (actes conservés)')
      }
    })
  }

  function handleDelete(lineId: string, animalName: string) {
    if (!confirm(`Retirer ${animalName} du planning ?`)) return
    startTransition(async () => {
      const res = await deleteVetVisitLine(lineId)
      if (res.error) {
        toast.error(res.error)
      } else {
        setLines((prev) => prev.filter((l) => l.id !== lineId))
        toast.success('Ligne retirée')
      }
    })
  }

  const allLinesValidated = lines.length > 0 && lines.every((l) => l.validated_at !== null)
  const someLinesValidated = lines.some((l) => l.validated_at !== null)
  const recapSent = !!visit.recap_sent_at

  async function handleSendRecap(force: boolean) {
    if (!someLinesValidated) {
      toast.error('Aucune ligne validée à inclure dans le récap.')
      return
    }
    if (recapSent && !force) {
      if (!confirm('Le récap a déjà été envoyé. Renvoyer une nouvelle copie ?')) return
      force = true
    } else if (!recapSent) {
      if (!confirm(`Envoyer le récap PDF par email à la clinique vétérinaire ?`)) return
    }
    const r = await sendVetVisitRecap(visit.id, { force })
    if (r.error) toast.error(r.error)
    else {
      toast.success(`Récap envoyé à ${r.data?.sentTo}`)
      router.refresh()
    }
  }

  async function handleDownloadArchived() {
    const r = await getVetVisitRecapDownloadUrl(visit.id)
    if (r.error || !r.url) {
      toast.error(r.error || 'Téléchargement impossible')
      return
    }
    window.open(r.url, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Méta visite */}
      <div className="bg-surface rounded-xl border border-border p-3 text-xs text-muted flex flex-wrap gap-3">
        {visit.location_label && <span>📍 {visit.location_label}</span>}
        {visit.vet_label && <span>👨‍⚕️ {visit.vet_label}</span>}
        {visit.notes && <span>📝 {visit.notes}</span>}
      </div>

      {/* Bandeau récap véto */}
      {recapSent ? (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Récap envoyé à <strong>{visit.recap_sent_to}</strong>
              {visit.recap_sent_at && ` le ${new Date(visit.recap_sent_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {visit.recap_storage_path && (
              <button
                type="button"
                onClick={handleDownloadArchived}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 flex items-center gap-1"
              >
                <FileDown className="w-3 h-3" />
                Télécharger le PDF archivé
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSendRecap(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface-dark"
            >
              Renvoyer
            </button>
          </div>
        </div>
      ) : someLinesValidated && (
        <div className={`rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 ${allLinesValidated ? 'bg-primary/5 border border-primary/30' : 'bg-surface border border-border'}`}>
          <div className="text-sm">
            {allLinesValidated ? (
              <span className="text-primary font-semibold">✅ Toutes les lignes sont validées — le récap va être envoyé automatiquement.</span>
            ) : (
              <span className="text-muted">{lines.filter((l) => l.validated_at).length} / {lines.length} ligne(s) validée(s). Le récap sera envoyé auto à la dernière validation.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleSendRecap(false)}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 flex items-center gap-1"
          >
            <Mail className="w-3 h-3" />
            Envoyer le récap maintenant
          </button>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-dark border-b border-border">
            <tr>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider sticky left-0 bg-surface-dark z-10">Dossier</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Box</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Prénom</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Race</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Couleur</th>
              {ACT_COLUMNS.map((col) => (
                <th key={col.key} className={`px-1 py-2 text-center font-bold uppercase tracking-wider ${col.color}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: 22, width: 22, fontSize: '9px' }}>
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">N° puce / poids / coût</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Observations</th>
              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider">Complément</th>
              <th className="px-2 py-2 text-center font-bold uppercase tracking-wider sticky right-0 bg-surface-dark z-10">Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={ACT_COLUMNS.length + 9} className="text-center py-8 text-muted">
                  Aucune ligne. Ajoute des animaux au planning.
                </td>
              </tr>
            ) : lines.map((line) => {
              const isValidated = !!line.validated_at
              const isPending = pendingLineId === line.id
              return (
                <tr
                  key={line.id}
                  className={`border-b border-border ${isValidated ? 'bg-success/5' : 'hover:bg-surface-hover'}`}
                >
                  <td className="px-2 py-1.5 sticky left-0 bg-surface z-10">
                    <Link href={`/animals/${line.animal_id}`} className="font-medium hover:text-primary">
                      {line.animal.medal_number || '—'}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{line.animal.box_id ? '🏠' : ''}</td>
                  <td className="px-2 py-1.5 font-semibold">{line.animal.name}</td>
                  <td className="px-2 py-1.5 text-muted">{line.animal.breed || '—'}</td>
                  <td className="px-2 py-1.5 text-muted">{line.animal.color || '—'}</td>
                  {ACT_COLUMNS.map((col) => (
                    <td key={col.key} className={`px-1 py-1.5 text-center ${col.color}`}>
                      <input
                        type="checkbox"
                        checked={!!line.acts?.[col.key]}
                        disabled={isValidated}
                        onChange={() => handleToggleAct(line.id, col.key)}
                        className="cursor-pointer"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      placeholder="Puce 250..."
                      defaultValue={line.chip_number || ''}
                      disabled={isValidated}
                      onBlur={(e) => handleFieldChange(line.id, 'chip_number', e.target.value)}
                      className="w-full px-1.5 py-1 border border-border rounded bg-surface text-xs disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 220 }}>
                    <textarea
                      placeholder="Notes véto (cliquez pour étendre)"
                      defaultValue={line.observations || ''}
                      disabled={isValidated}
                      rows={2}
                      onBlur={(e) => handleFieldChange(line.id, 'observations', e.target.value)}
                      onInput={(e) => {
                        const t = e.currentTarget
                        t.style.height = 'auto'
                        t.style.height = t.scrollHeight + 'px'
                      }}
                      className="w-full px-1.5 py-1 border border-border rounded bg-surface text-xs disabled:opacity-50 resize-y leading-snug"
                      style={{ minHeight: 44 }}
                    />
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 140 }}>
                    <textarea
                      placeholder="CRAINTIF, ARRIVE CASTRÉ..."
                      defaultValue={line.complement || ''}
                      disabled={isValidated}
                      rows={2}
                      onBlur={(e) => handleFieldChange(line.id, 'complement', e.target.value)}
                      onInput={(e) => {
                        const t = e.currentTarget
                        t.style.height = 'auto'
                        t.style.height = t.scrollHeight + 'px'
                      }}
                      className="w-full px-1.5 py-1 border border-border rounded bg-surface text-xs disabled:opacity-50 resize-y leading-snug"
                      style={{ minHeight: 44 }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center sticky right-0 bg-surface z-10">
                    <div className="flex items-center justify-end gap-1">
                      {isValidated ? (
                        <button
                          type="button"
                          onClick={() => handleUnvalidate(line.id)}
                          className="px-2 py-1 rounded text-[10px] bg-success/15 text-success hover:bg-success/25"
                          title="Annuler validation"
                        >
                          ✓ Validé
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleValidate(line.id)}
                          disabled={isPending}
                          className="px-2 py-1 rounded text-[10px] gradient-primary text-white font-semibold hover:opacity-90 disabled:opacity-50"
                          title="Valider et créer les actes santé"
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 inline" /> Valider</>}
                        </button>
                      )}
                      {!isValidated && (
                        <button
                          type="button"
                          onClick={() => handleDelete(line.id, line.animal.name)}
                          className="text-muted hover:text-error p-1"
                          title="Retirer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add panel */}
      <div className="bg-surface rounded-xl border border-border p-3">
        {!showAddPanel ? (
          <button
            type="button"
            onClick={() => setShowAddPanel(true)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Plus className="w-4 h-4" />
            Ajouter un animal au planning
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un animal (nom, médaille, puce)..."
                className="flex-1 px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm"
              />
              <button type="button" onClick={() => { setShowAddPanel(false); setSearch('') }} className="text-muted hover:text-text p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {filteredAnimals.length > 0 && (
              <ul className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-72 overflow-y-auto">
                {filteredAnimals.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => handleAddAnimal(a)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover flex items-center gap-2"
                    >
                      <span className="text-base">{getSpeciesEmoji(a.species)}</span>
                      <span className="font-medium">{a.name}</span>
                      {a.medal_number && <span className="text-xs text-muted">M. {a.medal_number}</span>}
                      <span className="text-xs text-muted">{a.breed || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        💡 Coche les actes prévus pour chaque animal. Quand le passage véto est fait, clique <strong>« Valider »</strong> sur la ligne :
        les actes cochés seront automatiquement enregistrés comme fiche santé sur l&apos;animal (avec le n° de puce reporté si coché, etc.).
      </p>
    </div>
  )
}
