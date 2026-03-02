'use client'

export const MEDIA_TAGS = [
  'פרגולה קלאסית',
  'פרגולה היי-טק',
  'פרגולה למטבח חוץ',
  'פרגולה ביוקלמטיק',
  'פרגולה pvc',
  'פרגולה תלויה',
  'פרגולה דמוי עץ',
  'פרגולה יוקרה עם כיסוי זכוכית',
] as const

export type MediaTag = (typeof MEDIA_TAGS)[number]

interface TagSelectorProps {
  selected: string[]
  onChange: (tags: string[]) => void
  label?: string
}

export function TagSelector({ selected, onChange, label }: TagSelectorProps) {
  function toggle(tag: string) {
    onChange(
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag],
    )
  }

  return (
    <div>
      {label && <p className="text-sm text-white/70 mb-2">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {MEDIA_TAGS.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-white/5 border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
