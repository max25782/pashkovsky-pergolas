interface CatalogCoverProps {
  companyName: string
  subtitleHe: string
}

export function CatalogCover({ companyName, subtitleHe }: CatalogCoverProps) {
  return (
    <header className="catalog-cover relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-6 py-14 text-center text-white shadow-xl sm:px-10 sm:py-20 print:border-neutral-300 print:bg-neutral-900 print:shadow-none">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 print:opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 45%), radial-gradient(circle at 80% 60%, rgba(200,200,255,0.08), transparent 40%)',
        }}
      />
      <p className="relative text-xs font-semibold uppercase tracking-[0.35em] text-white/70 sm:text-sm">
        אלומיניום · עיצוב · התקנה
      </p>
      <h1 className="relative mt-4 font-black text-3xl leading-tight sm:text-5xl md:text-6xl">{companyName}</h1>
      <p className="relative mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/85 sm:text-xl">{subtitleHe}</p>
    </header>
  )
}
