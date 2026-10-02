// ╔══════════════════════════════════════════════════════════════════════╗
// ║  PATRÓN INOCUIDAD M6 — copia esta estructura para M7–M12           ║
// ║                                                                      ║
// ║  Flujo estándar de cada módulo de inocuidad:                        ║
// ║  1. Hook src/hooks/use<Modulo>.ts → lista de registros de la org    ║
// ║  2. PDF  src/lib/pdf/m<N>/        → componente + generador          ║
// ║  3. Esta pantalla: lista (cards) + FAB + bottom-sheet (form)        ║
// ║  4. org_id y IDs sensibles SIEMPRE del contexto de auth             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef } from 'react'
import { Plus, FileDown, X, Loader2, Shield, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { BotonExportarConsolidado } from '@/app/components/BotonExportarConsolidado'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useBotiquin, type M6BotiquinConRancho } from '@/hooks/useBotiquin'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarBotiquinPDF } from '@/lib/pdf/m6/generarBotiquinPDF'
import { generarBotiquinConsolidadoPDF } from '@/lib/pdf/m6/generarBotiquinConsolidadoPDF'
import type { BotiquinPDFProps } from '@/lib/pdf/m6/BotiquinPDF'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import {
  useFirmasRegistro,
  obtenerFirmasParaPdf,
  firmaDetalleAParaPdf,
} from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { FirmaSvg } from '@/app/components/FirmaSvg'
import { useFirmaContext } from '@/context/FirmaContext'

// ── Constantes ───────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Revisión de Materiales de Botiquín de Primeros Auxilios'
const CLAVE_MODULO = 'MXA-F-SC-SIG · Semanal'

interface ArticuloConfig {
  key: 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'
  label: string
}

const ARTICULOS: ArticuloConfig[] = [
  { key: 'parches_curitas', label: 'Parches / Curitas' },
  { key: 'guantes_curacion', label: 'Guantes de curación' },
  { key: 'vendas_tijeras', label: 'Vendas y tijeras' },
  { key: 'gasas_cinta', label: 'Gasas / Cintas' },
  { key: 'desinfectante', label: 'Desinfectante' },
]

type FormState = {
  rancho_id: string
  fecha_verificacion: string
  parches_curitas: boolean
  guantes_curacion: boolean
  vendas_tijeras: boolean
  gasas_cinta: boolean
  desinfectante: boolean
}

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

const FORM_INICIAL: FormState = {
  rancho_id: '',
  fecha_verificacion: hoy(),
  parches_curitas: true,
  guantes_curacion: true,
  vendas_tijeras: true,
  gasas_cinta: true,
  desinfectante: true,
}

const ERRORES_FIRMA_WARNING = [
  'Primero registra tu firma',
  'ya está firmado',
  'Solo un administrador',
  'Primero debe firmar',
  'Quien realizó',
  'Quien verificó',
  'El registro cambió',
  'no admite firmas',
  'no puede firmar registros',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function contarPresentes(r: Pick<FormState, 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'>): number {
  return [r.parches_curitas, r.guantes_curacion, r.vendas_tijeras, r.gasas_cinta, r.desinfectante].filter(Boolean).length
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// Extrae la fecha del mensaje del trigger BOTIQUIN_LIMITE_SEMANAL y arma texto amigable.
function parsearErrorLimite(mensaje: string, singular = 'rancho'): string {
  const fechas = mensaje.match(/\d{2}\/\d{2}\/\d{4}/g)
  const proxima = fechas ? fechas[fechas.length - 1] : null
  return proxima
    ? `Ya registraste el botiquín de este ${singular} esta semana. Podrás registrar el siguiente a partir del ${proxima}.`
    : `Solo se permite un registro de botiquín por semana por ${singular}.`
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ArticuloToggle({
  label,
  activo,
  onToggle,
}: {
  label: string
  activo: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl transition-colors hover:bg-muted"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={`text-xs px-3 py-1 rounded-full transition-colors ${
          activo
            ? 'bg-agro-success-fill text-agro-success-text'
            : 'bg-agro-danger-fill text-agro-danger-text'
        }`}
        style={{ fontWeight: 600 }}
      >
        {activo ? 'Sí' : 'No'}
      </span>
    </button>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function BotiquinPrimerosAuxilios() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { obligatoria } = useFirmaContext()
  const { ranchos } = useRanchos()
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const [registroGuardado, setRegistroGuardado] = useState(false)
  const { registros, loading, refetch } = useBotiquin()

  useEffect(() => {
    if (ranchoInicial) setForm((f) => ({ ...f, rancho_id: ranchoInicial }))
  }, [ranchoInicial])
  const orgNombre = useOrganizacion(profile?.org_id)

  // Firmas del hook (sin imágenes)
  const ids = registros.map((r) => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M6', ids)

  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'form' | 'firma_decision'>('form')
  const [form, setForm] = useState<FormState>({ ...FORM_INICIAL, fecha_verificacion: hoy() })
  const [guardando, setGuardando] = useState(false)
  const [errRancho, setErrRancho] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)
  const [limiteInfo, setLimiteInfo] = useState<{ proxima: string } | null>(null)

  // Estado del paso firma_decision
  const [pendienteFirma, setPendienteFirma] = useState<{
    id: string
    pdfProps: BotiquinPDFProps
    ranchoNombre: string
    fecha: string
  } | null>(null)
  const [miFirmaDecision, setMiFirmaDecision] = useState<{
    tiene: boolean
    trazos?: any
    firma_png?: string
  } | null>(null)
  const [cargandoMiFirmaDecision, setCargandoMiFirmaDecision] = useState(false)
  const firmaPadDecisionRef = useRef<FirmaPadRef>(null)
  const [firmaPadDecisionInfo, setFirmaPadDecisionInfo] = useState({ vacia: true, puntos: 0 })
  const [guardandoFirmaDecision, setGuardandoFirmaDecision] = useState(false)
  const [firmandoDecision, setFirmandoDecision] = useState(false)

  // Verifica si el rancho ya tiene un registro en los 7 días anteriores a la fecha elegida.
  useEffect(() => {
    if (!sheetAbierto || sheetPaso !== 'form' || !form.rancho_id || !form.fecha_verificacion || !profile?.org_id) {
      setLimiteInfo(null)
      return
    }
    let cancelado = false
    const fechaDate = new Date(form.fecha_verificacion + 'T12:00:00')
    const inicio = new Date(fechaDate)
    inicio.setDate(inicio.getDate() - 6)
    const inicioStr = inicio.toISOString().split('T')[0]

    supabase
      .from('m6_botiquin')
      .select('fecha_verificacion')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', form.rancho_id)
      .gte('fecha_verificacion', inicioStr)
      .lte('fecha_verificacion', form.fecha_verificacion)
      .order('fecha_verificacion', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        if (data && data.length > 0) {
          const ultimoDate = new Date(data[0].fecha_verificacion + 'T12:00:00')
          const proximaDate = new Date(ultimoDate)
          proximaDate.setDate(proximaDate.getDate() + 7)
          setLimiteInfo({ proxima: formatFecha(proximaDate.toISOString().split('T')[0]) })
        } else {
          setLimiteInfo(null)
        }
      })
    return () => { cancelado = true }
  }, [sheetAbierto, sheetPaso, form.rancho_id, form.fecha_verificacion, profile?.org_id])

  // Consolidado
  const [sheetConsolidadoAbierto, setSheetConsolidadoAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)
  const [errConsRancho, setErrConsRancho] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  function abrirSheet() {
    setForm({ ...FORM_INICIAL, fecha_verificacion: hoy(), rancho_id: ranchoInicial ?? '' })
    setErrRancho(false)
    setLimiteInfo(null)
    setSheetPaso('form')
    setPendienteFirma(null)
    setMiFirmaDecision(null)
    setSheetAbierto(true)
  }

  function toggleArticulo(key: ArticuloConfig['key']) {
    setForm((f) => ({ ...f, [key]: !f[key] }))
  }

  async function handleGuardar() {
    if (!form.rancho_id) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGuardando(true)
    try {
      const { data, error } = await supabase
        .from('m6_botiquin')
        .insert({
          rancho_id: form.rancho_id,
          fecha_verificacion: form.fecha_verificacion,
          parches_curitas: form.parches_curitas,
          guantes_curacion: form.guantes_curacion,
          vendas_tijeras: form.vendas_tijeras,
          gasas_cinta: form.gasas_cinta,
          desinfectante: form.desinfectante,
          responsable_id: profile.id,
          firma_verificacion: true,
          org_id: profile.org_id,
        })
        .select('id')
        .single()

      if (error) throw error

      toast.success('Registro guardado')
      if (tareaId) setRegistroGuardado(true)
      await refetch()

      // Transicionar al paso firma_decision
      const rancho = ranchos.find((r) => r.id === form.rancho_id)
      const pdfProps: BotiquinPDFProps = {
        folio: (data.id as string).slice(0, 8).toUpperCase(),
        rancho: rancho?.nombre ?? '',
        ranchoCodigo: rancho?.codigo ?? '',
        fechaVerificacion: form.fecha_verificacion,
        parches_curitas: form.parches_curitas,
        guantes_curacion: form.guantes_curacion,
        vendas_tijeras: form.vendas_tijeras,
        gasas_cinta: form.gasas_cinta,
        desinfectante: form.desinfectante,
        responsableNombre: profile.nombre_completo,
      }
      setPendienteFirma({
        id: data.id as string,
        pdfProps,
        ranchoNombre: rancho?.nombre ?? '',
        fecha: form.fecha_verificacion,
      })
      setSheetPaso('firma_decision')

      // Cargar mi_firma para mostrar preview en el panel
      setCargandoMiFirmaDecision(true)
      ;(supabase as any).rpc('mi_firma').then(({ data: fd }: any) => {
        setMiFirmaDecision(fd ?? { tiene: false })
        setCargandoMiFirmaDecision(false)
      }).catch(() => {
        setMiFirmaDecision({ tiene: false })
        setCargandoMiFirmaDecision(false)
      })
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('BOTIQUIN_LIMITE_SEMANAL')) {
        toast.warning(parsearErrorLimite(mensaje, terminosSitio.singular.toLowerCase()), { duration: 7000 })
      } else {
        toast.error(mensaje || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleGuardarFirmaDecision() {
    if (!firmaPadDecisionRef.current) return
    const { png, trazos } = firmaPadDecisionRef.current.exportar()
    setGuardandoFirmaDecision(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('mi_firma_guardar', {
        p_firma_png: png,
        p_trazos: trazos,
        p_event_id: eventId,
      })
      if (error) throw error
      setMiFirmaDecision({ tiene: true, trazos, firma_png: png })
      toast.success('Firma registrada')
    } catch (err: any) {
      console.error('[BotiquinPrimerosAuxilios] guardar firma decision error:', err)
      toast.error('No se pudo guardar la firma')
    } finally {
      setGuardandoFirmaDecision(false)
    }
  }

  async function handleFirmarDecision() {
    if (!pendienteFirma) return
    setFirmandoDecision(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('registro_firmar', {
        p_modulo: 'M6',
        p_registro_id: pendienteFirma.id,
        p_rol_firma: 'realizo',
        p_contenido_sha256: null,
        p_event_id: eventId,
      })
      if (error) throw error

      // Obtener firma con imagen para PDF
      const firmasConImagen = await obtenerFirmasParaPdf('M6', [pendienteFirma.id])
      const firmasReg = firmasConImagen[pendienteFirma.id]

      const pdfPropsConFirma: BotiquinPDFProps = {
        ...pendienteFirma.pdfProps,
        firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
        firmaVerifico: null,
      }
      try {
        await generarBotiquinPDF(pdfPropsConFirma, pendienteFirma.ranchoNombre, pendienteFirma.fecha)
      } catch {
        toast.warning('Registro guardado y firmado — el PDF no se pudo generar. Descárgalo desde el historial.')
      }
      await refetchFirmas()
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (ERRORES_FIRMA_WARNING.some((e) => msg.includes(e))) {
        toast.warning(msg)
      } else {
        console.error('[BotiquinPrimerosAuxilios] firmar decision error:', err)
        toast.error('No se pudo firmar el registro')
      }
    } finally {
      setFirmandoDecision(false)
      setSheetAbierto(false)
      setSheetPaso('form')
      setPendienteFirma(null)
      setMiFirmaDecision(null)
    }
  }

  async function handleDespuesFirma() {
    if (!pendienteFirma) {
      setSheetAbierto(false)
      setSheetPaso('form')
      return
    }
    try {
      await generarBotiquinPDF(pendienteFirma.pdfProps, pendienteFirma.ranchoNombre, pendienteFirma.fecha)
    } catch {
      toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
    }
    setSheetAbierto(false)
    setSheetPaso('form')
    setPendienteFirma(null)
    setMiFirmaDecision(null)
  }

  function handleCerrarSheet() {
    if (sheetPaso === 'firma_decision') {
      // Cerrar sin generar PDF (usuario puede descargar desde el historial)
      setSheetAbierto(false)
      setSheetPaso('form')
      setPendienteFirma(null)
      setMiFirmaDecision(null)
    } else {
      setSheetAbierto(false)
    }
  }

  async function handleDescargarPDF(registro: M6BotiquinConRancho) {
    setGenerandoPDF(registro.id)
    try {
      const firmasConImagen = await obtenerFirmasParaPdf('M6', [registro.id])
      const firmasReg = firmasConImagen[registro.id]
      const pdfProps: BotiquinPDFProps = {
        folio: registro.id.slice(0, 8).toUpperCase(),
        rancho: registro.rancho_nombre,
        ranchoCodigo: registro.rancho_codigo,
        fechaVerificacion: registro.fecha_verificacion,
        parches_curitas: registro.parches_curitas,
        guantes_curacion: registro.guantes_curacion,
        vendas_tijeras: registro.vendas_tijeras,
        gasas_cinta: registro.gasas_cinta,
        desinfectante: registro.desinfectante,
        responsableNombre: profile?.nombre_completo ?? 'Responsable',
        firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
        firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
      }
      await generarBotiquinPDF(pdfProps, registro.rancho_nombre, registro.fecha_verificacion)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoConsolidado(true)
    try {
      const { data, error } = await supabase
        .from('m6_botiquin')
        .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', consRanchoId)
        .gte('fecha_verificacion', consDesde)
        .lte('fecha_verificacion', consHasta)
        .order('fecha_verificacion', { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) {
        toast.warning(`No hay registros en ese rango de fechas para ${terminosSitio.genero === 'f' ? 'la' : 'el'} ${terminosSitio.singular.toLowerCase()} seleccionado`)
        return
      }

      const rancho = ranchos.find((r) => r.id === consRanchoId)
      const ranchoNombre = rancho?.nombre ?? 'Rancho'

      // Obtener firmas para todos los registros
      const idsConsol = (data as any[]).map((r) => r.id)
      const firmasMapa = await obtenerFirmasParaPdf('M6', idsConsol)

      const propsList: BotiquinPDFProps[] = (data as any[]).map((r) => {
        const firmasReg = firmasMapa[r.id]
        return {
          folio: (r.id as string).slice(0, 8).toUpperCase(),
          rancho: r.ranchos?.nombre ?? ranchoNombre,
          ranchoCodigo: r.ranchos?.codigo ?? '—',
          fechaVerificacion: r.fecha_verificacion,
          parches_curitas: r.parches_curitas,
          guantes_curacion: r.guantes_curacion,
          vendas_tijeras: r.vendas_tijeras,
          gasas_cinta: r.gasas_cinta,
          desinfectante: r.desinfectante,
          responsableNombre: r.profiles?.nombre_completo ?? profile.nombre_completo,
          firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
          firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
        }
      })

      await generarBotiquinConsolidadoPDF(propsList, ranchoNombre, consDesde, consHasta)
      setSheetConsolidadoAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <ModuloHeader tituloFallback={TITULO_MODULO} subtitulo={CLAVE_MODULO} />

      <BannerTareaOrigen tareaId={tareaId} registroGuardado={registroGuardado} />

      {/* Acción consolidado */}
      <div className="px-4 pt-3">
        <BotonExportarConsolidado
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsRancho(false)
            setErrConsFechas(false)
            setSheetConsolidadoAbierto(true)
          }}
        />
      </div>

      {/* Historial */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : registros.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera verificación
            </p>
          </div>
        ) : (
          registros.map((r) => {
            const presentes = contarPresentes(r)
            const completo = presentes === ARTICULOS.length
            return (
              <div
                key={r.id}
                className="bg-card rounded-xl p-4 border"
                style={{
                  borderColor: r.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
                  backgroundColor: r.requiere_correccion ? 'var(--agro-warning-fill)' : undefined,
                }}
              >
                {r.requiere_correccion && r.comentario_correccion && (
                  <div
                    className="flex items-start gap-2 mb-3 text-xs rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--agro-warning-text)' }}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {r.comentario_correccion}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {orgNombre && (
                        <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                      )}
                      <span
                        className="text-sm text-foreground truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {r.rancho_nombre}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded flex-shrink-0 ${
                          completo
                            ? 'bg-agro-success-fill text-agro-success-text'
                            : 'bg-agro-warning-fill text-agro-warning-text'
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {presentes}/{ARTICULOS.length} artículos
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFecha(r.fecha_verificacion)}
                    </p>
                    {r.creado_por_nombre !== '—' && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Por: {r.creado_por_nombre}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDescargarPDF(r)}
                    disabled={generandoPDF === r.id}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                    title="Descargar PDF"
                  >
                    {generandoPDF === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Chips de artículos */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {ARTICULOS.map((a) => {
                    const tiene = r[a.key]
                    return (
                      <span
                        key={a.key}
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          tiene
                            ? 'bg-agro-success-fill text-agro-success-text'
                            : 'bg-agro-danger-fill text-agro-danger-text'
                        }`}
                      >
                        {a.label}
                      </span>
                    )
                  })}
                </div>

                {/* Firmas del registro */}
                <FirmasRegistro
                  modulo="M6"
                  registroId={r.id}
                  fechaRegistro={r.fecha_verificacion}
                  firma={firmas[r.id]}
                  loadingFirmas={loadingFirmas}
                  onFirmado={async () => {
                    await refetch()
                    await refetchFirmas()
                  }}
                />
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nueva verificación" />

      {/* Bottom Sheet — exportar consolidado */}
      <BottomSheet open={sheetConsolidadoAbierto} onClose={() => setSheetConsolidadoAbierto(false)}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Exportar consolidado
              </h2>
              <button onClick={() => setSheetConsolidadoAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Sitio */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => { setConsRanchoId(e.target.value); setErrConsRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsRancho ? 'border-agro-red' : 'border-border'
                  } ${!consRanchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errConsRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              {/* Desde */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border'
                  }`}
                />
              </div>

              {/* Hasta */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errConsFechas && <p className="text-xs text-agro-red mt-1">Indica el rango de fechas</p>}
              </div>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar PDF consolidado
              </button>
            </div>
      </BottomSheet>

      {/* Bottom Sheet — formulario / firma_decision */}
      <BottomSheet open={sheetAbierto} onClose={handleCerrarSheet} height="85%">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header sheet */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                {sheetPaso === 'form' ? 'Nueva verificación' : 'Firmar registro'}
              </h2>
              <button
                onClick={handleCerrarSheet}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {sheetPaso === 'form' ? (
              <>
                {/* Campos del formulario */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* Sitio */}
                  <div>
                    <label
                      className="block text-xs text-muted-foreground mb-1.5"
                      style={{ fontWeight: 600 }}
                    >
                      {terminosSitio.singular.toUpperCase()} *
                    </label>
                    <select
                      value={form.rancho_id}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, rancho_id: e.target.value }))
                        setErrRancho(false)
                      }}
                      className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                        errRancho ? 'border-agro-red' : 'border-border'
                      } ${!form.rancho_id ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      <option value="" disabled>
                        Seleccionar {terminosSitio.singular.toLowerCase()}
                      </option>
                      {ranchoOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {errRancho && (
                      <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>
                    )}
                  </div>

                  {/* Fecha */}
                  <div>
                    <label
                      className="block text-xs text-muted-foreground mb-1.5"
                      style={{ fontWeight: 600 }}
                    >
                      FECHA DE VERIFICACIÓN *
                    </label>
                    <input
                      type="date"
                      value={form.fecha_verificacion}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, fecha_verificacion: e.target.value }))
                      }
                      className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Aviso límite semanal */}
                  {limiteInfo && (
                    <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid #F5A623' }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                      <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                        Ya existe un registro para este {terminosSitio.singular.toLowerCase()} en los últimos 7 días.{' '}
                        Próximo registro disponible:{' '}
                        <span style={{ fontWeight: 600 }}>{limiteInfo.proxima}</span>
                      </p>
                    </div>
                  )}

                  {/* Artículos */}
                  <div>
                    <label
                      className="block text-xs text-muted-foreground mb-2"
                      style={{ fontWeight: 600 }}
                    >
                      ARTÍCULOS EN BOTIQUÍN
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Todos activados por defecto. Desactiva lo que NO haya.
                    </p>
                    <div className="space-y-2">
                      {ARTICULOS.map((a) => (
                        <ArticuloToggle
                          key={a.key}
                          label={a.label}
                          activo={form[a.key]}
                          onToggle={() => toggleArticulo(a.key)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Responsable (read-only) */}
                  <div>
                    <label
                      className="block text-xs text-muted-foreground mb-1.5"
                      style={{ fontWeight: 600 }}
                    >
                      RESPONSABLE
                    </label>
                    <div className="h-11 px-3 rounded-lg bg-muted border border-border flex items-center">
                      <span className="text-sm text-muted-foreground">
                        {profile?.nombre_completo ?? '—'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Guardar */}
                <div className="p-4 border-t border-border flex-shrink-0">
                  <button
                    onClick={handleGuardar}
                    disabled={guardando || !!limiteInfo}
                    className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                    Guardar y generar PDF
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Paso firma_decision */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-base" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                      ¿Firmar como Realizó?
                    </p>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Puedes firmar ahora o hacerlo después desde la lista de registros.
                    </p>
                  </div>

                  {cargandoMiFirmaDecision ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  ) : miFirmaDecision?.tiene ? (
                    /* Preview de la firma del usuario */
                    <div
                      className="rounded-lg border p-3"
                      style={{ backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                    >
                      {miFirmaDecision.trazos && Array.isArray(miFirmaDecision.trazos) && miFirmaDecision.trazos.length > 0 ? (
                        <FirmaSvg
                          trazos={miFirmaDecision.trazos}
                          className="h-20 w-auto"
                          style={{ color: 'var(--foreground)' } as any}
                        />
                      ) : miFirmaDecision.firma_png ? (
                        <img
                          src={miFirmaDecision.firma_png}
                          alt="Tu firma"
                          className="h-20 w-auto"
                          style={{ backgroundColor: '#fff' }}
                        />
                      ) : (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                          Firma guardada
                        </p>
                      )}
                    </div>
                  ) : (
                    /* No tiene firma → FirmaPad */
                    <div className="space-y-2">
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
                        Primero registra tu firma para poder firmar registros
                      </p>
                      <FirmaPad
                        ref={firmaPadDecisionRef}
                        onChange={(info) => setFirmaPadDecisionInfo(info)}
                      />
                      <button
                        onClick={handleGuardarFirmaDecision}
                        disabled={guardandoFirmaDecision || firmaPadDecisionInfo.puntos < 15}
                        className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
                        style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                      >
                        {guardandoFirmaDecision ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : 'Guardar mi firma'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer firma_decision */}
                <div className="p-4 border-t border-border flex-shrink-0 flex gap-3">
                  {!obligatoria && (
                    <button
                      onClick={handleDespuesFirma}
                      className="flex-1 h-14 rounded-3xl border font-semibold"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      Después
                    </button>
                  )}
                  <button
                    onClick={handleFirmarDecision}
                    disabled={firmandoDecision || !miFirmaDecision?.tiene}
                    className="flex-1 h-14 rounded-3xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-agro-blue"
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    {firmandoDecision && <Loader2 className="w-4 h-4 animate-spin" />}
                    {obligatoria ? 'Firmar y generar PDF' : 'Firmar'}
                  </button>
                </div>
              </>
            )}
      </BottomSheet>
    </div>
  )
}
