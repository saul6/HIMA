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
| M20 | A | No | No | Adjuntos bucket incidencias |
| M22 | A | ✅ | No | Lote A1 |
| M27 | A | ✅ | No | Lote A1 |
| M36 | A | ✅ | No | Lote A1 |
| M49 | A | No | No | — |
| M50 | A | No | No | — |
| M51 | A | No | No | — |
| M52 | A | No | No | — |
| M56 | A | No | No | Catálogo mgmt solo con red |
| M57 | A | No | No | Catálogo mgmt solo con red |
| M58 | A | No | No | — |
| M60 | A | No | No | — |
| M61 | A | No | No | — |
| M63 | A | No | No | — |
| M64 | A | No | No | — |
| M65 | A | No | No | — |
| M66 | A | No | No | Actualizar/desactivar solo con red |
| M67 | A | No | No | — |
| M74 | A | No | No | — |
| M76 | A | No | No | — |
| M77 | A | No | No | — |
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
