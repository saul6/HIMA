export const CATEGORIA_MAP: Record<string, { label: string; orden: number; icono: string }> = {
  auditorias:     { label: 'Auditorías e inocuidad',     orden: 1, icono: 'clipboard-check' },
  producto:       { label: 'Producto y cadena de frío',  orden: 2, icono: 'package'         },
  limpieza:       { label: 'Limpieza y sanitización',    orden: 3, icono: 'spray'           },
  plagas_insumos: { label: 'Plagas, muestras e insumos', orden: 4, icono: 'bug'             },
  mantenimiento:  { label: 'Mantenimiento',              orden: 5, icono: 'settings'        },
  seguridad:      { label: 'Seguridad y personal',       orden: 6, icono: 'shield'          },
  gestion_campo:  { label: 'Gestión de campo',           orden: 7, icono: 'sprout'          },
}
