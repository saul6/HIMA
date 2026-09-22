import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  AudEvidenciaUso, AudEvidenciaTipo,
  AudEvidenciaEntityType, AudEvidenciaRelationType,
} from '@/types/database.types'
import { subirEvidencia } from '@/lib/storage/audEvidenciaStorage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

export function useEvidencia(
  entityType: AudEvidenciaEntityType,
  entityId: string,
) {
  const [usos, setUsos] = useState<AudEvidenciaUso[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!entityId) return
    setCargando(true)
    try {
      const { data, error } = await tbl('aud_evidencia_uso')
        .select('*, aud_evidencia(*), aud_evidencia_snapshot(*)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at')
      if (error) throw error
      setUsos((data ?? []) as AudEvidenciaUso[])
    } catch (e) {
      console.error('[useEvidencia] cargar', e)
    } finally {
      setCargando(false)
    }
  }, [entityType, entityId])

  async function subirExterno(params: {
    file: File
    orgId: string
    auditoriaId: string
    evidenciaTipo: AudEvidenciaTipo
    documentoCodigo: string
    relationType?: AudEvidenciaRelationType
  }): Promise<void> {
    const { file, orgId, auditoriaId, evidenciaTipo, documentoCodigo, relationType = 'SUPPORTS' } = params
    const ext = file.name.split('.').pop() ?? 'bin'
    const uuid = crypto.randomUUID()
    const path = `${orgId}/auditoria/${auditoriaId}/${uuid}.${ext}`

    await subirEvidencia(path, file)

    const { data: userRes } = await supabase.auth.getUser()
    const { data: asset, error: assetErr } = await tbl('aud_evidencia').insert({
      org_id: orgId,
      evidencia_tipo: evidenciaTipo,
      storage_path: path,
      documento_codigo: documentoCodigo.trim() || null,
      creado_por: userRes?.user?.id ?? null,
    }).select('id').single()
    if (assetErr || !asset) throw assetErr ?? new Error('No se creó el asset')

    const { error: linkErr } = await tbl('aud_evidencia_uso').insert({
      org_id: orgId,
      evidencia_id: asset.id,
      entity_type: entityType,
      entity_id: entityId,
      relation_type: relationType,
    })
    if (linkErr) throw linkErr

    await cargar()
  }

  async function crearSnapshot(params: {
    orgId: string
    snapshotJson: Record<string, unknown>
    sourceModuleCode: string
    sourceRecordId: string
    sourceUpdatedAt: string | null
    auditoriaId: string | null
    hallazgoId: string | null
    accionId: string | null
    instanciaId: string | null
  }): Promise<void> {
    const { data: snapshotId, error } = await (supabase as any).rpc('aud_crear_snapshot_evidencia', {
      p_org_id: params.orgId,
      p_snapshot_json: params.snapshotJson,
      p_source_module_code: params.sourceModuleCode,
      p_source_record_id: params.sourceRecordId,
      p_source_updated_at: params.sourceUpdatedAt ?? null,
      p_source_record_revision: null,
      p_auditoria_id: params.auditoriaId ?? null,
      p_instancia_id: params.instanciaId ?? null,
      p_hallazgo_id: params.hallazgoId ?? null,
      p_accion_id: params.accionId ?? null,
      p_criterion_code: null,
      p_evidence_asset_ids: null,
      p_link_entity_type: entityType,
      p_link_entity_id: entityId,
    })
    if (error) throw error
    void snapshotId
    await cargar()
  }

  async function snapshotDesdeRegistro(params: {
    orgId: string
    sourceModuleCode: string
    sourceRecordId: string
    hallazgoId: string | null
    accionId: string | null
    criterionCode: string | null
  }): Promise<void> {
    const { data: snapshotId, error } = await (supabase as any).rpc('aud_snapshot_desde_registro', {
      p_org_id: params.orgId,
      p_source_module_code: params.sourceModuleCode,
      p_source_record_id: params.sourceRecordId,
      p_hallazgo_id: params.hallazgoId,
      p_accion_id: params.accionId,
      p_criterion_code: params.criterionCode,
      p_link_entity_type: entityType,
      p_link_entity_id: entityId,
    })
    if (error) throw error
    void snapshotId
    await cargar()
  }

  async function quitar(usoId: string): Promise<void> {
    const { error } = await tbl('aud_evidencia_uso').delete().eq('id', usoId)
    if (error) throw error
    setUsos(prev => prev.filter(u => u.id !== usoId))
  }

  return { usos, cargando, cargar, subirExterno, crearSnapshot, snapshotDesdeRegistro, quitar }
}
