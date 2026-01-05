'use client'

import * as React from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Checkbox({ className, checked, onCheckedChange, ...props }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked)
    }
  }

  return (
    <label className={clsx('relative inline-flex items-center cursor-pointer', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="sr-only"
        {...props}
      />
      <div
        className={clsx(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          checked
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white/10 border-white/20 hover:border-white/30'
        )}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
    </label>
  )
}

