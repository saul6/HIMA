import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuditoriaV2 } from '@/hooks/useAuditoriaV2'

// Motor PrimusGFS v3.2 — aislado, sin conectar a M14-M18.
// Pendiente: construir UI completa sobre useAuditoriaV2.
export default function AuditoriasPrimusGFS() {
  const navigate = useNavigate()
  const { bloques, preguntas, loadingCatalogo } = useAuditoriaV2('m14')

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-base font-semibold flex-1">Auditorías PrimusGFS v3.2</h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col items-center justify-center gap-3 text-center">
        {loadingCatalogo ? (
          <p className="text-muted-foreground text-sm">Cargando catálogo…</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Motor PrimusGFS v3.2 en construcción.
            </p>
            <p className="text-xs text-muted-foreground">
              Catálogo cargado: {bloques.length} bloques · {preguntas.length} preguntas (M14)
            </p>
          </>
        )}
      </main>
    </div>
  )
}
