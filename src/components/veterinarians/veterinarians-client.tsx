'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Building2,
  Pencil,
  Trash2,
  Plus,
  Power,
  Star,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  User,
  Loader2,
  X,
} from 'lucide-react'
import {
  createVeterinaryClinic,
  updateVeterinaryClinic,
  deleteVeterinaryClinic,
  createVeterinarian,
  updateVeterinarian,
  deleteVeterinarian,
} from '@/lib/actions/veterinarians'
import type { VeterinaryClinic, Veterinarian, VeterinaryClinicWithVets } from '@/lib/types/database'

interface VeterinariansClientProps {
  clinics: VeterinaryClinicWithVets[]
}

export function VeterinariansClient({ clinics }: Readonly<VeterinariansClientProps>) {
  const [showClinicForm, setShowClinicForm] = useState(false)
  const [editingClinic, setEditingClinic] = useState<VeterinaryClinic | null>(null)
  const [showVetForm, setShowVetForm] = useState<{ clinicId: string; vet: Veterinarian | null } | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleNewClinic() {
    setEditingClinic(null)
    setShowClinicForm(true)
  }

  function handleEditClinic(clinic: VeterinaryClinic) {
    setEditingClinic(clinic)
    setShowClinicForm(true)
  }

  function handleDeleteClinic(clinic: VeterinaryClinic) {
    if (!window.confirm(`Supprimer la clinique "${clinic.name}" et tous ses praticiens ?`)) return
    setActingId(clinic.id)
    startTransition(async () => {
      const result = await deleteVeterinaryClinic(clinic.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Clinique supprimee')
        router.refresh()
      }
    })
  }

  function handleToggleClinicActive(clinic: VeterinaryClinic) {
    setActingId(clinic.id)
    startTransition(async () => {
      const result = await updateVeterinaryClinic(clinic.id, { is_active: !clinic.is_active })
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(clinic.is_active ? 'Clinique desactivee' : 'Clinique reactivee')
        router.refresh()
      }
    })
  }

  function handleNewVet(clinicId: string) {
    setShowVetForm({ clinicId, vet: null })
  }

  function handleEditVet(clinicId: string, vet: Veterinarian) {
    setShowVetForm({ clinicId, vet })
  }

  function handleDeleteVet(vet: Veterinarian) {
    if (!window.confirm(`Supprimer le veterinaire "${vet.last_name}" ?`)) return
    setActingId(vet.id)
    startTransition(async () => {
      const result = await deleteVeterinarian(vet.id)
      setActingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Veterinaire supprime')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {!showClinicForm && (
        <div>
          <button
            type="button"
            onClick={handleNewClinic}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvelle clinique
          </button>
        </div>
      )}

      {showClinicForm && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold mb-4">
            {editingClinic ? `Modifier "${editingClinic.name}"` : 'Nouvelle clinique veterinaire'}
          </h2>
          <ClinicForm
            clinic={editingClinic}
            onClose={() => {
              setShowClinicForm(false)
              setEditingClinic(null)
            }}
          />
        </div>
      )}

      {clinics.length === 0 && !showClinicForm ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Building2 className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucune clinique enregistree.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clinics.map((clinic) => (
            <div key={clinic.id} className={`bg-surface rounded-xl border border-border p-5 ${!clinic.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-semibold">{clinic.name}</h3>
                    {clinic.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary">
                        <Star className="w-3 h-3" />
                        Cabinet par defaut
                      </span>
                    )}
                    {!clinic.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted/15 text-muted">Desactive</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted mt-1">
                    {clinic.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {[clinic.address, clinic.postal_code, clinic.city].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {clinic.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{clinic.phone}</span>}
                    {clinic.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{clinic.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleToggleClinicActive(clinic)} disabled={isPending && actingId === clinic.id} className="p-2 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50" title={clinic.is_active ? 'Desactiver' : 'Reactiver'}>
                    {isPending && actingId === clinic.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => handleEditClinic(clinic)} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Modifier"><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={() => handleDeleteClinic(clinic)} disabled={isPending && actingId === clinic.id} className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Praticiens ({clinic.veterinarians.length})
                  </h4>
                  <button type="button" onClick={() => handleNewVet(clinic.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-primary hover:bg-primary/10 transition-colors">
                    <UserPlus className="w-3 h-3" />
                    Ajouter un veterinaire
                  </button>
                </div>

                {clinic.veterinarians.length === 0 ? (
                  <p className="text-xs text-muted py-2">Aucun praticien enregistre dans cette clinique.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {clinic.veterinarians.map((vet) => (
                      <li key={vet.id} className={`py-2 flex items-start justify-between gap-3 ${!vet.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="w-3.5 h-3.5 text-muted" />
                            <span className="text-sm font-medium">
                              {vet.first_name ? `${vet.first_name} ${vet.last_name}` : `Dr ${vet.last_name}`}
                            </span>
                            {vet.is_referent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">
                                <Star className="w-2.5 h-2.5" />
                                Referent
                              </span>
                            )}
                            {vet.specialty && <span className="text-xs text-muted">— {vet.specialty}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted mt-0.5">
                            {vet.ordre_number && <span>N° ordre : {vet.ordre_number}</span>}
                            {vet.phone && <span>{vet.phone}</span>}
                            {vet.email && <span>{vet.email}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleEditVet(clinic.id, vet)} className="p-1.5 rounded text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleDeleteVet(vet)} disabled={isPending && actingId === vet.id} className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showVetForm && (
        <VetFormModal
          clinicId={showVetForm.clinicId}
          vet={showVetForm.vet}
          onClose={() => setShowVetForm(null)}
        />
      )}
    </div>
  )
}


function ClinicForm({ clinic, onClose }: Readonly<{ clinic: VeterinaryClinic | null; onClose: () => void }>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(clinic?.name || '')
  const [address, setAddress] = useState(clinic?.address || '')
  const [postalCode, setPostalCode] = useState(clinic?.postal_code || '')
  const [city, setCity] = useState(clinic?.city || '')
  const [phone, setPhone] = useState(clinic?.phone || '')
  const [email, setEmail] = useState(clinic?.email || '')
  const [website, setWebsite] = useState(clinic?.website || '')
  const [siret, setSiret] = useState(clinic?.siret || '')
  const [isDefault, setIsDefault] = useState(clinic?.is_default ?? false)
  const [isActive, setIsActive] = useState(clinic?.is_active ?? true)
  const [notes, setNotes] = useState(clinic?.notes || '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    const payload = {
      name,
      address: address || null,
      postal_code: postalCode || null,
      city: city || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      siret: siret || null,
      notes: notes || null,
      is_default: isDefault,
      is_active: isActive,
    }
    startTransition(async () => {
      const result = clinic
        ? await updateVeterinaryClinic(clinic.id, payload)
        : await createVeterinaryClinic(payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(clinic ? 'Clinique mise a jour' : 'Clinique creee')
        router.refresh()
        onClose()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cl-name" className={labelClass}>Nom de la clinique *</label>
        <input id="cl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label htmlFor="cl-address" className={labelClass}>Adresse</label>
          <input id="cl-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="cl-postal" className={labelClass}>CP</label>
          <input id="cl-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
        </div>
        <div className="md:col-span-3">
          <label htmlFor="cl-city" className={labelClass}>Ville</label>
          <input id="cl-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cl-phone" className={labelClass}>Telephone</label>
          <input id="cl-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="cl-email" className={labelClass}>Email</label>
          <input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cl-website" className={labelClass}>Site web</label>
          <input id="cl-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="cl-siret" className={labelClass}>SIRET</label>
          <input id="cl-siret" type="text" value={siret} onChange={(e) => setSiret(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="cl-notes" className={labelClass}>Notes</label>
        <textarea id="cl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span>Cabinet par defaut</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Actif</span>
        </label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">Annuler</button>
        <button type="submit" disabled={isPending} className="gradient-primary hover:opacity-90 transition-opacity text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {clinic ? 'Mettre a jour' : 'Creer'}
        </button>
      </div>
    </form>
  )
}


function VetFormModal({
  clinicId,
  vet,
  onClose,
}: Readonly<{
  clinicId: string
  vet: Veterinarian | null
  onClose: () => void
}>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [firstName, setFirstName] = useState(vet?.first_name || '')
  const [lastName, setLastName] = useState(vet?.last_name || '')
  const [ordreNumber, setOrdreNumber] = useState(vet?.ordre_number || '')
  const [specialty, setSpecialty] = useState(vet?.specialty || '')
  const [phone, setPhone] = useState(vet?.phone || '')
  const [email, setEmail] = useState(vet?.email || '')
  const [isReferent, setIsReferent] = useState(vet?.is_referent ?? false)
  const [isActive, setIsActive] = useState(vet?.is_active ?? true)
  const [notes, setNotes] = useState(vet?.notes || '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!lastName.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    const payload = {
      clinic_id: clinicId,
      first_name: firstName || null,
      last_name: lastName,
      ordre_number: ordreNumber || null,
      specialty: specialty || null,
      phone: phone || null,
      email: email || null,
      is_referent: isReferent,
      is_active: isActive,
      notes: notes || null,
    }
    startTransition(async () => {
      const result = vet ? await updateVeterinarian(vet.id, payload) : await createVeterinarian(payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(vet ? 'Veterinaire mis a jour' : 'Veterinaire cree')
        router.refresh()
        onClose()
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">{vet ? 'Modifier le veterinaire' : 'Nouveau veterinaire'}</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="vt-first" className={labelClass}>Prenom</label>
              <input id="vt-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="vt-last" className={labelClass}>Nom *</label>
              <input id="vt-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="vt-ordre" className={labelClass}>N° ordre veterinaire</label>
              <input id="vt-ordre" type="text" value={ordreNumber} onChange={(e) => setOrdreNumber(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="vt-specialty" className={labelClass}>Specialite</label>
              <input id="vt-specialty" type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Chirurgie, comportement..." className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="vt-phone" className={labelClass}>Telephone direct</label>
              <input id="vt-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="vt-email" className={labelClass}>Email</label>
              <input id="vt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="vt-notes" className={labelClass}>Notes</label>
            <textarea id="vt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isReferent} onChange={(e) => setIsReferent(e.target.checked)} />
              <span>Veterinaire referent du refuge</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Actif</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover transition-colors">Annuler</button>
            <button type="submit" disabled={isPending} className="gradient-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              {vet ? 'Mettre a jour' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
