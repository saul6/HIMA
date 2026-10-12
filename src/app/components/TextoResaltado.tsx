import { coincidenciaPorInicio } from '@/lib/busquedaPorInicio'

// Un solo <span> con el texto y la negrita en línea (sin hijos sueltos que un
// contenedor flex con gap pueda separar). Solo se marca el inicio escrito de
// cada palabra que coincidió, en negrita y con el color del texto.
export function TextoResaltado({ texto, query }: { texto: string; query: string }) {
  const { rangos } = coincidenciaPorInicio(texto, query)
  if (rangos.length === 0) return <span>{texto}</span>
  const orden = [...rangos].sort((a, b) => a[0] - b[0])
  const partes: React.ReactNode[] = []
  let cursor = 0
  orden.forEach(([d, h], i) => {
    if (d < cursor) return
    if (d > cursor) partes.push(texto.slice(cursor, d))
    partes.push(
      <span key={i} className="font-semibold" style={{ color: 'inherit' }}>{texto.slice(d, h)}</span>,
    )
    cursor = h
  })
  if (cursor < texto.length) partes.push(texto.slice(cursor))
  return <span>{partes}</span>
}
