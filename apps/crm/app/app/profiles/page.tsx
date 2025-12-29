export default function ProfilesPage() {
  // TODO: Implement profiles page for CRM
  // This page should be implemented separately from the site
  
  const items: any[] = []

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white py-20">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
            פרופילים אלומיניום
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            מגוון רחב של פרופילי אלומיניום איכותיים לכל צורך - מפרגולות ומעקות ועד תאורה ועיצוב
          </p>
        </div>

        {/* Empty State */}
        <div className="text-center py-20">
          <p className="text-white/60 text-lg">
            This page is under construction
          </p>
        </div>
      </div>
    </main>
  )
}

