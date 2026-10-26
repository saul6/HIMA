import { useState, useEffect, useRef, useId } from 'react'
import { Paperclip, Upload, Database, ExternalLink, Trash2, ChevronDown, ChevronUp, Loader, X, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, useReducedMotion } from 'motion/react'
import { fundidoEntrada } from './motionAuditor'
import { supabase } from '@/lib/supabase'
import { useEvidencia } from '@/hooks/useEvidencia'
import { getSignedUrlEvidencia } from '@/lib/storage/audEvidenciaStorage'
import { useMisPermisos } from '@/hooks/useMisPermisos'
import { ahora, ms, segundos, emitirEvento } from '@/lib/telemetria'
import type {
  AudEvidenciaEntityType, AudEvidenciaTipo, AudEvidenciaSnapshot,
} from '@/types/database.types'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Skeleton } from '@/app/components/ui/skeleton'
import { fechaCorta } from '@/lib/formato'
import { Campo } from '@/app/components/ui-mady/Campo'

const TIPO_LABELS: Record<AudEvidenciaTipo, string> = {
  documento_procedimiento: 'Documento / Procedimiento',
  registro_operativo:      'Registro operativo',
  foto:                    'Foto',
  certificado:             'Certificado',
  contrato:                'Contrato',
  plan_haccp:              'Plan HACCP',
  etiqueta:                'Etiqueta',
  otro:                    'Otro',
}

const CAPABILITY_LABELS: Record<string, string> = {
  TEMPERATURE_RECORD:     'Temperaturas',
  INCIDENT_RECORD:        'Incidencias',
  PEST_MONITORING_RECORD: 'Plagas / Roedores',
  CHEMICAL_INVENTORY:     'Químicos / Insumos',
  WATER_RECORD:           'Agua',
  MAINTENANCE_RECORD:     'Mantenimiento',
  AUTHORIZED_PRODUCT:     'Productos autorizados',
  TRACEABILITY_RECORD:    'Trazabilidad',
}

const FALLBACK_CAPABILITIES = [
  { value: 'TEMPERATURE_RECORD',      label: 'Temperaturas' },
  { value: 'INCIDENT_RECORD',         label: 'Incidencias' },
  { value: 'PEST_MONITORING_RECORD',  label: 'Plagas / Roedores' },
]

interface GwRegistro {
  source_module_code: string
  source_record_id: string
  capability: string
  record_type: string
  title: string
  record_date: string
  human_summary: string | null
  responsible_name: string | null
  source_route: string | null
  updated_at: string | null
}

interface SugeridaRegistro extends GwRegistro {
  relevance: string   // 'HIGH' | 'MEDIUM' | 'LOW'
  preferred: boolean
}

interface Props {
  entityType: AudEvidenciaEntityType
  entityId: string
  orgId: string
  auditoriaId: string
  cerrada: boolean
  hallazgoId?: string | null
  instanciaId?: string | null
  accionId?: string | null
  preguntaId?: string | null
  criterionCode?: string | null
  ranchoId?: string | null
}

export function EvidenciaPanel({
  entityType, entityId, orgId, auditoriaId, cerrada,
  hallazgoId, instanciaId: _instanciaId, accionId,
  preguntaId, criterionCode, ranchoId,
}: Props) {
  const hook = useEvidencia(entityType, entityId)
  const archivosId = useId()
  const cuerpoId = useId()
  const subirId = useId()
  const gatewayId = useId()
  const reducedMotion = useReducedMotion()
  const { can, cargando: cargandoPermisos } = useMisPermisos()
  const canLink      = cargandoPermisos || can('evidence.link')
  const canUpload    = cargandoPermisos || can('evidence.upload')
  const canModuleRead = cargandoPermisos || can('module_record.read')

  const [abierto, setAbierto] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showGateway, setShowGateway] = useState(false)
  const [showFallback, setShowFallback] = useState(!preguntaId)
  const [viewSnap, setViewSnap] = useState<AudEvidenciaSnapshot | null>(null)

  // Upload form
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [progresoSubida, setProgresoSubida] = useState<{ hechas: number; total: number } | null>(null)
  const [uploadTipo, setUploadTipo] = useState<AudEvidenciaTipo>('documento_procedimiento')
  const [uploadCodigo, setUploadCodigo] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  // Gateway state
  const [gwCapacidades, setGwCapacidades] = useState(FALLBACK_CAPABILITIES)
  const [gwCapacidad, setGwCapacidad] = useState(FALLBACK_CAPABILITIES[0].value)
  const [gwDesde, setGwDesde] = useState('')
  const [gwHasta, setGwHasta] = useState('')
  const [gwSearch, setGwSearch] = useState('')
  const [gwRegistros, setGwRegistros] = useState<GwRegistro[]>([])
  const [gwCargando, setGwCargando] = useState(false)
  const [gwRelacionandoId, setGwRelacionandoId] = useState<string | null>(null)

  // Sugeridas state
  const [sugeridas, setSugeridas] = useState<SugeridaRegistro[]>([])
  const [sugeridasCargando, setSugeridasCargando] = useState(false)
  const [sugeridasCargadas, setSugeridasCargadas] = useState(false)
  const [capacidadChips, setCapacidadChips] = useState<{ capability: string; relevance: string }[]>([])

  // Quitar
  const [quitandoId, setQuitandoId] = useState<string | null>(null)

  // Telemetría de gateway
  const findStartRef      = useRef<number | null>(null)
  const searchCountRef    = useRef(0)
  const linkClickCountRef = useRef(0)
  const findEmittedRef    = useRef(false)

  useEffect(() => {
    if (abierto && hook.usos.length === 0 && !hook.cargando) {
      hook.cargar()
    }
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showGateway) {
      findStartRef.current = ahora()
      searchCountRef.current = 0
      linkClickCountRef.current = 0
      findEmittedRef.current = false
      handleBuscar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGateway])

  useEffect(() => {
    if (abierto && preguntaId && !sugeridasCargadas) {
      cargarSugeridas()
      cargarCapacidadChips()
    }
  }, [abierto, preguntaId]) // eslint-disable-line

  useEffect(() => {
    async function cargarCapacidades() {
      try {
        const { data, error } = await supabase
          .from('module_capability')
          .select('capabilities')
          .eq('tiene_adaptador', true)
        if (error) throw error
        const rows = (data ?? []) as { capabilities: string[] }[]
        const values = Array.from(new Set(rows.flatMap(r => r.capabilities ?? []))).sort()
        if (values.length === 0) return
        setGwCapacidades(values.map(v => ({ value: v, label: CAPABILITY_LABELS[v] ?? v })))
        setGwCapacidad(prev => values.includes(prev) ? prev : values[0])
      } catch (e) {
        console.error('[EvidenciaPanel] cargarCapacidades', e)
      }
    }
    cargarCapacidades()
  }, [])

  async function cargarSugeridas() {
    setSugeridasCargando(true)
    try {
      const { data, error } = await (supabase as any).rpc('aud_evidencia_sugerida_criterio', {
        p_org_id: orgId,
        p_pregunta_id: preguntaId,
        p_rancho_id: ranchoId ?? null,
        p_date_from: gwDesde || null,
        p_date_to: gwHasta || null,
      })
      if (error) throw error
      setSugeridas((data ?? []) as SugeridaRegistro[])
      setSugeridasCargadas(true)
    } catch (e) {
      console.error('[EvidenciaPanel] sugeridas', e)
      setSugeridas([])
      setSugeridasCargadas(true)
    } finally {
      setSugeridasCargando(false)
    }
  }

  async function cargarCapacidadChips() {
    try {
      const { data, error } = await (supabase as any).rpc('aud_criterio_capacidades', {
        p_pregunta_id: preguntaId,
      })
      if (error) throw error
      setCapacidadChips((data ?? []) as { capability: string; relevance: string }[])
    } catch (e) {
      console.error('[EvidenciaPanel] capacidadChips', e)
    }
  }

  async function handleBuscar(capOverride?: string) {
    searchCountRef.current++
    const cap = capOverride ?? gwCapacidad
    setGwCargando(true)
    setGwRegistros([])
    try {
      const { data, error } = await (supabase as any).rpc('aud_listar_registros_auditables', {
        p_org_id: orgId,
        p_capability: cap || null,
        p_date_from: gwDesde || null,
        p_date_to: gwHasta || null,
        p_search: gwSearch.trim() || null,
      })
      if (error) throw error
      setGwRegistros((data ?? []) as GwRegistro[])
    } catch (e) {
      console.error('[EvidenciaPanel] buscarRegistros', e)
      toast.error('No se pudieron cargar los registros. Reintenta.')
    } finally {
      setGwCargando(false)
    }
  }

  async function handleRelacionar(reg: GwRegistro) {
    linkClickCountRef.current++
    if (!findEmittedRef.current && findStartRef.current !== null) {
      findEmittedRef.current = true
      emitirEvento('T_find_evidence', segundos(findStartRef.current), { auditoriaId })
    }
    const t0 = ahora()
    setGwRelacionandoId(reg.source_record_id)
    try {
      await hook.snapshotDesdeRegistro({
        orgId,
        sourceModuleCode: reg.source_module_code,
        sourceRecordId: reg.source_record_id,
        hallazgoId: hallazgoId ?? null,
        accionId: accionId ?? null,
        criterionCode: criterionCode ?? null,
      })
      emitirEvento('T_link_evidence', ms(t0), { auditoriaId })
      emitirEvento('searches_per_criterion', searchCountRef.current, { auditoriaId })
      emitirEvento('clicks_to_link_evidence', linkClickCountRef.current, { auditoriaId })
      toast.success('Registro vinculado como evidencia')
      setShowGateway(false)
    } catch (e) {
      console.error('[EvidenciaPanel] relacionar', e)
      toast.error('No se pudo relacionar el registro. Reintenta.')
    } finally {
      setGwRelacionandoId(null)
    }
  }

  async function handleSubirExterno() {
    if (uploadFiles.length === 0) return
    setSubiendo(true)
    const archivos = [...uploadFiles]
    const fallidos: { file: File; motivo: string }[] = []
    let hechas = 0
    setProgresoSubida({ hechas: 0, total: archivos.length })
    for (const file of archivos) {
      try {
        await hook.subirExterno({
          file,
          orgId,
          auditoriaId,
          evidenciaTipo: uploadTipo,
          documentoCodigo: uploadCodigo,
        })
        hechas += 1
      } catch (e) {
        console.error('[EvidenciaPanel] subirExterno', file.name, e)
        const msg = (e as { message?: string } | null)?.message ?? ''
        fallidos.push({ file, motivo: /size|tamaño|too large|payload/i.test(msg) ? 'el archivo es demasiado grande' : (msg || 'error al subir') })
      }
      setProgresoSubida({ hechas: hechas + fallidos.length, total: archivos.length })
    }
    setProgresoSubida(null)
    setSubiendo(false)
    setUploadFiles(fallidos.map(f => f.file))
    if (fallidos.length === 0) {
      setUploadCodigo('')
      setShowUpload(false)
      toast.success(hechas === 1 ? 'Evidencia añadida' : `${hechas} evidencias añadidas`)
    } else {
      toast.error(
        `${hechas > 0 ? `${hechas} subida${hechas !== 1 ? 's' : ''}. ` : ''}No se pudo subir: ${fallidos.map(f => `${f.file.name} (${f.motivo})`).join('; ')}. Reintenta.`,
        { duration: 9000 },
      )
    }
  }

  async function handleAbrir(storagePath: string) {
    try {
      const url = await getSignedUrlEvidencia(storagePath)
      window.open(url, '_blank')
    } catch (e) {
      console.error('[EvidenciaPanel] getSignedUrl', e)
      toast.error('No se pudo abrir el archivo. Reintenta.')
    }
  }

  async function handleQuitar(usoId: string) {
    setQuitandoId(usoId)
    try {
      await hook.quitar(usoId)
      toast.success('Vínculo eliminado')
    } catch (e) {
      console.error('[EvidenciaPanel] quitar', e)
      toast.error('No se pudo eliminar el vínculo. Reintenta.')
    } finally {
      setQuitandoId(null)
    }
  }

  const inputBase: React.CSSProperties = {
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-background)',
    color: 'var(--foreground)',
    padding: '0.375rem 0.625rem',
    fontSize: '0.8125rem',
    width: '100%',
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={cuerpoId}
        className="w-full flex items-center justify-between px-4 py-3 text-left focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-2">
          <Paperclip aria-hidden="true" size={14} className="flex-shrink-0" style={{ color: hook.usos.length > 0 ? 'var(--primary)' : 'var(--muted-foreground)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {hook.cargando && abierto
              ? <Skeleton className="h-3.5 w-24 inline-block align-middle" />
              : `Evidencias${hook.usos.length > 0 ? ` (${hook.usos.length})` : ''}`
            }
          </span>
        </div>
        {abierto
          ? <ChevronUp aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {abierto && (
        <motion.div id={cuerpoId} {...fundidoEntrada(reducedMotion)} className="border-t border-border flex flex-col">
          {/* Botones de acción */}
          {!cerrada && (canUpload || canLink) && (
            <div className="px-4 py-3 flex gap-2 flex-wrap border-t border-border">
              {canUpload && (
                <Boton aria-expanded={showUpload} aria-controls={subirId} onClick={() => { setShowUpload(v => !v); setShowGateway(false) }}>
                  <Upload aria-hidden="true" size={12} />
                  Subir evidencia
                </Boton>
              )}
              {canLink && (
                <button
                  aria-expanded={showGateway}
                  aria-controls={gatewayId}
                  onClick={() => { setShowGateway(v => !v); setShowFallback(true); setShowUpload(false) }}
                  className="flex items-center gap-1 text-small font-semibold h-7 px-3 rounded-lg relative before:absolute before:content-[''] before:-inset-y-2 before:-inset-x-1"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                >
                  <Database aria-hidden="true" size={10} />
                  Buscar en otro módulo
                </button>
              )}
            </div>
          )}

          {/* Formulario: subir evidencia externa */}
          {showUpload && (
            <div id={subirId} className="px-4 pb-4 flex flex-col gap-3 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between pt-3">
                <p className="text-small font-semibold" style={{ color: 'var(--foreground)' }}>Subir evidencia externa</p>
                <button className="relative before:absolute before:content-[''] before:-inset-[15px]" aria-label="Cerrar" onClick={() => setShowUpload(false)}><X aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} /></button>
              </div>
              <Campo etiqueta="Tipo" className="gap-1" claseEtiqueta="text-caption font-medium">
                {({ id }) => (
                  <select id={id}
                    value={uploadTipo}
                    onChange={e => setUploadTipo(e.target.value as AudEvidenciaTipo)}
                    style={{ ...inputBase, height: '2.25rem' }}
                  >
                    {(Object.keys(TIPO_LABELS) as AudEvidenciaTipo[]).map(k => (
                      <option key={k} value={k}>{TIPO_LABELS[k]}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Código de documento (opcional)" className="gap-1" claseEtiqueta="text-caption font-medium">
                {({ id }) => (
                  <input id={id}
                    type="text"
                    value={uploadCodigo}
                    onChange={e => setUploadCodigo(e.target.value)}
                    placeholder="Ej. F-FRUS-CAL-07"
                    style={{ ...inputBase, height: '2.25rem' }}
                  />
                )}
              </Campo>
              <div className="flex flex-col gap-1">
                <label htmlFor={archivosId} className="text-caption font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Archivos <span aria-hidden="true" style={{ color: 'var(--agro-red)' }}>*</span><span className="sr-only"> obligatorio</span> (puedes elegir varios)
                </label>
                <input
                  id={archivosId}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv,.txt"
                  onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                  className="text-caption"
                  style={{ color: 'var(--foreground)' }}
                />
                {uploadFiles.length > 0 && (
                  <ul className="text-caption flex flex-col gap-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {uploadFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                    ))}
                  </ul>
                )}
              </div>
              <Boton onClick={handleSubirExterno} cargando={subiendo} disabled={uploadFiles.length === 0} className="w-full">
                {uploadFiles.length > 1 ? `Subir ${uploadFiles.length} evidencias` : 'Subir evidencia'}
              </Boton>
              <p role="status" className="text-small min-h-4 -mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {subiendo ? `Subiendo ${progresoSubida ? Math.min(progresoSubida.hechas + 1, progresoSubida.total) : 1} de ${progresoSubida?.total ?? uploadFiles.length}…` : ''}
              </p>
            </div>
          )}

          {/* Lista de evidencias vinculadas */}
          {hook.cargando ? (
            <div className="flex flex-col gap-2 px-4 py-4" aria-busy="true" aria-label="Cargando evidencias">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : hook.usos.length === 0 ? (
            <p className="text-xs px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>Sin evidencias vinculadas.</p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {hook.usos.map(uso => {
                const esAsset = !!uso.aud_evidencia
                const snap = uso.aud_evidencia_snapshot
                const asset = uso.aud_evidencia
                return (
                  <div key={uso.id} className="px-4 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-caption font-bold px-1.5 py-0.5 rounded-full"
                        style={esAsset
                          ? { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                          : { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                        }
                      >
                        {esAsset ? 'Carga externa' : `M.A.D.Y · ${snap?.source_module_code ?? '?'}`}
                      </span>
                      {asset?.evidencia_tipo && (
                        <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                          {TIPO_LABELS[asset.evidencia_tipo]}
                        </span>
                      )}
                      {asset?.documento_codigo && (
                        <span className="text-caption font-mono" style={{ color: 'var(--foreground)' }}>
                          {asset.documento_codigo}
                          {asset.revision ? ` · ${asset.revision}` : ''}
                        </span>
                      )}
                    </div>

                    {snap && (
                      <p className="text-caption font-mono break-all" style={{ color: 'var(--muted-foreground)' }}>
                        SHA: {snap.snapshot_hash.slice(0, 16)}…
                        {snap.source_updated_at && (
                          <span className="ml-2">
                            · {fechaCorta(snap.source_updated_at)}
                          </span>
                        )}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {esAsset && asset?.storage_path && (
                        <Boton onClick={() => handleAbrir(asset.storage_path!)}>
                          <ExternalLink aria-hidden="true" size={10} />
                          Abrir
                        </Boton>
                      )}
                      {!esAsset && snap && (
                        <button
                          onClick={() => setViewSnap(viewSnap?.id === snap.id ? null : snap)}
                          className="flex items-center gap-1 text-small font-semibold h-6 px-2 rounded relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                        >
                          <Database aria-hidden="true" size={10} />
                          Ver JSON
                        </button>
                      )}
                      {!cerrada && (
                        <button
                          onClick={() => handleQuitar(uso.id)}
                          disabled={quitandoId === uso.id}
                          className="flex items-center gap-1 text-small h-6 px-2 rounded disabled:opacity-50 ml-auto relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                          style={{ color: 'var(--agro-danger-text)' }}
                        >
                          {quitandoId === uso.id
                            ? <Loader aria-hidden="true" size={10} className="animate-spin motion-reduce:animate-none" />
                            : <Trash2 aria-hidden="true" size={10} />
                          }
                          Quitar vínculo
                        </button>
                      )}
                    </div>

                    {viewSnap?.id === snap?.id && snap && (
                      <pre
                        className="text-caption p-2 rounded overflow-x-auto max-h-40"
                        style={{
                          backgroundColor: 'var(--muted)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--border)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(snap.snapshot_json, null, 2)}
                      </pre>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Evidencia sugerida por criterio */}
          {!!preguntaId && canModuleRead && (
            <div className="border-t border-border flex flex-col gap-0">
              {/* Header */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <p className="text-small font-semibold" style={{ color: 'var(--foreground)' }}>
                  Evidencia sugerida
                </p>
                {sugeridasCargando && (
                  <Loader aria-hidden="true" size={11} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
                )}
              </div>

              {/* Capacity chips row (only when chips available) */}
              {capacidadChips.length > 0 && (
                <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
                  {capacidadChips.map(chip => {
                    const isHigh = chip.relevance === 'HIGH'
                    const isMed = chip.relevance === 'MEDIUM'
                    return (
                      <button
                        key={chip.capability}
                        onClick={() => {
                          setGwCapacidad(chip.capability)
                          setShowFallback(true)
                          setShowGateway(true)
                          handleBuscar(chip.capability)
                        }}
                        className="text-caption font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-1"
                        style={isHigh
                          ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                          : isMed
                          ? { backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }
                          : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                        }
                      >
                        {CAPABILITY_LABELS[chip.capability] ?? chip.capability}
                        {' · '}
                        {isHigh ? 'Alta' : isMed ? 'Media' : 'Baja'}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Sugeridas list or empty state */}
              {sugeridasCargando ? (
                <div className="flex items-center gap-2 px-4 pb-3">
                  <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>Buscando evidencia sugerida…</span>
                </div>
              ) : sugeridas.length === 0 && sugeridasCargadas ? (
                <p className="text-caption px-4 pb-3" style={{ color: 'var(--muted-foreground)' }}>
                  Sin evidencia sugerida para este criterio.{' '}
                  <button
                    onClick={() => { setShowFallback(true); setShowGateway(true); setShowUpload(false) }}
                    className="underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Buscar manualmente
                  </button>
                </p>
              ) : sugeridas.length > 0 ? (
                <div className="flex flex-col gap-2 px-4 pb-3 max-h-72 overflow-y-auto">
                  {sugeridas.map(reg => {
                    const isHigh = reg.relevance === 'HIGH'
                    const isMed = reg.relevance === 'MEDIUM'
                    const relLabel = isHigh ? 'Alta' : isMed ? 'Media' : 'Baja'
                    const relStyle = isHigh
                      ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                      : isMed
                      ? { backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }
                      : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                    return (
                      <div
                        key={reg.source_record_id}
                        className="rounded-lg p-3 flex flex-col gap-1.5"
                        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-caption font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                          >
                            M.A.D.Y · {reg.source_module_code.toUpperCase()}
                          </span>
                          <span
                            className="text-caption font-semibold px-1.5 py-0.5 rounded-full"
                            style={relStyle}
                          >
                            {relLabel}
                          </span>
                          {reg.preferred && (
                            <Etiqueta>Sugerido</Etiqueta>
                          )}
                          <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                            {fechaCorta(reg.record_date)}
                          </span>
                          {reg.responsible_name && (
                            <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                              · {reg.responsible_name}
                            </span>
                          )}
                        </div>
                        <p className="text-small font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                          {reg.title}
                        </p>
                        {reg.human_summary && (
                          <p className="text-caption leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                            {reg.human_summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {reg.source_route && (
                            <button
                              onClick={() => window.open(reg.source_route!, '_blank')}
                              className="flex items-center gap-1 text-small h-6 px-2 rounded relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                              style={{ color: 'var(--primary)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                            >
                              <ExternalLink aria-hidden="true" size={10} />
                              Ver en módulo
                            </button>
                          )}
                          {canLink && (
                            <Boton onClick={() => handleRelacionar(reg)} cargando={!!gwRelacionandoId} className="ml-auto">
                              <Link2 aria-hidden="true" size={10} />
                              Relacionar
                            </Boton>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* Gateway: Buscar en otro módulo */}
          {showGateway && (
            <div id={gatewayId} className="px-4 pb-4 flex flex-col gap-3 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between pt-3">
                <p className="text-small font-semibold" style={{ color: 'var(--foreground)' }}>Buscar en otro módulo</p>
                <button className="relative before:absolute before:content-[''] before:-inset-[15px]" aria-label="Cerrar" onClick={() => setShowGateway(false)}>
                  <X aria-hidden="true" size={14} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              </div>

              <Campo etiqueta="Tipo de registro" className="gap-1" claseEtiqueta="text-caption font-medium">
                {({ id }) => (
                  <select id={id}
                    value={gwCapacidad}
                    onChange={e => { setGwCapacidad(e.target.value); handleBuscar(e.target.value) }}
                    style={{ ...inputBase, height: '2.25rem' }}
                  >
                    {gwCapacidades.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                )}
              </Campo>

              <div className="flex gap-2">
                <Campo etiqueta="Desde" className="gap-1 flex-1" claseEtiqueta="text-caption font-medium">
                  {({ id }) => (
                    <input id={id}
                      type="date"
                      value={gwDesde}
                      onChange={e => setGwDesde(e.target.value)}
                      style={{ ...inputBase, height: '2.25rem' }}
                    />
                  )}
                </Campo>
                <Campo etiqueta="Hasta" className="gap-1 flex-1" claseEtiqueta="text-caption font-medium">
                  {({ id }) => (
                    <input id={id}
                      type="date"
                      value={gwHasta}
                      onChange={e => setGwHasta(e.target.value)}
                      style={{ ...inputBase, height: '2.25rem' }}
                    />
                  )}
                </Campo>
              </div>

              <div className="flex gap-2">
                <input
                  aria-label="Buscar por texto"
                  type="text"
                  value={gwSearch}
                  onChange={e => setGwSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscar() }}
                  placeholder="Buscar por texto…"
                  style={{ ...inputBase, height: '2.75rem', flex: 1, width: 'auto' }}
                />
                <Boton onClick={() => handleBuscar()} cargando={gwCargando} className="flex-shrink-0">
                  Buscar
                </Boton>
              </div>

              {/* Resultados */}
              {gwCargando ? (
                <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-label="Buscando registros">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : gwRegistros.length === 0 ? (
                <p className="text-caption py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Sin registros disponibles para esta capacidad.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {gwRegistros.map(reg => (
                    <div
                      key={reg.source_record_id}
                      className="rounded-lg p-3 flex flex-col gap-1.5"
                      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-caption font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                        >
                          Origen: M.A.D.Y · {reg.source_module_code.toUpperCase()}
                        </span>
                        <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                          {fechaCorta(reg.record_date)}
                        </span>
                        {reg.responsible_name && (
                          <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                            · {reg.responsible_name}
                          </span>
                        )}
                      </div>
                      <p className="text-small font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                        {reg.title}
                      </p>
                      {reg.human_summary && (
                        <p className="text-caption leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                          {reg.human_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {reg.source_route && (
                          <button
                            onClick={() => window.open(reg.source_route!, '_blank')}
                            className="flex items-center gap-1 text-small h-6 px-2 rounded relative before:absolute before:content-[''] before:-inset-y-2.5 before:-inset-x-1"
                            style={{ color: 'var(--primary)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                          >
                            <ExternalLink aria-hidden="true" size={10} />
                            Ver en módulo
                          </button>
                        )}
                        {canLink && (
                          <Boton onClick={() => handleRelacionar(reg)} cargando={!!gwRelacionandoId} className="ml-auto">
                            <Link2 aria-hidden="true" size={10} />
                            Relacionar
                          </Boton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
