'use client'

import { DayPicker } from 'react-day-picker'
import { fr } from 'date-fns/locale'

type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className = '', classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={fr}
      weekStartsOn={1}
      showOutsideDays
      className={`rdp-styled p-1 ${className}`}
      classNames={{
        months: 'flex flex-col',
        month: 'space-y-3',
        month_caption: 'flex justify-center pt-1 items-center text-sm font-semibold capitalize',
        caption_label: 'text-sm font-semibold capitalize',
        nav: 'flex items-center justify-between absolute inset-x-1 top-1',
        button_previous:
          'inline-flex items-center justify-center h-7 w-7 rounded-md text-muted hover:text-text hover:bg-surface-hover transition-colors',
        button_next:
          'inline-flex items-center justify-center h-7 w-7 rounded-md text-muted hover:text-text hover:bg-surface-hover transition-colors',
        chevron: 'h-4 w-4 fill-current',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 h-8 text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center justify-center',
        week: 'flex w-full',
        day: 'w-9 h-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
        day_button:
          'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors',
        selected: '!bg-primary !text-white !font-semibold hover:!bg-primary/90',
        today: 'ring-1 ring-primary/40 text-primary-light font-semibold',
        outside: 'text-muted/40',
        disabled: 'text-muted/30 cursor-not-allowed hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  )
}
