import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'

export interface Trazo {
  x: number
  y: number
  t: number
}

export interface FirmaPadRef {
  exportar: () => { png: string; trazos: Trazo[][] }
  limpiar: () => void
}

interface FirmaPadProps {
  onChange: (info: { vacia: boolean; puntos: number }) => void
}

export const FirmaPad = forwardRef<FirmaPadRef, FirmaPadProps>(function FirmaPad({ onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trazosRef = useRef<Trazo[][]>([])
  const trazoActualRef = useRef<Trazo[]>([])
  const dibujandoRef = useRef(false)
  const inicioRef = useRef(0)
  const colorRef = useRef<string>('rgb(9, 13, 21)')
  const [puntosTotales, setPuntosTotales] = useState(0)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Compute foreground color via getComputedStyle (no hardcoded hex)
  useEffect(() => {
    const el = document.createElement('div')
    el.style.color = 'var(--foreground)'
    document.body.appendChild(el)
    colorRef.current = getComputedStyle(el).color
    document.body.removeChild(el)
  }, [])

  // Size canvas respecting devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
  }, [])

  function contarPuntos() {
    return trazosRef.current.reduce((s, t) => s + t.length, 0)
  }

  function limpiarCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  }

  useImperativeHandle(ref, () => ({
    exportar() {
      const canvas = canvasRef.current!
      const dpr = window.devicePixelRatio || 1
      const srcW = canvas.width
      const srcH = canvas.height
      const cssW = srcW / dpr
      const maxW = 600
      const dstW = Math.min(maxW, srcW)
      const dstH = Math.round(srcH * (dstW / srcW))
      // s convierte coordenadas CSS (de trazos) al espacio del canvas de exportación
      const s = dstW / cssW
      const tmp = document.createElement('canvas')
      tmp.width = dstW
      tmp.height = dstH
      const ctx2 = tmp.getContext('2d')!
      // Fondo blanco + tinta negra fija (keywords de canvas — excepción para PNG probatorio, independiente del tema)
      ctx2.fillStyle = 'white'
      ctx2.fillRect(0, 0, dstW, dstH)
      ctx2.strokeStyle = 'black'
      ctx2.lineWidth = 2.5 * s
      ctx2.lineCap = 'round'
      ctx2.lineJoin = 'round'
      for (const trazo of trazosRef.current) {
        if (trazo.length < 2) continue
        ctx2.beginPath()
        ctx2.moveTo(trazo[0].x * s, trazo[0].y * s)
        for (let k = 1; k < trazo.length; k++) {
          ctx2.lineTo(trazo[k].x * s, trazo[k].y * s)
        }
        ctx2.stroke()
      }
      return { png: tmp.toDataURL('image/png'), trazos: trazosRef.current }
    },
    limpiar() {
      trazosRef.current = []
      trazoActualRef.current = []
      const total = 0
      setPuntosTotales(total)
      onChangeRef.current({ vacia: true, puntos: total })
      limpiarCanvas()
    },
  }), [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujandoRef.current = true
    inicioRef.current = Date.now()
    const pos = getPos(e)
    trazoActualRef.current = [{ ...pos, t: 0 }]
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return
    e.preventDefault()
    const pos = getPos(e)
    const t = Date.now() - inicioRef.current
    trazoActualRef.current.push({ ...pos, t })
    const trazo = trazoActualRef.current
    if (trazo.length >= 2) {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(trazo[trazo.length - 2].x, trazo[trazo.length - 2].y)
      ctx.lineTo(trazo[trazo.length - 1].x, trazo[trazo.length - 1].y)
      ctx.stroke()
    }
  }

  function handlePointerUp() {
    if (!dibujandoRef.current) return
    dibujandoRef.current = false
    if (trazoActualRef.current.length > 0) {
      trazosRef.current = [...trazosRef.current, [...trazoActualRef.current]]
      trazoActualRef.current = []
    }
    const total = contarPuntos()
    setPuntosTotales(total)
    onChangeRef.current({ vacia: total === 0, puntos: total })
  }

  function handleBorrar() {
    trazosRef.current = []
    trazoActualRef.current = []
    setPuntosTotales(0)
    onChangeRef.current({ vacia: true, puntos: 0 })
    limpiarCanvas()
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full rounded-lg border border-border overflow-hidden"
        style={{ height: 180, backgroundColor: 'var(--card)' }}
      >
        {/* Línea guía punteada */}
        <div
          className="absolute left-4 right-4 pointer-events-none"
          style={{ bottom: 36, borderTop: '1.5px dashed var(--border)' }}
        />
        {puntosTotales === 0 && (
          <p
            className="absolute bottom-2 left-0 right-0 text-center text-xs select-none pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Firma aquí
          </p>
        )}
        <canvas
          ref={canvasRef}
          aria-label="Área de firma"
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <button
        type="button"
        onClick={handleBorrar}
        className="self-end text-xs px-3 py-1 rounded-lg border border-border transition-colors hover:bg-muted"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Borrar
      </button>
    </div>
  )
})
