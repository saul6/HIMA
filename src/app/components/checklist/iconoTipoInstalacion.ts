// Ícono reconocible por tipo de instalación (solo visual). La BD trae un nombre de ícono por sector, pero varios
// tipos quedaban con el ícono genérico: aquí cada tipo conocido tiene el suyo y el resto conserva el de la BD.
import { Beef, Flower2, Package, Snowflake, Sprout, Truck, Warehouse, type LucideIcon } from 'lucide-react'
import { resolverIcono } from '@/app/components/iconos-modulos'

const POR_TIPO: Record<string, LucideIcon> = {
  campo: Sprout,
  empacadora: Package,
  cuartofrio: Snowflake,
  almacen: Warehouse,
  invernadero: Flower2,
  exportadora: Truck,
  tifcarnicos: Beef,
}

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

/** `clave` o `nombre` del sector; `iconoBD` es el nombre de ícono que ya trae el sector. */
export function iconoTipoInstalacion(clave: string | null | undefined, nombre: string | null | undefined, iconoBD: string | null | undefined): LucideIcon {
  for (const t of [clave, nombre]) {
    const hit = t ? POR_TIPO[normalizar(t)] : undefined
    if (hit) return hit
  }
  return resolverIcono(iconoBD ?? '')
}
