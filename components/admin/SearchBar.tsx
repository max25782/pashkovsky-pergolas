interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = "🔍 Поиск..." }: SearchBarProps) {
  return (
    <div className="relative flex-1 min-w-[300px]">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 focus:bg-white/10 focus:border-white/40 focus:outline-none transition-all"
      />
    </div>
  )
}

