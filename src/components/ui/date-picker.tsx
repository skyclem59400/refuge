'use client'

import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'

interface DatePickerProps {
  /** Valeur ISO yyyy-MM-dd */
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  /** Permet d'effacer la valeur */
  clearable?: boolean
  className?: string
  ariaLabel?: string
}

function toIso(date: Date | undefined): string | null {
  if (!date) return null
  return format(date, 'yyyy-MM-dd')
}

function fromIso(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  try {
    return parseISO(value)
  } catch {
    return undefined
  }
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  disabled,
  required,
  id,
  name,
  clearable = true,
  className = '',
  ariaLabel,
}: Readonly<DatePickerProps>) {
  const [open, setOpen] = useState(false)
  const date = fromIso(value)
  const display = date ? format(date, 'dd/MM/yyyy', { locale: fr }) : ''

  return (
    <>
      {/* Hidden input for form submissions */}
      {name && (
        <input type="hidden" name={name} value={value ?? ''} required={required} />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            id={id}
            aria-label={ariaLabel || placeholder}
            disabled={disabled}
            className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-border/80 transition-colors ${className}`}
          >
            <span className={display ? 'text-text' : 'text-muted'}>
              {display || placeholder}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {clearable && date && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      onChange(null)
                    }
                  }}
                  className="text-muted hover:text-text transition-colors p-0.5 -mr-0.5"
                  aria-label="Effacer la date"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <CalendarIcon className="h-4 w-4 text-muted" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onChange(toIso(d))
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </>
  )
}
