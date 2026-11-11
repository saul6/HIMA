// Selector de hora en formato 24 h (00–23 : 00–59). Evita el AM/PM que muestran algunos navegadores con <input type="time">.
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export function HoraInput24({ value, onChange, ariaLabel = 'Hora', className = '' }: {
  value: string; onChange: (v: string) => void; ariaLabel?: string; className?: string
}) {
  const [h, m] = /^\d{2}:\d{2}$/.test(value) ? value.split(':') : ['00', '00']
  const cls = 'h-10 flex-1 rounded-[0.625rem] border border-border-control bg-input-background px-2 text-sm text-center'
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select aria-label={`${ariaLabel}: horas`} className={cls} value={h} onChange={e => onChange(`${e.target.value}:${m}`)}>
        {HORAS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-sm font-semibold">:</span>
      <select aria-label={`${ariaLabel}: minutos`} className={cls} value={m} onChange={e => onChange(`${h}:${e.target.value}`)}>
        {MINUTOS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-xs text-muted-foreground w-8 text-right">h</span>
    </div>
  )
}
