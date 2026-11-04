# Guía: tarjetas de registro para módulos nuevos

Toda lista de registros de un módulo se pinta con `ListaTarjetas` + `TarjetaRegistro`
(`src/app/components/ui-mady/`). No dibujes tarjetas propias con `div`/`button`.

- Por debajo de 972 px de contenedor la lista se ve como tarjeta de **una columna** (igual que siempre).
- Desde 972 px de contenedor (≈ 1224 px de ventana con el menú lateral) pasa a **2 columnas** y la tarjeta suma
  franja de estado, etiqueta de estado y chip "N/M firmas".
- **Excepción:** la **matriz mensual oficial** (M9, M11 y similares) no se convierte en tarjetas.
  PrimusGFS la exige tipo calendario; solo la **lista de meses** usa tarjetas.

## Piezas

| Pieza | Archivo | Para qué |
|---|---|---|
| `ListaTarjetas`, `ListaAncho` | `ui-mady/ListaTarjetas.tsx` | Rejilla. `ListaAncho` envuelve lo que no es tarjeta (aviso, tarjetas sin subir, lote offline) para que ocupe todo el ancho. |
| `TarjetaRegistro` | `ui-mady/TarjetaRegistro.tsx` | La tarjeta. |
| `resumenFirmas`, `textoResumenLista` | `hooks/resumenFirmas.ts` | Estado y "N/M firmas" con el `firmas[id]` que la pantalla ya tiene (sin consultas). |
| `FirmasRegistro` | `components/FirmasRegistro.tsx` | Bloque de firmas, va en `pie`. |
| `BotonExportarConsolidado` | `components/BotonExportarConsolidado.tsx` | `variante="encabezado"` arriba a la derecha. |
| `FiltroPildoras` | `components/FiltroPildoras.tsx` | Filtros de selección única. |
| `ListaSkeleton rejilla` | `components/ListaSkeleton.tsx` | Esqueleto de carga en rejilla. |
| `TextoColapsable` | `ui-mady/TextoColapsable.tsx` | Texto libre en 3 renglones con "Ver más". |

### Props de `TarjetaRegistro`

| Prop | Uso |
|---|---|
| `estado` | `'firmado' \| 'pendiente' \| 'correccion' \| 'neutro'`. Franja + etiqueta de texto. **Solo habla de firmas** (y de corrección). |
| `firmas` | `{ hechas, total }` para el chip "N/M firmas" (`null` si aún no cargan). |
| `meta` | Líneas pequeñas sobre el título (instalación, fecha). En 2 columnas se unen con " · ". |
| `titulo`, `tituloTexto` | Título (máx. 2 renglones) y su texto plano para `title`. |
| `chips`, `etiquetas`, `chipMovil` | Chips de dato, etiquetas del módulo y el chip antiguo de 1 columna. |
| `responsable` | "Responsable: …" (solo 2 columnas). |
| `acciones` | Botones de arriba a la derecha (PDF, eliminar…). |
| `contenido`, `children` | Texto propio en la columna del título / cuerpo a ancho completo. |
| `encima` | Aviso sobre el encabezado (comentario de corrección). |
| `alHacerClic`, `expandido` | Hace clicable la zona del título (`role="button"`, teclado y foco). |
| `pie` | `FirmasRegistro`, al fondo. |
| `sinFirmas` | Módulos sin firmas: sin franja, ni etiqueta de estado, ni chip "N/M firmas". |

## Ejemplo mínimo con firmas

Copiado de `src/app/screens/BotiquinPrimerosAuxilios.tsx` (M6), recortado a lo esencial; las variables
(`registros`, `firmas`, `sinDatosFirmas`, `loadingFirmas`, `refetch`, `refetchFirmas`, `handleDescargarPDF`)
vienen de la pantalla como allí.

```tsx
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { resumenFirmas } from '@/hooks/resumenFirmas'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'

<ListaTarjetas>
  {registros.map((r) => {
    const resumen = resumenFirmas(firmas[r.id], sinDatosFirmas)
    return (
      <TarjetaRegistro
        key={r.id}
        estado={r.requiere_correccion ? 'correccion' : resumen.estado}
        firmas={resumen.estado === 'neutro' ? null : resumen}
        meta={[formatFecha(r.fecha_verificacion)]}
        titulo={r.rancho_nombre}
        tituloTexto={r.rancho_nombre}
        acciones={(
          <button
            onClick={() => handleDescargarPDF(r)}
            disabled={generandoPDF === r.id}
            className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
            title="Descargar PDF"
          >
            <FileDown className="w-4 h-4" />
          </button>
        )}
        pie={(
          <FirmasRegistro
            variante="escritorio"
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
        )}
      />
    )
  })}
</ListaTarjetas>
```

Resumen de arriba (cuenta de registros y pendientes): `textoResumenLista(registros.length, pendientesFirma)`, como en
`PreparacionCloro.tsx`.

## Ejemplo con `sinFirmas`

Copiado de `src/app/screens/VerificacionRoedores.tsx` (M70):

```tsx
<ListaTarjetas>
  {grupos.map(g => (
    <TarjetaRegistro
      key={g.key}
      sinFirmas
      meta={[formatFecha(g.fecha)]}
      titulo={g.rancho_nombre}
      tituloTexto={g.rancho_nombre}
      acciones={(
        <button
          onClick={(e) => { e.stopPropagation(); descargarPDF(g.trampas[0].rancho_id, g.fecha, g.key) }}
          disabled={pdfLoading === g.key}
          className="p-2 rounded-lg border border-border bg-card"
        >
          {pdfLoading === g.key
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          }
        </button>
      )}
    >
      {/* cuerpo propio del módulo */}
    </TarjetaRegistro>
  ))}
</ListaTarjetas>
```

## Reglas

1. **Franja y estado, solo de firmas.** `estado` nunca se usa para prioridad, resultado u otra cosa.
2. **Chip "N/M firmas"** siempre con `resumenFirmas(...)`; si todavía no cargan las firmas, `firmas={null}`.
3. **"Exportar consolidado" arriba a la derecha**: `<BotonExportarConsolidado variante="encabezado" />` en
   `ModuloHeader acciones`. Solo se ve desde 1224 px; la barra a todo el ancho se queda para menos de 1224 px
   y se oculta con `min-[1224px]:hidden` en su contenedor. Nunca una barra a todo el ancho en escritorio.
4. **Chips de dato en neutro** (`Etiqueta` neutral / `--muted`). Solo llevan color los de **sí o no** con significado
   (dentro/fuera de tolerancia, artículo presente/ausente, plaga registrada), con los tokens `--agro-*`.
5. **Títulos en 2 renglones** (ya lo hace `TarjetaRegistro`) y **textos libres en 3 renglones con "Ver más"**
   (`TextoColapsable`). No cortes datos del usuario.
6. **Sin botón dentro de botón.** Si la tarjeta se abre, usa `alHacerClic` (solo la zona del título es clicable,
   con teclado) y deja `acciones` y `pie` fuera. Nunca envuelvas la tarjeta en `<button>` ni `Link`.
7. **Filtros con `FiltroPildoras`**, no botones sueltos.
8. **Sin colores fijos**: nada de hex, `#fff`, `bg-white`, `text-white` en listas, filtros ni chips. Usa tokens
   (`text-primary-foreground`, `--agro-*`, `--muted`).
9. **Por debajo de 972 px** se ve como tarjeta de una columna; no agregues ramas propias por ancho de ventana
   (usa `@min-[972px]/lista:` del contenedor, no `lg:`/`xl:`).
10. Los hijos que no son tarjeta (estado vacío, aviso de carga, tarjetas sin subir) van en `ListaAncho`.
11. Esqueleto de carga en rejilla: `<ListaSkeleton rejilla />`.

## Errores a evitar (salieron en los lotes)

- **Botón PDF dentro de un `<button>`** que era la tarjeta entera (M43, M69, M71, M75): marcado inválido.
  Se resuelve con `alHacerClic` + `acciones` fuera de la zona clicable.
- **Usar `estado` para algo que no son firmas** (prioridad, resultado): se confunde con el estado de firma.
- **Chips de dato con color** que no son de sí o no: pasar a neutro.
- **Colores fijos** (`#fff`, `text-white`, hex) en chips o filtros: rompen el modo oscuro.
- **Barra "Exportar consolidado" visible en escritorio** además del botón del encabezado.
- **Convertir en tarjetas la matriz mensual oficial** (M9, M11): el auditor exige el calendario.
- **Olvidar `ListaAncho`** para el estado vacío o el aviso: queda en media columna.
- **Cambiar lógica al rediseñar**: mismo conteo de handlers, botones y permisos que antes. Esto es solo visual.
- **Variables sin declarar** (p. ej. `setRegistroGuardado` en M10): corre `revisar-identificadores.mjs` antes de cada commit.
