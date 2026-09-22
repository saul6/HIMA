import { useState, useEffect } from 'react'
import { Paperclip, Upload, Database, ExternalLink, Trash2, ChevronDown, ChevronUp, Loader, X, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useEvidencia } from '@/hooks/useEvidencia'
import { getSignedUrlEvidencia } from '@/lib/storage/audEvidenciaStorage'
import type {
  AudEvidenciaEntityType, AudEvidenciaTipo, AudEvidenciaSnapshot,
} from '@/types/database.types'

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

interface Props {
  entityType: AudEvidenciaEntityType
  entityId: string
  orgId: string
  auditoriaId: string
  cerrada: boolean
  hallazgoId?: string | null
  instanciaId?: string | null
  accionId?: string | null
}

export function EvidenciaPanel({
  entityType, entityId, orgId, auditoriaId, cerrada,
  hallazgoId, instanciaId: _instanciaId, accionId,
}: Props) {
  const hook = useEvidencia(entityType, entityId)

  const [abierto, setAbierto] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showGateway, setShowGateway] = useState(false)
  const [viewSnap, setViewSnap] = useState<AudEvidenciaSnapshot | null>(null)

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null)
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

  // Quitar
  const [quitandoId, setQuitandoId] = useState<string | null>(null)

  useEffect(() => {
    if (abierto && hook.usos.length === 0 && !hook.cargando) {
      hook.cargar()
    }
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showGateway) handleBuscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGateway])

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

  async function handleBuscar(capOverride?: string) {
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
    setGwRelacionandoId(reg.source_record_id)
    try {
      await hook.snapshotDesdeRegistro({
        orgId,
        sourceModuleCode: reg.source_module_code,
        sourceRecordId: reg.source_record_id,
        hallazgoId: hallazgoId ?? null,
        accionId: accionId ?? null,
        criterionCode: null,
      })
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
    if (!uploadFile) return
    setSubiendo(true)
    try {
      await hook.subirExterno({
        file: uploadFile,
        orgId,
        auditoriaId,
        evidenciaTipo: uploadTipo,
        documentoCodigo: uploadCodigo,
      })
      setUploadFile(null)
      setUploadCodigo('')
      setShowUpload(false)
      toast.success('Evidencia añadida')
    } catch (e) {
      console.error('[EvidenciaPanel] subirExterno', e)
      toast.error('No se pudo subir la evidencia. Reintenta.')
    } finally {
      setSubiendo(false)
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
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="flex-shrink-0" style={{ color: hook.usos.length > 0 ? 'var(--primary)' : 'var(--muted-foreground)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            {hook.cargando && abierto
              ? 'Cargando evidencias…'
              : `Evidencias${hook.usos.length > 0 ? ` (${hook.usos.length})` : ''}`
            }
          </span>
        </div>
        {abierto
          ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {abierto && (
        <div className="border-t border-border flex flex-col">
          {/* Lista de evidencias vinculadas */}
          {hook.cargando ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <Loader size={13} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Cargando…</span>
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
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                        style={esAsset
                          ? { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                          : { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                        }
                      >
                        {esAsset ? 'Carga externa' : `M.A.D.Y · ${snap?.source_module_code ?? '?'}`}
                      </span>
                      {asset?.evidencia_tipo && (
                        <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                          {TIPO_LABELS[asset.evidencia_tipo]}
                        </span>
                      )}
                      {asset?.documento_codigo && (
                        <span className="text-[9px] font-mono" style={{ color: 'var(--foreground)' }}>
                          {asset.documento_codigo}
                          {asset.revision ? ` · ${asset.revision}` : ''}
                        </span>
                      )}
                    </div>

                    {snap && (
                      <p className="text-[10px] font-mono break-all" style={{ color: 'var(--muted-foreground)' }}>
                        SHA: {snap.snapshot_hash.slice(0, 16)}…
                        {snap.source_updated_at && (
                          <span className="ml-2">
                            · {new Date(snap.source_updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {esAsset && asset?.storage_path && (
                        <button
                          onClick={() => handleAbrir(asset.storage_path!)}
                          className="flex items-center gap-1 text-[10px] font-semibold h-6 px-2 rounded"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          <ExternalLink size={10} />
                          Abrir
                        </button>
                      )}
                      {!esAsset && snap && (
                        <button
                          onClick={() => setViewSnap(viewSnap?.id === snap.id ? null : snap)}
                          className="flex items-center gap-1 text-[10px] font-semibold h-6 px-2 rounded"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                        >
                          <Database size={10} />
                          Ver JSON
                        </button>
                      )}
                      {!cerrada && (
                        <button
                          onClick={() => handleQuitar(uso.id)}
                          disabled={quitandoId === uso.id}
                          className="flex items-center gap-1 text-[10px] h-6 px-2 rounded disabled:opacity-50 ml-auto"
                          style={{ color: 'var(--agro-danger-text)' }}
                        >
                          {quitandoId === uso.id
                            ? <Loader size={10} className="animate-spin" />
                            : <Trash2 size={10} />
                          }
                          Quitar vínculo
                        </button>
                      )}
                    </div>

                    {viewSnap?.id === snap?.id && snap && (
                      <pre
                        className="text-[9px] p-2 rounded overflow-x-auto max-h-40"
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

          {/* Botones de acción */}
          {!cerrada && (
            <div className="px-4 py-3 flex gap-2 flex-wrap border-t border-border">
              <button
                onClick={() => { setShowUpload(v => !v); setShowGateway(false) }}
                className="flex items-center gap-1 text-[10px] font-semibold h-7 px-3 rounded-lg"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <Upload size={10} />
                Añadir evidencia externa
              </button>
              <button
                onClick={() => { setShowGateway(v => !v); setShowUpload(false) }}
                className="flex items-center gap-1 text-[10px] font-semibold h-7 px-3 rounded-lg"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <Database size={10} />
                Registros M.A.D.Y.
              </button>
            </div>
          )}

          {/* Formulario: subir evidencia externa */}
          {showUpload && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between pt-3">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Subir evidencia externa</p>
                <button onClick={() => setShowUpload(false)}><X size={14} style={{ color: 'var(--muted-foreground)' }} /></button>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Tipo</label>
                <select
                  value={uploadTipo}
                  onChange={e => setUploadTipo(e.target.value as AudEvidenciaTipo)}
                  style={{ ...inputBase, height: '2.25rem' }}
                >
                  {(Object.keys(TIPO_LABELS) as AudEvidenciaTipo[]).map(k => (
                    <option key={k} value={k}>{TIPO_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Código de documento (opcional)</label>
                <input
                  type="text"
                  value={uploadCodigo}
                  onChange={e => setUploadCodigo(e.target.value)}
                  placeholder="Ej. F-FRUS-CAL-07"
                  style={{ ...inputBase, height: '2.25rem' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Archivo <span style={{ color: 'var(--agro-red)' }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv,.txt"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-[11px]"
                  style={{ color: 'var(--foreground)' }}
                />
                {uploadFile && (
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
              <button
                onClick={handleSubirExterno}
                disabled={subiendo || !uploadFile}
                className="w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {subiendo ? <><Loader size={12} className="animate-spin" />Subiendo…</> : 'Subir y vincular'}
              </button>
            </div>
          )}

          {/* Gateway: Evidencia sugerida en M.A.D.Y. */}
          {showGateway && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between pt-3">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Evidencia sugerida en M.A.D.Y.</p>
                <button onClick={() => setShowGateway(false)}>
                  <X size={14} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Tipo de registro</label>
                <select
                  value={gwCapacidad}
                  onChange={e => { setGwCapacidad(e.target.value); handleBuscar(e.target.value) }}
                  style={{ ...inputBase, height: '2.25rem' }}
                >
                  {gwCapacidades.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Desde</label>
                  <input
                    type="date"
                    value={gwDesde}
                    onChange={e => setGwDesde(e.target.value)}
                    style={{ ...inputBase, height: '2.25rem' }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Hasta</label>
                  <input
                    type="date"
                    value={gwHasta}
                    onChange={e => setGwHasta(e.target.value)}
                    style={{ ...inputBase, height: '2.25rem' }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={gwSearch}
                  onChange={e => setGwSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscar() }}
                  placeholder="Buscar por texto…"
                  style={{ ...inputBase, height: '2.25rem', flex: 1, width: 'auto' }}
                />
                <button
                  onClick={() => handleBuscar()}
                  disabled={gwCargando}
                  className="h-9 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  {gwCargando
                    ? <Loader size={12} className="animate-spin" />
                    : 'Buscar'
                  }
                </button>
              </div>

              {/* Resultados */}
              {gwCargando ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader size={12} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Buscando registros…</span>
                </div>
              ) : gwRegistros.length === 0 ? (
                <p className="text-[11px] py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
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
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                        >
                          Origen: M.A.D.Y · {reg.source_module_code.toUpperCase()}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(reg.record_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {reg.responsible_name && (
                          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            · {reg.responsible_name}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                        {reg.title}
                      </p>
                      {reg.human_summary && (
                        <p className="text-[10px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                          {reg.human_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {reg.source_route && (
                          <button
                            onClick={() => window.open(reg.source_route!, '_blank')}
                            className="flex items-center gap-1 text-[10px] h-6 px-2 rounded"
                            style={{ color: 'var(--primary)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                          >
                            <ExternalLink size={10} />
                            Ver en módulo
                          </button>
                        )}
                        <button
                          onClick={() => handleRelacionar(reg)}
                          disabled={!!gwRelacionandoId}
                          className="flex items-center gap-1 text-[10px] font-semibold h-6 px-2 rounded ml-auto disabled:opacity-50"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          {gwRelacionandoId === reg.source_record_id
                            ? <Loader size={10} className="animate-spin" />
                            : <Link2 size={10} />
                          }
                          Relacionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
