# Inventario Offline — M.A.D.Y (Fases 1 y 2)

> Generado en Fase 1 (2026-10-07), ampliado en Fase 2 (2026-10-07 / Lote A1: 2026-10-08).
> Grupos: **A** simple | **B** matriz mensual | **D** complejo (Fase 3) | **P** piloto (Fase 1) | **X** no aplica

---

## Pilotos Fase 1 (completados)

### M12 — Limpieza y Desinfección de Baños
**Tabla:** `m12_limpieza_banos` · INSERT N filas (una/baño) por jornada, misma fecha+rancho
**Adjuntos:** no · **Límite:** `M12_LIMITE_SEMANAL` · **Crea M13:** no · **Estado:** ✅ Fase 1

### M9 — Monitoreo Perimetral
**Tablas:** `m9_registro_mensual` (UNIQUE rancho_id,mes) → `m9_dias_inspeccion` → `m9_resultados`
**Adjuntos:** no · **Límite:** semanal proactivo · **Crea M13:** no · **Estado:** ✅ Fase 1

### M13 — Reporte de Incidencias
**Tablas:** `m13_reportes` → `m13_incidencias` → `m13_incidencia_fotos` + bucket `incidencias`
**Adjuntos:** sí (JPEG) · **Límite:** no · **Crea M13:** es M13 · **Estado:** ✅ Fase 1

---

## Tabla de inventario completo

| M# | Pantalla | Hooks principales | Cómo guarda | Tablas en orden | Cab. UNIQUE | Adj. bucket | Crea M13 | Límite BD | Grupo | Fase |
|-----|----------|-------------------|-------------|-----------------|-------------|-------------|----------|-----------|-------|------|
| M1 | NuevaAplicacion | useCatalogoProductos | INSERT + INSERT + RPC inventario | aplicaciones, aplicacion_productos | — | No | No | No | D | 3 |
| M2 | Inventario | useInventario | Solo lectura (vistas SQL) | v_inventario_saldo_* | — | No | No | No | X | — |
| M3 | BibliotecaHistorial | — | Solo lectura / merge PDF cliente | — | — | No | No | No | X | — |
| **M6** | BotiquinPrimerosAuxilios | useBotiquin | INSERT | m6_botiquin | — | No | No | BOTIQUIN_LIMITE_SEMANAL | **A** | **2** |
| **M7** | InspeccionVidrioPlastico | useVidrioPlastico, useM7MaterialesRancho | INSERT filas + upsert catálogo previo | m7_materiales_rancho (si nuevos), m7_vidrio_plastico | — | No | No | M7_LIMITE_QUINCENAL | **A** | **2** |
| M8 | RegistroFertilizacion | useM8Fertilizacion, useFertilizantesOrg | INSERT + INSERT + upsert catálogo + inv | fertilizantes_org, m8_fertilizacion, inventario_fertilizantes | — | No | No | No | D | 3 |
| **M9** | InspeccionPerimetral | useM9Perimetral | INSERT cab + INSERT día + INSERT resultados | m9_registro_mensual, m9_dias_inspeccion, m9_resultados | rancho_id,mes | No | No | Proactivo semanal | **P** | 1 |
| **M10** | RegistroCosechaLiberacion | useM10CosechaLiberacion | INSERT (N filas/jornada) | m10_cosecha_liberacion | — | No | No | No | **A** | **2** |
| **M11** | InspeccionPreoperacionalCosecha | useM11Preoperacional | INSERT cab + INSERT día + INSERT resultados | m11_registro_mensual, m11_dias_inspeccion, m11_resultados | rancho_id,mes | No | No | Proactivo diario | **B** | **2** |
| **M12** | RegistroLimpiezaBanos | useM12LimpiezaBanos | INSERT (N filas/jornada) | m12_limpieza_banos | — | No | No | M12_LIMITE_SEMANAL | **P** | 1 |
| **M13** | ReporteIncidencias | useM13Incidencias | INSERT cab + INSERT incidencias + Storage fotos | m13_reportes, m13_incidencias, m13_incidencia_fotos | — | Sí (incidencias) | — | No | **P** | 1 |
| M14 | AuditoriaSaia | useAuditoria(m14) | INSERT auditoría + INSERT respuestas batch | m14_auditorias, m14_respuestas | — | No | No | No | D | 3 |
| M15 | AuditoriaGranja | useAuditoria(m15) | INSERT auditoría + INSERT respuestas batch | m15_auditorias, m15_respuestas | — | No | No | No | D | 3 |
| M16 | AuditoriaCosecha | useAuditoria(m16) | INSERT auditoría + INSERT respuestas batch | m16_auditorias, m16_respuestas | — | No | No | No | D | 3 |
| M17 | AuditoriaBPM | useAuditoria(m17) | INSERT auditoría + INSERT respuestas batch | m17_auditorias, m17_respuestas | — | No | No | No | D | 3 |
| M18 | AuditoriaHACCP | useAuditoria(m18) | INSERT auditoría + INSERT respuestas batch | m18_auditorias, m18_respuestas | — | No | No | No | D | 3 |
| **M19** | InspeccionPreoperacionalCooler | useM19InspeccionPreoperacional | INSERT cab + INSERT día + INSERT resultados + M13 si NO | m19_registro_mensual, m19_dias_inspeccion, m19_resultados, (m13_reportes, m13_incidencias) | rancho_id,mes | No | Sí (NO) | Proactivo diario | **B** | **2** |
| **M20** | RegistroAccidentesLaborales | useM20Accidentes | INSERT accidente + INSERT fotos + Storage | m20_accidentes, m20_accidente_fotos | — | Sí (incidencias) | No | No | **A** | **2** |
| M21 | MonitoreoEstacionesPlagas | useM21EstacionesRancho | RPC resolver_nfc (requiere red) + INSERT revisión | m21_revision, m21_resultado | — | No | No | No | D | 3 |
| **M22** | RegistroMuestrasLaboratorio | useM22Muestras | INSERT | m22_muestras | — | No | No | No | **A** | **2** |
| **M23** | VerificacionInsumos | useM23VerificacionInsumos | INSERT cab + INSERT día + INSERT resultados + M13 si NO | m23_registro_mensual, m23_dias_inspeccion, m23_resultados, (m13_reportes, m13_incidencias) | rancho_id,mes | No | Sí (NO) | Proactivo diario | **B** | **2** |
| M24 | ControlInventarioQuimicos | useM24QuimicosInventario | INSERT movimiento (+ INSERT quimico opcional catálogo) | m24_quimicos, m24_movimientos | — | No | No | No | D | 3 |
| M25 | ResumenNoConformidades | useAuditoriaVisitas | Links NC desde aud_* (flujo especial) | NC de aud_* | — | No | No | No | D | 3 |
| M26 | AccionesCorrectivas | useAccionesCorrectivas | INSERT + Storage fotos + workflow | acciones_correctivas, accion_correctiva_fotos | — | Sí | No | No | D | 3 |
| **M27** | PreparacionCloro | useM27PreparacionCloro | INSERT | m27_preparaciones | — | No | No | No | **A** | **2** |
| **M28** | LimpiezaBanosQuimicos | useM28LimpiezaBanosQuimicos | INSERT cab + INSERT/upsert días + DELETE+upsert resultados | m28_registro_mensual, m28_dias, m28_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M29** | LimpiezaAduana | useM29LimpiezaAduana | INSERT cab + días + upsert resultados | m29_registro_mensual, m29_dias, m29_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M30** | LimpiezaComedor | useM30LimpiezaComedor | INSERT cab + días + upsert resultados | m30_registro_mensual, m30_dias, m30_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M31** | LimpiezaOficinas | useM31LimpiezaOficinas | INSERT cab + días + upsert resultados | m31_registro_mensual, m31_dias, m31_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M32** | LimpiezaPatiosAzoteas | useM32LimpiezaPatiosAzoteas | INSERT cab + días + upsert resultados | m32_registro_mensual, m32_dias, m32_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M33** | LimpiezaRecepcion | useM33LimpiezaRecepcion | INSERT cab + días + upsert resultados | m33_registro_mensual, m33_dias, m33_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M34** | LimpiezaPreenfrio | useM34LimpiezaPreenfrio | INSERT cab + días + upsert resultados | m34_registro_mensual, m34_dias, m34_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M35** | LimpiezaAlmacenEmpaque | useM35LimpiezaAlmacenEmpaque | INSERT cab + días + upsert resultados | m35_registro_mensual, m35_dias, m35_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| **M36** | MonitoreoGermicida | useM36Monitoreos | INSERT | m36_monitoreos | — | No | No | No | **A** | **2** |
| **M37** | LimpiezaCisterna | useM37LimpiezaCisterna | INSERT cab + días + upsert resultados | m37_registro_mensual, m37_dias, m37_resultados | org_id,rancho_id,anio,mes,area | No | No | No | **B** | **2** |
| M38 | ManifiestoEmbarque | useM38Manifiestos | INSERT cab + INSERT lineas + INSERT m13_* explícito | m38_manifiestos, m38_lineas, m13_reportes, m13_incidencias | — | No | Sí | No | D | 3 |
| M39 | RecepcionFruta | useM39Recepciones | INSERT + INSERT lineas + DELETE (depende m48) | m39_recepciones, m39_lineas, m48_lotes_recepcion | — | No | No | No | D | 3 |
| M40 | EntradasSalidasPreFrio | useM40RegistrosPrefrio | INSERT + INSERT lineas | m40_registros, m40_lineas | — | No | No | No | D | 3 |
| M41 | TemperaturasConservador | useM41TemperaturaConservador | INSERT cab + upsert lecturas por hora (continuo) | m41_registros, m41_lecturas | — | No | No | No | D | 3 |
| M42 | MaterialEmpaqueMovimientos | useM42Movimientos | INSERT + INSERT m13_* + UPDATE | m42_movimientos, m13_reportes, m13_incidencias | — | No | Sí | No | D | 3 |
| **M43** | InspeccionAlmacenEmpaque | useM43InspeccionAlmacen | INSERT cab + INSERT días + INSERT resultados + M13 si NO | m43_registro_mensual, m43_dias, m43_resultados, (m13_reportes, m13_incidencias) | org_id,rancho_id,anio,mes | No | Sí (NO) | No | **B** | **2** |
| M44 | OrdenMantenimiento | useM44OrdenesMantenimiento | INSERT + INSERT m13_* + UPDATE | m44_ordenes, m13_reportes, m13_incidencias | — | No | Sí | No | D | 3 |
| **M45** | MantenimientoPreventivo | useM45MttoPreventivo | INSERT cab + UPSERT resultados (por item+día) | m45_registro_mensual, m45_resultados | org_id,rancho_id,anio,mes | No | No | No | **B** | **2** |
| M46 | RondinesVigilancia | useM46RondinesVigilancia | INSERT + INSERT rondas + INSERT resultados + catálogo | m46_registros, m46_rondas, m46_resultados, m46_items | — | No | No | No | D | 3 |
| M47 | RegistroPersonal | useM47RegistroPersonal | INSERT trabajador + UPSERT checklist + upsert catálogo | m47_trabajadores, m47_checklist, m47_items | — | No | No | No | D | 3 |
| M48 | TrazabilidadProducto | useM48Trazabilidad | INSERT lotes + folios + relaciones múltiples | m48_lotes_recepcion, m48_lotes_producto, m48_lotes_compuestos, m48_folios_embarque | — | No | No | No | D | 3 |
| **M49** | CalibracionBombas | useM49CalibracionBombas | INSERT | m49_calibracion_bombas | — | No | No | No | **A** | **2** |
| **M50** | CalibracionEquipos | useM50CalibracionEquipos | INSERT | m50_calibracion_equipos | — | No | No | No | **A** | **2** |
| **M51** | CalibracionBasculas | useM51CalibracionBasculas | INSERT | m51_calibracion_basculas | — | No | No | No | **A** | **2** |
| **M52** | CalibracionVolumetricos | useM52CalibracionVolumetricos | INSERT | m52_calibracion_volumetricos | — | No | No | No | **A** | **2** |
| M53 | MipPreventivo | useM53MipPreventivo | INSERT + INSERT resultados | m53_mip_preventivo, m53_resultados | — | No | No | No | D | 3 |
| M54 | MipObservacion | useM54MipObservacion | INSERT + INSERT resultados | m54_mip_observacion, m54_resultados | — | No | No | No | D | 3 |
| M55 | MipIntervencion | useM55MipIntervencion | INSERT + INSERT resultados | m55_mip_intervencion, m55_resultados | — | No | No | No | D | 3 |
| **M56** | FrecuenciaCapacitacion | useM56FrecuenciaCapacitacion | INSERT (catálogo mgmt solo con red) | m56_frecuencia_capacitacion | — | No | No | No | **A** | **2** |
| **M57** | CronogramaCapacitacion | useM57CronogramaCapacitacion | INSERT (catálogo mgmt solo con red) | m57_cronograma_capacitacion | — | No | No | No | **A** | **2** |
| **M58** | Tensiometros | useM58Tensiometros | INSERT | m58_tensiometros | — | No | No | No | **A** | **2** |
| M59 | PlanSuelo | useM59PlanSuelo | INSERT + INSERT resultados | m59_plan_suelo, m59_resultados | — | No | No | No | D | 3 |
| **M60** | ConsumoEnergia | useM60ConsumoEnergia | INSERT | m60_consumo_energia | — | No | No | No | **A** | **2** |
| **M61** | GestionResiduos | useM61GestionResiduos | INSERT | m61_gestion_residuos | — | No | No | No | **A** | **2** |
| M62 | FuentesAgua | useM62FuentesAgua | INSERT + INSERT resultados | m62_fuentes_agua, m62_resultados | — | No | No | No | D | 3 |
| **M63** | UsoEpp | useM63UsoEpp | INSERT | m63_uso_epp | — | No | No | No | **A** | **2** |
| **M64** | ControlHerramientas | useM64ControlHerramientas | INSERT | m64_control_herramientas | — | No | No | No | **A** | **2** |
| **M65** | SanitizacionCosecha | useM65SanitizacionCosecha | INSERT | m65_sanitizacion_cosecha | — | No | No | No | **A** | **2** |
| **M66** | ProductosAutorizados | useM66ProductosAutorizados | INSERT (actualizar/desactivar solo con red) | m66_productos_autorizados | — | No | No | No | **A** | **2** |
| **M67** | FertilizacionGG | useM67FertilizacionGG | INSERT | m67_fertilizacion_gg | — | No | No | No | **A** | **2** |
| M68 | MonitoreoRoedores | useM68MonitoreoRoedores | INSERT + INSERT resultados | m68_registro, m68_roedores_resultados | — | No | No | No | D | 3 |
| **M69** | VerificacionCosecha | useM69VerificacionCosecha | INSERT cab + DELETE+INSERT resultados → UPSERT | m69_registro, m69_resultados | rancho_id,mes | No | No | No | **B** | **2** |
| M70 | VerificacionRoedores | useM70VerificacionRoedores | INSERT batch N filas (ciclo/ronda) | m70_verificacion_roedores | — | No | No | No | D | 3 |
| **M71** | LimpiezaCampo | useM71LimpiezaCampo | INSERT cab + DELETE+INSERT resultados → UPSERT | m71_registro, m71_resultados | rancho_id,mes | No | No | No | **B** | **2** |
| M72 | MonitoreoPlaguasEnfermedades | useM72MonitoreoPlaguasEnfermedades | INSERT + INSERT resultados | m72_registro, m72_resultados | — | No | No | No | D | 3 |
| M73 | BotiquinGG | useM73BotiquinGG | INSERT + INSERT resultados + delete | m73_registro, m73_resultados | — | No | No | No | D | 3 |
| **M74** | GermicidaGG | useM74GermicidaGG | INSERT | m74_germicida | — | No | No | No | **A** | **2** |
| **M75** | AlmacenEmpaqueGG | useM75AlmacenEmpaqueGG | INSERT cab + DELETE+INSERT resultados + m75_acciones → UPSERT | m75_registro, m75_resultados, m75_acciones | rancho_id,mes | No | No | No | **B** | **2** |
| **M76** | MantenimientoEquiposGG | useM76MantenimientoEquiposGG | INSERT | m76_mantenimiento_equipos | — | No | No | No | **A** | **2** |
| **M77** | EmpleadosGG | useM77EmpleadosGG | INSERT | m77_empleados | — | No | No | No | **A** | **2** |
| M78 | TrazabilidadGG | useM78TrazabilidadGG | INSERT | m78_nota_trazabilidad | — | No | No | No | D | 3 |
| AgendaTareas | /inocuidad/agenda | useAgendaTareas | Gestión tareas | agenda_tareas | — | No | No | No | X | — |
| AuditoriasPGFS | /inocuidad/auditorias-primusgfs* | useAuditoriasPGFS | aud_* tablas | aud_auditorias | — | No | No | No | X | — |
| /auditor/* | Portal Auditor | useAuditor* | aud_* tablas | aud_* | — | No | No | No | X | — |
| /nfc/:token | NfcEstacion | — | RPC resolver_nfc (requiere red) | — | — | No | No | No | X | — |
| /sincronizacion | Sincronizacion | useOutbox | Solo lectura outbox | — | — | No | No | No | X | — |
| /metricas | Metricas | useMetricas | Solo lectura | — | — | No | No | No | X | — |
| /equipo/actividad | ActividadEquipo | useActividadEquipo | Solo lectura | — | — | No | No | No | X | — |
| /perfil/mi-organizacion | MiOrganizacion | — | Admin org | organizaciones | — | No | No | No | X | — |


---

## UNIQUE constraints de cabeceras y resultados (Grupo B)

| Tabla cabecera | UNIQUE cabecera | Tabla resultados | UNIQUE resultados | Tabla días |
|----------------|-----------------|-----------------|-------------------|------------|
| m9_registro_mensual | (rancho_id,mes) | m9_resultados | (dia_id,item_id) | m9_dias_inspeccion · UNIQUE (registro_id,fecha) |
| m11_registro_mensual | (rancho_id,mes) | m11_resultados | (dia_id,item_id) | m11_dias_inspeccion · UNIQUE (registro_id,fecha) |
| m19_registro_mensual | (rancho_id,mes) | m19_resultados | (dia_id,item_id) | m19_dias_inspeccion · UNIQUE (registro_id,fecha) |
| m23_registro_mensual | (rancho_id,mes) | m23_resultados | (dia_id,insumo_id) | m23_dias_inspeccion · UNIQUE (registro_id,fecha) |
| m28_registro_mensual | (org_id,rancho_id,anio,mes,area) | m28_resultados | (registro_id,item_id,dia) | m28_dias · UNIQUE (registro_id,dia) |
| m29_registro_mensual | (org_id,rancho_id,anio,mes,area) | m29_resultados | (registro_id,item_id,dia) | m29_dias · UNIQUE (registro_id,dia) |
| m30_registro_mensual | (org_id,rancho_id,anio,mes,area) | m30_resultados | (registro_id,item_id,dia) | m30_dias · UNIQUE (registro_id,dia) |
| m31_registro_mensual | (org_id,rancho_id,anio,mes,area) | m31_resultados | (registro_id,item_id,dia) | m31_dias · UNIQUE (registro_id,dia) |
| m32_registro_mensual | (org_id,rancho_id,anio,mes,area) | m32_resultados | (registro_id,item_id,dia) | m32_dias · UNIQUE (registro_id,dia) |
| m33_registro_mensual | (org_id,rancho_id,anio,mes,area) | m33_resultados | (registro_id,item_id,dia) | m33_dias · UNIQUE (registro_id,dia) |
| m34_registro_mensual | (org_id,rancho_id,anio,mes,area) | m34_resultados | (registro_id,item_id,dia) | m34_dias · UNIQUE (registro_id,dia) |
| m35_registro_mensual | (org_id,rancho_id,anio,mes,area) | m35_resultados | (registro_id,item_id,dia) | m35_dias · UNIQUE (registro_id,dia) |
| m37_registro_mensual | (org_id,rancho_id,anio,mes,area) | m37_resultados | (registro_id,item_id,dia) | m37_dias · UNIQUE (registro_id,dia) |
| m43_registro_mensual | (org_id,rancho_id,anio,mes) | m43_resultados | (registro_id,punto_id,dia) | m43_dias · UNIQUE (registro_id,dia) |
| m45_registro_mensual | (org_id,rancho_id,anio,mes) | m45_resultados | (registro_id,item_id,dia) | — (no usa tabla días) |
| m69_registro | (rancho_id,mes) | m69_resultados | (registro_id,item_id,dia) | — |
| m71_registro | (rancho_id,mes) | m71_resultados | (registro_id,item_id,dia) | — |
| m75_registro | (rancho_id,mes) | m75_resultados | (registro_id,item_id,dia) | m75_acciones → INSERT normal |

---

## Estado de migración Fase 2

| Módulo | Grupo | Migrado | Probado sin red | Notas |
|--------|-------|---------|-----------------|-------|
| M9 | P | ✅ | ✅ | Fase 1 |
| M12 | P | ✅ | ✅ | Fase 1 |
| M13 | P | ✅ | ✅ | Fase 1 |
| M6 | A | ✅ | No | Lote A1 |
| M7 | A | ✅ | No | Lote A1 — catálogo m7_materiales_rancho ops en lote |
| M10 | A | ✅ | No | Lote A1 |
| M20 | A | ✅ | No | Lote A2 — adjuntos bucket incidencias |
| M22 | A | ✅ | No | Lote A1 |
| M27 | A | ✅ | No | Lote A1 |
| M36 | A | ✅ | No | Lote A1 |
| M49 | A | ✅ | No | Lote A2 |
| M50 | A | ✅ | No | Lote A2 |
| M51 | A | ✅ | No | Lote A2 |
| M52 | A | ✅ | No | Lote A2 |
| M56 | A | ✅ | No | Catálogo mgmt solo con red; editar/desactivar guarda con online check |
| M57 | A | ✅ | No | Catálogo mgmt solo con red; editar/desactivar guarda con online check |
| M58 | A | ✅ | No | — |
| M60 | A | ✅ | No | — |
| M61 | A | ✅ | No | — |
| M63 | A | ✅ | No | — |
| M64 | A | ✅ | No | — |
| M65 | A | ✅ | No | — |
| M66 | A | ✅ | No | Actualizar/desactivar guarda con online check |
| M67 | A | ✅ | No | — |
| M74 | A | ✅ | No | — |
| M76 | A | ✅ | No | — |
| M77 | A | ✅ | No | — |
| M11 | B | No | No | — |
| M19 | B | No | No | Crea M13 para NO |
| M23 | B | No | No | Crea M13 para NO |
| M28 | B | No | No | UNIQUE con area |
| M29 | B | No | No | UNIQUE con area |
| M30 | B | No | No | UNIQUE con area |
| M31 | B | No | No | UNIQUE con area |
| M32 | B | No | No | UNIQUE con area |
| M33 | B | No | No | UNIQUE con area |
| M34 | B | No | No | UNIQUE con area |
| M35 | B | No | No | UNIQUE con area |
| M37 | B | No | No | UNIQUE con area |
| M43 | B | No | No | Crea M13 para NO |
| M45 | B | No | No | — |
| M69 | B | No | No | — |
| M71 | B | No | No | — |
| M75 | B | No | No | m75_acciones INSERT normal |

---

## Módulos para Fase 3 (y por qué)

| Módulo | Razón |
|--------|-------|
| M1 | 4 pasos, descuento inventario, RPC |
| M8 | upsert catálogo fertilizantes_org + movimiento inventario |
| M14-M18 | Auditorías legacy — lógica de puntaje, tablas propias |
| M21 | NFC requiere red para resolver token |
| M24 | Catálogo quimicos + movimiento inventario |
| M25 | Lee NC desde auditorías aud_* — linking especial |
| M26 | Fotos Storage con workflow multi-estado |
| M38 | Crea M13 explícitamente (no como resultado matrix) + lineas |
| M39 | m39_lineas + m48 lotes — dependencia inventario |
| M40 | m40_registros + m40_lineas |
| M41 | Upsert por hora — patrón continuo, no mensual |
| M42 | Crea M13 explícitamente + UPDATE post-insert |
| M44 | Crea M13 explícitamente + UPDATE post-insert |
| M46 | m46_rondas + m46_resultados + catálogo items dinámico |
| M47 | m47_checklist upsert/item + catálogo trabajadores |
| M48 | Multi-tabla complejo — lotes, folios, relaciones |
| M53-M55 | cabecera + resultados (no mensual) |
| M59 | cabecera + resultados (no mensual) |
| M62 | cabecera + resultados (no mensual) |
| M68 | cabecera + resultados (no mensual) |
| M70 | Batch N filas con lógica de ciclos |
| M72 | cabecera + resultados (no mensual) |
| M73 | cabecera + resultados + delete |
| M78 | INSERT simple pero verificar si hay relaciones pendientes |

---

## Notas BD para Saúl

UNIQUEs de m69/m71/m75 aplicados en BD (2026-10-08). M69, M71, M75 listos para migrar en Lote B.

---

## Auditoría de lecturas Lote A1 (2026-10-08)

Regla para lotes siguientes: **un módulo solo entra a `MODULOS_OFFLINE` si todas sus lecturas necesarias para capturar tienen `leerConCache` + precarga, y las que requieren red están deshabilitadas con "Necesitas conexión para esto" — nunca error crudo.**

Clasificaciones: **C** = necesaria para capturar/ver lo capturado → `leerConCache` + precarga · **R** = solo con red → deshabilitar sin red · **V** = validación → caché + lotesOffline

| Módulo | Lectura | Archivo:línea | Clase | Corregida |
|---|---|---|---|---|
| M6 | SELECT `m6_botiquin` (lista) | useM6Botiquin hook | C | ✅ |
| M6 | INSERT `m6_botiquin` | BotiquinPrimerosAuxilios L279 | R | ✅ guarda offline |
| M6 | RPC `mi_firma`, `registro_firmar` | L326/372 | R | ✅ solo rama online |
| M7 | SELECT `m7_materiales_rancho` (form inspección) | InspeccionVidrioPlastico L325 | C | ✅ `leerConCache` + precarga por rancho |
| M7 | SELECT `m7_materiales_rancho` (form config) | L365 | R | ✅ config solo con red |
| M7 | INSERT `m7_vidrio_plastico` | L484 | R | ✅ guarda offline |
| M7 | SELECT `m7_vidrio_plastico` (lista) | useM7VidrioPlastico hook | C | ✅ |
| M7 | UPSERT/SELECT `m7_materiales_rancho` (config) | L595/599 | R | ✅ solo online |
| M9 | SELECT `m9_items_catalogo` | InspeccionPerimetral L198 | C | ✅ |
| M9 | SELECT `m9_registro_mensual` (lista) | useM9Perimetral | C | ✅ |
| M9 | SELECT `m9_dias_inspeccion` + `m9_resultados` (detalle) | InspeccionPerimetral L232 | C | ✅ *este fix* |
| M9 | `m9_registro_mensual` (nYaExiste) | L329 | V | ✅ *este fix* |
| M9 | `m9_dias_inspeccion` (dYaExiste) | L448 | V | ✅ *este fix* |
| M9 | INSERT `m9_dias_inspeccion` offline | L477 | C | ✅ *este fix* (`opCabecera`) |
| M9 | INSERT `m9_resultados` offline | L484 | C | ✅ *este fix* (`opUpsert`) |
| M9 | UPDATE `m9_registro_mensual` (observaciones) | L290 | R | ✅ botón deshabilitado sin red |
| M9 | Precarga días mes actual | ModulosContext | C | ✅ *este fix* |
| M10 | SELECT `profiles` (selector responsable) | RegistroCosechaLiberacion L148 | C | ✅ `leerConCache` key `profiles_org` + precarga |
| M10 | SELECT `aplicaciones` (intervalo seguridad) | L198 | V | ✅ retorna vacío si offline |
| M10 | INSERT `m10_cosecha_liberacion` | L331 | R | ✅ guarda offline |
| M10 | SELECT lista (hook) | useM10CosechaLiberacion | C | ✅ |
| M12 | SELECT lista (hook) | useM12LimpiezaBanos | C | ✅ |
| M12 | INSERT `m12_limpieza_banos` | RegistroLimpiezaBanos L281 | R | ✅ guarda offline |
| M13 | SELECT lista reportes (hook) | useM13Incidencias | C | ✅ |
| M13 | INSERT `m13_reportes` + incidencias + fotos | ReporteIncidencias L649 | R | ✅ guarda offline |
| M13 | DELETE `m13_reportes` (eliminar) | L862 | R | ✅ botón deshabilitado sin red |
| M22 | SELECT `m22_muestras` (lista) | useM22Muestras | C | ✅ |
| M22 | SELECT `m22_microorganismos` | useM22Muestras L76 | C | ✅ *este fix* |
| M22 | INSERT `m22_muestras` | RegistroMuestrasLaboratorio | R | ✅ guarda offline |
| M22 | Precarga `m22_microorganismos` | ModulosContext | C | ✅ *este fix* |
| M27 | SELECT lista (hook `useM27PreparacionCloro`) | hook | C | ✅ (verificar) |
| M27 | INSERT `m27_preparaciones` | PreparacionCloro L168 | R | ✅ guarda offline |
| M36 | SELECT lista (hook `useM36Monitoreos`) | hook | C | ✅ (verificar) |
| M36 | INSERT `m36_monitoreos` | MonitoreoGermicida L127 | R | ✅ guarda offline |

---

## Auditoría de lecturas Lote B2 (M28–M32, 2026-10-09)

### M28 LimpiezaBanosQuimicos

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m28_registro_mensual` (lista) | useM28LimpiezaBanosQuimicos hook | C | ✅ `leerConCache` |
| SELECT `m28_items` | `useM28Items` hook | C | ✅ *este fix* — `leerConCache` + `user?.id` |
| SELECT `m28_resultados` + `m28_dias` (detalle) | LimpiezaBanosQuimicos `cargarDetalle` | C | ✅ *este fix* — `leerConCache` key `m28_detalle_${id}` |
| UPSERT/DELETE `m28_resultados` (celda) | `handleSetValor` L249 | R | ✅ bloqueado sin red (toast) |
| UPSERT `m28_dias` (día) | `handleGuardarDia` L298 | R | ✅ bloqueado sin red (toast) |
| INSERT `m28_registro_mensual` (nuevo) | `handleCrearRegistro` L363 | R | ✅ guarda offline |

### M29 LimpiezaAduana

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m29_registro_mensual` (lista) | useM29LimpiezaAduana hook | C | ✅ `leerConCache` |
| SELECT `m29_items` | `useM29Items` hook | C | ✅ *este fix* |
| SELECT `m29_resultados` + `m29_dias` (detalle) | LimpiezaAduana `cargarDetalle` | C | ✅ *este fix* |
| UPSERT/DELETE `m29_resultados` | `handleSetValor` | R | ✅ bloqueado sin red |
| UPSERT `m29_dias` | `handleGuardarDia` | R | ✅ bloqueado sin red |
| INSERT `m29_registro_mensual` | `handleCrearRegistro` | R | ✅ guarda offline |

### M30 LimpiezaComedor

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m30_registro_mensual` (lista) | useM30LimpiezaComedor hook | C | ✅ `leerConCache` |
| SELECT `m30_items` | `useM30Items` hook | C | ✅ *este fix* |
| SELECT `m30_resultados` + `m30_dias` (detalle) | LimpiezaComedor `cargarDetalle` | C | ✅ *este fix* |
| UPSERT/DELETE `m30_resultados` | `handleSetValor` | R | ✅ bloqueado sin red |
| UPSERT `m30_dias` | `handleGuardarDia` | R | ✅ bloqueado sin red |
| INSERT `m30_registro_mensual` | `handleCrearRegistro` | R | ✅ guarda offline |

---

## Auditoría de lecturas Lote B2 cont. (M31–M32) y Lote B3 (M33–M37, 2026-10-09)

### M31–M37 (misma estructura que M28–M30)

Mismas correcciones aplicadas: `useM3X_Items` → `leerConCache`; `cargarDetalle` → `leerConCache` key `m3X_detalle_${id}`.

| Módulo | Ítems hook corregido | Detalle corregido |
|---|---|---|
| M31 LimpiezaOficinas | ✅ | ✅ |
| M32 LimpiezaPatiosAzoteas | ✅ | ✅ |
| M33 LimpiezaRecepcion | ✅ | ✅ |
| M34 LimpiezaPreenfrio | ✅ | ✅ |
| M35 LimpiezaAlmacenEmpaque | ✅ | ✅ |
| M37 LimpiezaCisterna | ✅ (campo extra `es_inspeccion_plaga`) | ✅ |

---

## Auditoría de lecturas M45 (MantenimientoPreventivo, 2026-10-09)

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m45_registro_mensual` (lista) | useM45MttoPreventivo hook | C | ✅ `leerConCache` |
| SELECT `m45_items` (catálogo global) | MantenimientoPreventivo `useEffect` L186 | C | ✅ *este fix* — `leerConCache` key `m45_items` |
| SELECT `m45_resultados` + `m45_acciones` (detalle) | `cargarDetalle` L227 | C | ✅ *este fix* — `leerConCache` key `m45_detalle_${id}` |
| UPSERT `m45_resultados` | `handleToggleValor` | R | ✅ bloqueado sin red |
| UPSERT `m45_acciones` | `handleToggleAccion` | R | ✅ bloqueado sin red |
| INSERT `m45_registro_mensual` | `handleCrearRegistro` | R | ✅ guarda offline |

---

### Pendientes para Lote A2

| Prioridad | Módulo | Pendiente |
|---|---|---|
| Alta | M7 | `m7_materiales_rancho` form inspección → `leerConCache` + precarga |
| Alta | M10 | `profiles` selector responsable → `leerConCache` + precarga |
| Alta | M10 | verificación intervalo seguridad → degradar gracefully sin red |
| ~~Media~~ | M27 | ✅ confirmado — hook usa `leerConCache` |
| ~~Media~~ | M36 | ✅ confirmado — hook usa `leerConCache` |
| ~~Baja~~ | M9 | ✅ botón deshabilitado sin red |
| ~~Baja~~ | M13 | ✅ botón deshabilitado sin red |

---

## Auditoría de lecturas Lote B1 (M11, M69, M71, M75, 2026-10-09)

### M11 InspeccionPreoperacionalCosecha

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m11_registro_mensual` (lista) | useM11Preoperacional hook | C | ✅ `leerConCache` |
| SELECT `m11_items_catalogo` | InspeccionPreoperacionalCosecha `useEffect` L207 | C | ✅ `leerConCache` (ya existía) |
| SELECT `m11_dias_inspeccion` + `m11_resultados` (detalle) | `cargarDias` L227 | C | ✅ *este fix* — `leerConCache` key `m11_detalle_${id}` |
| INSERT `m11_registro_mensual` (nuevo) | `handleCrearRegistro` | R | ✅ guarda offline |
| INSERT `m11_dias_inspeccion` + `m11_resultados` | `handleGuardarDia` | R | ✅ guarda offline |
| UPDATE `m11_registro_mensual` (observaciones) | `handleGuardarObs` | R | ✅ solo con red |

**Nota:** `cargarDias` tiene guard `esLocal` previo (si lote offline, retorna días vacíos sin tocar caché).

### M69 VerificacionCosecha

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m69_registro` (lista) | useM69VerificacionCosecha hook | C | ✅ `leerConCache` |
| SELECT `m69_items_catalogo` | `useM69ItemsCatalogo` | C | ✅ *este fix* — `leerConCache` + `useAuthContext` |
| SELECT `m69_resultados` (detalle celdas) | `cargarM69Resultados` standalone | C | ✅ *este fix* — `leerConCache` key `m69_resultados_${id}`, userId param agregado |
| UPSERT/DELETE `m69_resultados` (celda) | VerificacionCosecha screen | R | ✅ bloqueado sin red |
| INSERT `m69_registro` (nuevo) | `handleCrearRegistro` | R | ✅ guarda offline |

### M71 LimpiezaCampo

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m71_registro` (lista) | useM71LimpiezaCampo hook | C | ✅ `leerConCache` |
| SELECT `m71_items_catalogo` | `useM71ItemsCatalogo` | C | ✅ *este fix* — `leerConCache` + `useAuthContext` |
| SELECT `m71_resultados` (detalle celdas) | `cargarM71Resultados` standalone | C | ✅ *este fix* — `leerConCache` key `m71_resultados_${id}`, userId param agregado |
| UPSERT/DELETE `m71_resultados` | LimpiezaCampo screen | R | ✅ bloqueado sin red |
| INSERT `m71_registro` | `handleCrearRegistro` | R | ✅ guarda offline |

### M75 AlmacenEmpaqueGG

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m75_registro` (lista) | useM75AlmacenEmpaqueGG hook | C | ✅ `leerConCache` |
| SELECT `m75_items_catalogo` | `useM75ItemsCatalogo` | C | ✅ *este fix* — `leerConCache` + `useAuthContext` |
| SELECT `m75_resultados` (detalle celdas) | `cargarM75Resultados` standalone | C | ✅ *este fix* — `leerConCache` key `m75_resultados_${id}`, userId param agregado |
| SELECT `m75_acciones` (detalle acciones) | `cargarM75Acciones` standalone | C | ✅ *este fix* — `leerConCache` key `m75_acciones_${id}`, userId param agregado |
| UPSERT/DELETE `m75_resultados` | AlmacenEmpaqueGG screen | R | ✅ bloqueado sin red |
| UPSERT `m75_acciones` | AlmacenEmpaqueGG screen | R | ✅ bloqueado sin red |
| INSERT `m75_registro` | `handleCrearRegistro` | R | ✅ guarda offline |

---

## Auditoría de lecturas Lote A3–A4 (M56–M77 simples, 2026-10-09)

Módulos: M56, M57, M58, M60, M61, M63, M64, M65, M66, M67, M74, M76, M77.

Todos comparten el mismo patrón verificado:

| Lectura | Patrón | Estado |
|---|---|---|
| SELECT lista (hook `useMXX`) | Hook importa y usa `leerConCache` | ✅ ya existía |
| INSERT (pantalla) | `guardarOffline` para INSERT offline; `online` guard para UPDATE/DELETE | ✅ ya existía |
| `.select('id')` en INSERT | Llamada encadenada al INSERT para obtener el ID — no es lectura separada | ✅ correcto |

**Módulos con lógica adicional auditada:**
- M56/M57: editar y desactivar registros existentes solo funciona con `online` — guard presente (`if (!online) { toast.warning(...) }`)
- M66: actualizar/desactivar bloqueado sin red — guard presente


## Revisión del camino en línea (2026-10-13)

Método: se extrajo el diff de los 29 commits `(offline)` sobre pantallas y hooks (`git show -U0`) y se revisó cada línea eliminada o modificada, comparándola con la versión previa a `feat(offline): PWA y caché de app` (`0c410cb`). Los archivos `src/lib/pdf/**` no fueron tocados por ningún commit offline, así que el PDF individual y el consolidado siguen igual. Las lecturas envueltas en `leerConCache` conservan `select`, filtros y orden, y con red hacen primero la consulta al servidor; los errores de BD/RLS se propagan igual que antes.

Limitación: no hay sesión contra la BD de producción en esta máquina, así que la prueba funcional con red (abrir lista/detalle, crear, firmar, PDF) **no se ejecutó**; la columna "Probado con red" indica revisión estática, no una prueba en vivo.

Hallazgos con cambio de comportamiento en línea (corregidos en el commit `fix(offline): restaurar camino en línea`):
- `useLimiteProactivo` (M7): el original usaba `.lt('fecha', fecha)`; el hook compartido usaba `.lte`. Se agregó `excluirFechaRef` y M7 lo activa.
- `BannerLimiteOffline` (M6, M7, M12): el texto con red cambió de redacción; se agregó `mensajeLimite` con el texto original.
- M9: `nYaExiste` y `dYaExiste` dejaron de consultar al servidor y la creación duplicada abría el registro existente en vez de mostrar el toast. Con red vuelven la consulta y el toast originales; sin red se usa lista local + pendientes.

| Módulo | Diff con red (sí/no) | Probado con red | Corregido |
|---|---|---|---|
| M6 | sí | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | Texto del aviso de límite semanal restaurado (era distinto con red) |
| M7 | sí | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | Consulta de límite quincenal volvía a incluir la fecha de hoy (`lte` en vez de `lt`); restaurado `lt`. Texto del aviso restaurado |
| M9 | sí | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | Validación "ya existe" mensual/diaria volvía a usar solo la lista local; restauradas las consultas al servidor y el toast original |
| M10 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M11 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M12 | sí | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | Texto del aviso de límite semanal restaurado |
| M13 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M19 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M20 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M22 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M23 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M27 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M28 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M29 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M30 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M31 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M32 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M33 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M34 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M35 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M37 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M36 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M43 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M45 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M49 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M50 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M51 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M52 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M56 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M57 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M58 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M60 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M61 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M63 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M64 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M65 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M66 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M67 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M69 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M71 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M74 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M75 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M76 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |
| M77 | no | Revisión estática del diff + build limpio; prueba manual en vivo pendiente | — |

## Auditoría de lecturas Lote A2 (M20, M49, M50, M51, M52, 2026-10-13)

Pantallas: `RegistroAccidentesLaborales` (M20), `CalibracionBombas` (M49), `CalibracionEquipos` (M50), `CalibracionBasculas` (M51), `CalibracionVolumetricos` (M52). Se revisaron pantalla, hook, componentes hijos y generadores de PDF.

Clases: **C** = necesaria para capturar/ver lo capturado · **R** = solo con red · **V** = validación

| Módulo | Lectura | Archivo | Clase | Estado |
|---|---|---|---|---|
| M20 | SELECT `m20_accidentes` + `m20_accidente_fotos` (lista) | `useM20Accidentes` | C | ✅ `leerConCache` + precarga (`m20_accidentes`) |
| M49 | SELECT `m49_calibracion_bombas` (lista) | `useM49CalibracionBombas` | C | ✅ `leerConCache` + precarga |
| M50 | SELECT `m50_calibracion_equipos` (lista) | `useM50CalibracionEquipos` | C | ✅ `leerConCache` + precarga |
| M51 | SELECT `m51_calibracion_basculas` (lista) | `useM51CalibracionBasculas` | C | ✅ `leerConCache` + precarga |
| M52 | SELECT `m52_calibracion_volumetricos` (lista) | `useM52CalibracionVolumetricos` | C | ✅ `leerConCache` + precarga |
| M20, M49–M52 | SELECT `ranchos` (selector de sitio) | `useRanchos` | C | ✅ ya cacheado |
| M20, M49–M52 | SELECT `organizaciones.nombre` (encabezado de cards) | `useOrganizacion` | C | ✅ **este fix**: `leerConCache` (clave `org_nombre:<org>`) + precarga. Con red hace la misma consulta |
| M20 | `getSignedUrls` (miniaturas de fotos guardadas) | `GaleriaFotos` | R | ✅ sin red muestra el ícono de aviso en lugar de la foto, sin error |
| M20, M49–M52 | `generar*PDF` / `generar*ConsolidadoPDF` (consultan `supabase`) | pantallas | R | ✅ **este fix**: sin red muestran "Necesitas conexión para generar el PDF" |
| M20, M49–M52 | RPC `registro_firmas_ver`, `registro_firmar`, `org_firma_config`, `mi_firma` | `useFirmasRegistro`, `useFirmaObligatoria` | R | ⚠️ sin red degradan sin romper (firmas vacías; firmar muestra el error genérico). Componente compartido por los 44 módulos; no se tocó |
| M20 | INSERT `m20_accidentes` + `m20_accidente_fotos` | `RegistroAccidentesLaborales` | R | ✅ guarda offline |
| M49–M52 | INSERT `m49…m52_*` | pantallas | R | ✅ guarda offline |

### Fotos de M20 (mismo patrón que M13)
- Las fotos se comprimen y se pasan como `adjuntos` del lote (`{ uid, blob, path, bucket: 'incidencias' }`); `sincronizarLote` sube los adjuntos **antes** de aplicar `sync_aplicar_lote`.
- Ruta: `${org_id}/m20/${accidenteId}/${uuid}.jpg`. Offline el `accidenteId` es el UUID local que también va en la fila de `m20_accidentes`, así que ruta y filas de `m20_accidente_fotos` coinciden al sincronizar.
- Con red el flujo no cambió: INSERT del accidente, subida de fotos, INSERT de fotos, rollback si falla.

### Para Saúl
- Confirmar que `sync_aplicar_lote` permite las tablas `m20_accidentes`, `m20_accidente_fotos`, `m49_calibracion_bombas`, `m50_calibracion_equipos`, `m51_calibracion_basculas` y `m52_calibracion_volumetricos`; si no, el lote se rechaza con `SYNC_TABLA_NO_PERMITIDA`. No se verificó desde el front.

Resultado: los cinco módulos quedan completos; ninguno sale de `MODULOS_OFFLINE`.


## Auditoría de lecturas Fase 3a — Bloque 1 (cabecera + resultados, sin mes)

Clases: **C** = necesaria para capturar/ver lo capturado · **R** = solo con red · **V** = validación

### M53 MipPreventivo, M54 MipObservacion, M55 MipIntervencion, M59 PlanSuelo

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m53/m54/m55/m59_registro` + `ranchos(nombre)` (lista) | `useM53…`, `useM54…`, `useM55…`, `useM59…` | C | ✅ `leerConCache` (clave `mXX_registro`) + precarga |
| SELECT `mXX_items_catalogo` (ítems de la matriz) | `useMXXItems` | C | ✅ `leerConCache` (clave `mXX_items_catalogo`) + precarga |
| SELECT `ranchos` (selector de sitio) | `useRanchos` | C | ✅ ya cacheado |
| SELECT `organizaciones.nombre` (consolidado) | `useOrganizacion` | C | ✅ ya cacheado |
| RPC `org_tarea_detalle` (banner de tarea de origen) | `BannerTareaOrigen` | R | ✅ solo si se llega desde una tarea; sin red muestra "Tarea asignada" |
| RPC `registro_firmas_ver`, `registro_firmar`, `mi_firma` | `useFirmasRegistro`, `FirmasRegistro` | R | ✅ firmar sin red muestra "Necesitas conexión para firmar" |
| `generar*PDF` / `generar*ConsolidadoPDF` | pantallas | R | ✅ sin red: "Necesitas conexión para generar el PDF" |
| INSERT `mXX_registro` + `mXX_resultados` | pantallas | — | ✅ offline: `opInsert` de cabecera y resultados en el **mismo lote** (ids locales; sin `org_id`/`creado_por`) |

Camino en línea: mismos `insert`, validaciones, toasts, firma y PDF. Lo único que cambió es que el armado de los resultados salió a `armarResultados(registroId)` (mismo contenido), reutilizado por la rama offline.

### M62 FuentesAgua, M68 MonitoreoRoedores, M72 MonitoreoPlaguasEnfermedades

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m62_registro`, `m68_roedores_registro`, `m72_registro` + `ranchos(nombre)` (lista) | `useM62…`, `useM68…`, `useM72…` | C | ✅ `leerConCache` + precarga |
| SELECT `m62_items_catalogo`, `m68_roedores_criterios`, `m72_organismos` (catálogos de la matriz) | `useM62Items`, `useM68Criterios`, `useM72Organismos` | C | ✅ `leerConCache` + precarga (misma consulta, con sus filtros `activo`/orden) |
| `ranchos`, `organizaciones.nombre` | `useRanchos`, `useOrganizacion` (M62/M68) | C | ✅ ya cacheados |
| Firmas, `BannerTareaOrigen`, PDFs | compartidos / pantallas | R | ✅ igual que Bloque 1 (firmar y PDF avisan que requieren conexión) |
| INSERT cabecera + resultados | pantallas | — | ✅ offline: `opInsert` de cabecera y resultados en el mismo lote. M68: matriz criterio × trampa; M72: conteos > 0 por sector/planta/organismo |

### M73 BotiquinGG

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m73_registro` + `ranchos(nombre)` + `m73_resultados(count)` (lista) | `useM73BotiquinGG` | C | ✅ `leerConCache` + precarga |
| SELECT `m73_botiquin_catalogo` | `useM73Catalogo` | C | ✅ `leerConCache` + precarga |
| `cargarM73Resultados` | `useM73BotiquinGG` | R | sin usos en la app |
| DELETE `m73_resultados` / `m73_registro` | `BotiquinGG` (`handleEliminar`) | R | ✅ sin red: "Necesitas conexión para eliminar" (la RPC no tiene `delete`) |
| INSERT cabecera + resultados | `BotiquinGG` | — | ✅ offline: captura nueva en un lote. La pantalla no tiene edición de registros; solo alta y eliminación |

### M78 TrazabilidadGG

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m78_nota_trazabilidad` + `ranchos(nombre)` (lista) | `useM78TrazabilidadGG` | C | ✅ `leerConCache` + precarga |
| `ranchos`, `organizaciones.nombre`, firmas, PDFs | compartidos | C/R | ✅ igual que arriba |
| INSERT `m78_nota_trazabilidad` | `TrazabilidadGG` | — | ✅ offline: `opInsert`, el folio es el que captura el usuario (no lo genera el servidor) |

### M70 VerificacionRoedores

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m70_verificacion_roedores` + `ranchos(nombre)` (lista; la pantalla agrupa por fecha + sitio) | `useM70VerificacionRoedores` | C | ✅ `leerConCache` + precarga |
| Firmas, `BannerTareaOrigen`, PDFs | compartidos / pantalla | R | ✅ igual que arriba |
| INSERT de N filas (una por trampa) | `VerificacionRoedores` | — | ✅ offline: N `opInsert` en un solo lote. La pantalla no calcula ciclos/rondas: la ronda es fecha + sitio, así que no hay lógica que adelantar |

### Para Saúl
- Confirmar que `sync_aplicar_lote` permite `m53…m55_registro/resultados`, `m59_*`, `m62_*`, `m68_roedores_*`, `m70_verificacion_roedores`, `m72_*`, `m73_*` y `m78_nota_trazabilidad` (no se verificó desde el front).
- Las precargas existentes devuelven `[]` si la consulta falla (guardan `data ?? []` sin revisar el error); una precarga con error deja una lista vacía en caché hasta que se refresque con red.

## Auditoría de lecturas Fase 3a — Bloque 2

### M41 TemperaturasConservador

| Lectura | Archivo | Clase | Estado |
|---|---|---|---|
| SELECT `m41_registros` + `ranchos(nombre)` + `m41_lecturas(hora, temperatura, incidencia_id)` (lista) | `useM41TemperaturaConservador` | C | ✅ `leerConCache` + precarga. Se añadió `hora` al embed para poder editar el día sin red |
| SELECT `m41_lecturas` del registro existente (al elegir sitio) | `TemperaturasConservador` (`handleRanchoChange`) | C | ✅ con red, la misma consulta de antes; sin red usa las lecturas de la caché de la lista |
| `ranchos`, `organizaciones.nombre` (consolidado), firmas, `BannerTareaOrigen`, PDFs | compartidos / pantalla | C/R | ✅ PDFs avisan "Necesitas conexión para generar el PDF" |
| INSERT/UPDATE `m41_registros`, UPSERT `m41_lecturas`, INSERT `m13_reportes`/`m13_incidencias` | pantalla | — | ✅ offline en un lote: registro nuevo → `opCabecera(['org_id','rancho_id','fecha'])`; día existente → `opUpdate` (igual que con red); lecturas → `opUpsert(['registro_id','hora'])`; incidencias M13 por lecturas fuera de rango en el mismo lote |

Nota: en `sync_aplicar_lote` la cabecera con `conflicto` hace `ON CONFLICT DO NOTHING` y fusiona ids; no actualiza temp_min/temp_max/observaciones si el día ya existía en el servidor y la app no lo tenía en caché (caso raro: día creado desde otro dispositivo). Las lecturas sí se actualizan por upsert.
