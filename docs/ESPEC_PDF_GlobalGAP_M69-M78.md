# Especificación de PDFs GlobalGAP M69–M78 (formatos oficiales)

Fuente: libro de bitácoras GlobalGAP v6 del cliente (hojas indicadas). Esta especificación replica **estructura y textos** de cada formato. **No** copies el nombre de la empresa del Excel: "Compañía/Productor/Empresa" sale de la organización del usuario (`organizaciones.nombre`) y "Rancho" del registro.

Encabezado de todos: `PdfHeader` (logo M.A.D.Y, `titulo`, `subtitulo`, `codigoFormato`, `folio`, `fecha`) igual que M68 (`src/lib/pdf/m68/MonitoreoRoedoresPDF.tsx`). El subtítulo lleva "Global G.A.P. v6". La línea "Emisión/Revisión" del Excel es control documental del cliente: **no** se imprime (igual que M67/M68).
Firmas: `PdfSignatures` con `firma` digital (Realizó/Verificó vía `obtenerFirmasParaPdf`). Las líneas propias del formato (p. ej. "Nombre y firma de quién verifica") se mapean a esos roles como se indica abajo.
Leyendas `Sí/No/N/A`: usar texto (`Si`, `No`, `N/A`, `X`), nunca ✓/✗ (regla de PDFs).

---

## M78 — Nota de Trazabilidad (hoja "Nota de Trazabilidad") — **vertical (portrait)**, una nota por página
Tabla `m78_nota_trazabilidad`: `folio, fecha, productor, hora_salida, num_camion, zona, rancho_id, sector, cultivo, presentacion, otro_presentacion, peso_bruto, peso_neto, total_producto, embarco, chofer, recibio, observaciones`.
- Título: **"Nota de Trazabilidad"**; código: **"Nota de Trazabilidad"** no tiene código en el formato → `codigoFormato="NT"` (o el que ya muestre la pantalla); `folio` = `folio` del registro (si viene vacío, los primeros 8 del id).
- Bloque superior (rejilla de campos, 3 renglones):
  1. **Fecha:** `fecha` · **Productor:** `productor`
  2. **Hora de salida:** `hora_salida` · **Núm. camión:** `num_camion` · **Zona:** `zona`
  3. **Rancho:** nombre del rancho · **Sector:** `sector` · **Cultivo:** `cultivo`
- **PRESENTACIÓN:** cuatro casillas en línea `CAJA | TOTE | GRANEL | OTRO: ____`; marcar con **"X"** la que coincida con `presentacion` (en OTRO imprimir `otro_presentacion`).
- Tabla de una fila: **PESO BRUTO (Ton)** | **PESO NETO (Ton)** | **TOTAL DE PRODUCTO** | **OBSERVACIONES** (`peso_bruto`, `peso_neto`, `total_producto`, `observaciones`). Respeta los números tal cual (sin redondear).
- Pie con 3 firmas en línea: **EMBARCÓ** (`embarco`), **CHOFER** (`chofer`), **RECIBIÓ** (`recibio`), cada una con el nombre impreso arriba de la línea y la leyenda "Nombre y Firma" (firma a mano; son personas externas).
- Debajo, bloque de **firmas digitales** del registro: Realizó / Verificó (`PdfSignatures` con `firma`).
- Consolidado: tabla con una fila por nota: Folio | Fecha | Rancho | Sector | Cultivo | Presentación | Peso bruto | Peso neto | Total | Chofer | Recibió.

## M69 — Verificación Diaria de Cosecha (hoja "Verif. Diaria de Cosecha", REG-13) — **matriz mensual**, horizontal
Tablas `m69_registro` (`mes, codigo, cultivo, realizo, observaciones`) + `m69_resultados` (por día/punto; revisa el hook `useM69…`).
- Título "Verificación Diaria de Cosecha", código **REG-13**. Campos: Compañía · Rancho · Código (`codigo`) · Cultivo · Mes y Año.
- Leyenda: "Responde SI si cumple, NO si NO cumple ó N/A si no aplica".
- `PdfMonthlyMatrix`: columnas No. | Punto de Inspección | días 1…31. Fila opcional "Sectores" (si hay datos) bajo el encabezado.
- 57 puntos en 8 secciones (banda de sección): **Inspección de Ranchos y Terrenos Adyacentes** (1–10), **Higiene, Salud y Seguridad de los Trabajadores** (11–25), **Área de Recepción de Fruta** (26–31), **Comedor** (32–34), **Baños** (35–42), **Vehículos y Transportes de Campo** (43–46), **Medidas Preventivas antes y durante la Cosecha** (47–51), **Áreas de Alto Riesgo** (52–57; el 57 es "Basado en su inspección, ¿se puede cosechar en los sectores? Si (S) / No (N)").
- **Textos de los puntos:** usa los del catálogo de la BD (los mismos que muestra la pantalla); si difieren del formato, reporta la diferencia en el chat sin cambiar la BD.
- Pie: "Realizado por" (Realizó digital) · "Responsable de la Verificación" (Verificó digital) · nota "*Colocar (Si) si cumple, (X) si no cumple, (N/A)…".

## M70 — Verificación de Trampas para Roedores (hoja "Etiqueta Trampas", REG-24) — horizontal
Tabla `m70_verificacion_roedores`: `fecha, num_trampa, roedor, insectos, otros, cambio, verifico, observaciones`.
- El Excel es una etiqueta repetida por trampa; en PDF se imprime como **tabla**: Fecha | # Trampa | Roedor (Sí/No) | Insectos (Sí/No) | Otros (Sí/No) | Cambio (Sí/No) | Verificó | Observaciones. Encabezado de grupo "Sí | No" igual que el formato (marcar "X" en la columna que corresponda).
- Nota al pie: "El formato debe llenarse en cada verificación y este formato debe mantenerse en cada trampa muestreada."
- Individual = una verificación; consolidado = todas las del rango agrupadas por trampa.

## M71 — Limpieza y Desinfección en General / Derrames en Campo (hoja "Limp Desinf", REG-10) — **matriz mensual**, horizontal
Tablas `m71_registro` (`mes, realizo, observaciones`) + `m71_resultados`.
- Título "Limpieza y Desinfección en General / Derrames en Campo", código **REG-10**. Campos: Rancho · Mes y Año. Nota: "Colocar (Si) si se realiza la acción indicada (X) si no se realiza y N/A (no aplica)…".
- `PdfMonthlyMatrix` DIAS/MES 1…31 con secciones y renglones:
  - **Higiene** (Frecuencia: diario): Agua para lavado de manos · Solución de desinfectante (200 ppm)
  - **Galera / Mesa de empaque / Comedor**: Limpieza · Desinfección
  - **Canastos (Producto a granel) / Escalera / Cuchillos**: Limpieza · Desinfección
  - **Transporte** (Frecuencia: 2 o 3 veces por semana): Limpieza · Desinfección
  - **Sanitarios** (Frecuencia: Semanal): Limpieza · Desinfección · Succión
  - **Estación de lavado de manos**: Limpieza · Desinfección
  - **Depósito de agua para lavado de manos**: Limpieza · Desinfección
  - **Botes de basura** (Frecuencia: Quincenal): Limpieza (retirar basura, cambiar bolsa) · Desinfección
  - **Barriles de mezclas y Tanque** (Frecuencia: cada que se requiera): Limpieza · Desinfección
  (Usa el catálogo de la BD como fuente; reporta diferencias.)
- Pie: "Nombre y Firma de quién verifica" (Realizó digital) · "Nombre y Firma de quién autoriza" (Verificó digital).

## M72 — Monitoreo de Plagas y Enfermedades (hoja "Monitoreo de plagas", REG-21) — vertical
Tablas `m72_registro` (`fecha, etapa_fenologica, beneficos, realizo, observaciones`) + `m72_resultados` (por sector/planta/plaga).
- Título "Monitoreo de Plagas y Enfermedades", código **REG-21**. Campos: Rancho · Fecha · Etapa fenológica.
- Tabla: Sector | # planta evaluada | **Plaga** (una columna por plaga registrada) | **Enfermedades** (una por enfermedad registrada) | Benéficos | Observaciones. Las columnas salen de los datos/catálogo del registro, **no** fijes las de brócoli del Excel.
- Filas finales **Total** y **% de incidencia** (calculadas con los mismos datos que muestra la pantalla; si la pantalla no las calcula, imprime solo Total como suma y reporta).
- No imprimas el bloque "Umbrales de Acción Económica (Brócoli)" (es específico del cultivo del cliente).
- Pie: "Realizó" (digital) y Verificó (digital).

## M73 — Inventario de Material de Curación (hoja "Inventario Botiquin") — horizontal
Tablas `m73_registro` (`fecha, botiquin_num, realizo, observaciones`) + `m73_resultados` (material, sale/entra/total).
- Título "Inventario de Material de Curación" (sin código en el formato → usa el que muestre la pantalla, p. ej. "M73"). Campos: Productor · Rancho · Botiquín #.
- Tabla 1: FECHA | GUANTES DE CURACIÓN | ALGODÓN | GASAS | CINTA ADHESIVA | VENDAS | CURITAS | NOMBRE DE QUIÉN USA O INGRESA MATERIAL; cada material con subcolumnas **Sale | Entra | Total**.
- Tabla 2: FECHA | TIJERA DE PUNTA CHATA | VIOLETA | AGUA OXIGENADA | MERTHIOLATE | OTRO | OTRO | NOMBRE…, mismas subcolumnas.
- Materiales: los del catálogo/resultados del registro en ese orden; si hay más, continúa en la tabla 2.
- Pie: "Nombre y firma de quién verifica" (Verificó digital) + Realizó digital.

## M74 — Monitoreo de Solución Germicida (hoja "Monitoreo de Sol. Germ.", REG-10.1) — horizontal
Tabla `m74_germicida`: `fecha, producto, material_utilizado, sector, hora1, ppm1, ajuste1, hora2, ppm2, ajuste2, hora3, ppm3, ajuste3, realizo, observaciones`.
- Título "Monitoreo de Solución Germicida", código **REG-10.1**. Campos: Rancho · Producto.
- Tabla: Fecha | Material utilizado | Sector | (Hora de monitoreo | ppm | Ajuste (ppm)) ×3 | Realizó.
- Nota: "Se debe llevar la verificación de la sanitización diariamente y/o cada que haya cosecha, especificando la hora de monitoreo y las ppm (Lavado de manos 1.5–3.0 ppm / Agua de desinfección de herramienta, cubetas 100–200 ppm)".
- Individual = una fila; consolidado = todas las del rango.

## M75 — Inspección de Almacén de Material de Empaque y/o Embalaje (hoja "Insp. Mat. Emp.", REG-22) — **matriz mensual**, horizontal
Tablas `m75_registro` (`mes, cultivo, realizo, observaciones`) + `m75_resultados` + `m75_acciones`.
- Título "Inspección de Almacén de Material de Empaque y/o Embalaje", código **REG-22**. Campos: Compañía · Rancho · Cultivo · Mes y Año. Leyenda Si/No/N/A.
- `PdfMonthlyMatrix` No. | Punto | 1…31 con 11 puntos (del catálogo de la BD):
  1 ¿Se realizó la limpieza del almacén? · 2 ¿Hay evidencia de algún otro animal diferente de roedores o aves? · 3 ¿Hay roedores en la trampa? · 4 ¿Hay evidencia de roedor (excremento, pelos, huellas)? · 5 ¿Hay evidencia de aves (excretas, plumas, nidos)? · 6 ¿El mecanismo de la trampa funciona correctamente? · 7 Trampa mecánica con cebo/atrayente, ¿cuenta con él? · 8 ¿Las cajas con material de empaque están cerradas? · 9 ¿Hay algún olor raro (solventes, químicos)? · 10 ¿Es aceptable la limpieza del almacén? · 11 ¿El lavamanos cuenta con agua, jabón sin olor y toallas?
- Fila "Realizado por" (por día, si hay dato).
- Nota "En caso de encontrar alguna incidencia inusual, especificar la ACCIÓN CORRECTIVA…" y tabla **Acciones Tomadas** por día (de `m75_acciones`).
- Pie: "Nombre y firma de quién realiza" (Realizó) · "Nombre y firma de quién verifica" (Verificó).

## M76 — Verificación y Mantenimiento de Equipos (hoja "Ver y Mtto - Equipo", REG-09) — horizontal
Tabla `m76_mantenimiento_equipos`: `fecha, equipo, realizo, tipo_actividad, fugas_tanque_bomba, mangueras, pistola, lanzas, boquillas, descripcion_trabajo, observaciones`.
- Título "Verificación y Mantenimiento de Equipos", código **REG-09**. Campo: Productor. Nota: "Usar Si para sí, X para no o NA si no aplica".
- Banda "VERIFICACIÓN Y/O MANTENIMIENTO PREVENTIVO Y CORRECTIVO DE MAQUINARIA Y EQUIPOS".
- Un bloque por registro: FECHA · EQUIPO · REALIZÓ; "Tipo de actividad: Verificación ( ) Mantenimiento preventivo ( ) Mantenimiento correctivo ( )" con **X** en el que coincida; fila de checks: Libre de fugas tanque, bomba | Mangueras libre de fugas | Estado de la pistola | Estado de las lanzas o varillas | Estado de las boquillas | Mantenimientos – descripción del trabajo.
- Nota al pie: "Anexar facturas de compra de refacciones. En caso de servicio externo, agregar facturas y/o notas de servicio."
- Individual = un bloque; consolidado = bloques del rango (hasta 4 por página, como el formato).

## M77 — Identificación de Empleados (hoja "Datos Trabajadores", REG-ASIP-26) — horizontal
Tabla `m77_empleados`: `nombre, fecha_ingreso, telefono, domicilio, persona_contacto, observaciones`.
- Título "Identificación de Empleados", código **REG-ASIP-26**. Campos: Empresa · Fecha de actualización (fecha de generación).
- Tabla: NOMBRE | FECHA DE INGRESO | TELÉFONO | DOMICILIO | PERSONA DE CONTACTO | FIRMA (columna en blanco para firma a mano).
- Nota: "Se debe especificar a cada uno de los trabajadores que colaboran en la empresa, mencionando la información aquí mencionada."
- Pie: "Nombre y firma de quién realiza" · "Nombre y firma de quién verifica" (firmas digitales si existen).
- Es una **lista**: el PDF "individual" es la lista del rancho (no uno por empleado); el consolidado puede ser la lista de todos los ranchos.
- Datos personales: solo se imprimen en este PDF; no los muestres en otros lugares.
