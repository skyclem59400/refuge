'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className = '', children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-border/80 transition-colors data-[placeholder]:text-muted ${className}`}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-muted shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className = '', children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={`z-50 min-w-[var(--radix-select-trigger-width)] max-h-[300px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/40 popover-content ${className}`}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className = '', children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={`relative flex w-full select-none items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm outline-none transition-colors
      hover:bg-surface-hover focus:bg-surface-hover
      data-[state=checked]:text-primary-light data-[state=checked]:font-medium
      data-[disabled]:pointer-events-none data-[disabled]:opacity-50
      cursor-pointer ${className}`}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className = '', ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted ${className}`}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className = '', ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={`-mx-1 my-1 h-px bg-border ${className}`}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'
