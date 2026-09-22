import { useState, useEffect } from 'react'
import { Paperclip, Upload, Database, ExternalLink, Trash2, ChevronDown, ChevronUp, Loader, X } from 'lucide-react'
import { toast } from 'sonner'
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
  hallazgoId, instanciaId, accionId,
}: Props) {
  const hook = useEvidencia(entityType, entityId)

  const [abierto, setAbierto] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [viewSnap, setViewSnap] = useState<AudEvidenciaSnapshot | null>(null)

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState<AudEvidenciaTipo>('documento_procedimiento')
  const [uploadCodigo, setUploadCodigo] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  // Snapshot form
  const [snapModule, setSnapModule] = useState('')
  const [snapRecordId, setSnapRecordId] = useState('')
  const [snapJsonStr, setSnapJsonStr] = useState('')
  const [snapUpdatedAt, setSnapUpdatedAt] = useState('')
  const [creandoSnap, setCreandoSnap] = useState(false)

  // Quitar
  const [quitandoId, setQuitandoId] = useState<string | null>(null)

  useEffect(() => {
    if (abierto && hook.usos.length === 0 && !hook.cargando) {
      hook.cargar()
    }
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleCrearSnapshot() {
    if (!snapModule.trim() || !snapRecordId.trim() || !snapJsonStr.trim()) return
    let json: Record<string, unknown>
    try {
      json = JSON.parse(snapJsonStr)
    } catch {
      toast.error('El JSON no es válido. Revísalo y vuelve a intentar.')
      return
    }
    setCreandoSnap(true)
    try {
      await hook.crearSnapshot({
        orgId,
        snapshotJson: json,
        sourceModuleCode: snapModule.trim().toLowerCase(),
        sourceRecordId: snapRecordId.trim(),
        sourceUpdatedAt: snapUpdatedAt || null,
        auditoriaId,
        hallazgoId: hallazgoId ?? null,
        accionId: accionId ?? null,
        instanciaId: instanciaId ?? null,
      })
      setSnapModule('')
      setSnapRecordId('')
      setSnapJsonStr('')
      setSnapUpdatedAt('')
      setShowSnapshot(false)
      toast.success('Snapshot creado y vinculado')
    } catch (e) {
      console.error('[EvidenciaPanel] crearSnapshot', e)
      toast.error('No se pudo crear el snapshot. Reintenta.')
    } finally {
      setCreandoSnap(false)
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
                    {/* Origen badge */}
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

                    {/* Snapshot info */}
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

                    {/* Acciones */}
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

                    {/* JSON viewer inline */}
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
                onClick={() => { setShowUpload(v => !v); setShowSnapshot(false) }}
                className="flex items-center gap-1 text-[10px] font-semibold h-7 px-3 rounded-lg"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <Upload size={10} />
                Añadir evidencia externa
              </button>
              <button
                onClick={() => { setShowSnapshot(v => !v); setShowUpload(false) }}
                className="flex items-center gap-1 text-[10px] font-semibold h-7 px-3 rounded-lg"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <Database size={10} />
                Relacionar registro M.A.D.Y.
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

          {/* Formulario: snapshot de registro M.A.D.Y. */}
          {showSnapshot && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between pt-3">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Snapshot de registro M.A.D.Y.</p>
                <button onClick={() => setShowSnapshot(false)}><X size={14} style={{ color: 'var(--muted-foreground)' }} /></button>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                Congela el estado actual de un registro operativo. El hash se calcula en el servidor. Pega el JSON del registro tal cual aparece en la tabla de BD.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Módulo <span style={{ color: 'var(--agro-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={snapModule}
                  onChange={e => setSnapModule(e.target.value)}
                  placeholder="Ej. m41, m22, m13…"
                  style={{ ...inputBase, height: '2.25rem' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  ID del registro (UUID) <span style={{ color: 'var(--agro-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={snapRecordId}
                  onChange={e => setSnapRecordId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={{ ...inputBase, height: '2.25rem' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Fecha de actualización del registro (opcional)</label>
                <input
                  type="datetime-local"
                  value={snapUpdatedAt}
                  onChange={e => setSnapUpdatedAt(e.target.value)}
                  style={{ ...inputBase, height: '2.25rem' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  JSON del registro <span style={{ color: 'var(--agro-red)' }}>*</span>
                </label>
                <textarea
                  value={snapJsonStr}
                  onChange={e => setSnapJsonStr(e.target.value)}
                  rows={5}
                  placeholder={'{\n  "id": "...",\n  "fecha": "...",\n  ...\n}'}
                  className="resize-none text-[11px] font-mono outline-none"
                  style={{
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--input-background)',
                    color: 'var(--foreground)',
                    padding: '0.375rem 0.625rem',
                  }}
                />
              </div>
              <button
                onClick={handleCrearSnapshot}
                disabled={creandoSnap || !snapModule.trim() || !snapRecordId.trim() || !snapJsonStr.trim()}
                className="w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {creandoSnap ? <><Loader size={12} className="animate-spin" />Creando snapshot…</> : 'Crear snapshot y vincular'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
