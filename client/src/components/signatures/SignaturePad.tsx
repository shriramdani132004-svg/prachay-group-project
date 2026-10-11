import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Digital signature capture pad (Phase 5 deliverable).
 *
 * Renders a <canvas> the user draws on with a mouse, trackpad or finger.
 * "Use drawing" rasterises the strokes to a PNG blob and hands the caller a
 * real `File` — the same shape the existing upload endpoint already accepts —
 * so the drawn signature flows through the identical private-vault pipeline as
 * an uploaded image. Nothing is persisted locally.
 *
 * Accessibility: the canvas is focusable; Clear and Use-drawing are real
 * <button>s with aria-labels. Pointer events cover mouse, pen and touch.
 */
export interface SignaturePadProps {
  /** Receives the drawn signature as an PNG File plus a data-URL preview. */
  onCapture: (file: File, previewDataUrl: string) => void
  /** Disable all controls (e.g. while a save is in flight). */
  disabled?: boolean
  className?: string
}

const CANVAS_WIDTH = 560
const CANVAS_HEIGHT = 180
const STROKE_STYLE = '#0f172a'
const STROKE_WIDTH = 2.5

export function SignaturePad({ onCapture, disabled = false, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const hasDrawnRef = useRef(false)

  const [hasDrawing, setHasDrawing] = useState(false)

  /** Maps a pointer event to canvas-local pixel coordinates. */
  const toCanvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDrawing = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      // Keep the stroke inside the canvas even if the pointer leaves it.
      canvas.setPointerCapture(event.pointerId)
      drawingRef.current = true
      lastPointRef.current = toCanvasPoint(event)

      ctx.strokeStyle = STROKE_STYLE
      ctx.lineWidth = STROKE_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    },
    [disabled, toCanvasPoint],
  )

  const draw = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || disabled) return
      const ctx = canvasRef.current?.getContext('2d')
      const point = toCanvasPoint(event)
      if (!ctx || !point) return

      const last = lastPointRef.current ?? point
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      lastPointRef.current = point

      if (!hasDrawnRef.current) {
        hasDrawnRef.current = true
        setHasDrawing(true)
      }
    },
    [disabled, toCanvasPoint],
  )

  const stopDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    canvasRef.current?.releasePointerCapture(event.pointerId)
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
    setHasDrawing(false)
  }, [])

  const useDrawing = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawnRef.current) return

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], 'drawn-signature.png', { type: 'image/png' })
        onCapture(file, canvas.toDataURL('image/png'))
      },
      'image/png',
      // Lossless: signatures are small; keep the bytes byte-exact.
      undefined,
    )
  }, [onCapture])

  // Reset strokes whenever the pad becomes disabled (e.g. after submit).
  useEffect(() => {
    if (disabled) clear()
  }, [disabled, clear])

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'relative rounded-input border border-border-subtle bg-white overflow-hidden',
          disabled && 'opacity-60',
        )}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          role="img"
          aria-label="Signature drawing area. Draw your signature with a mouse, trackpad or finger."
          tabIndex={0}
          className={cn(
            'block w-full touch-none select-none',
            disabled ? 'cursor-not-allowed' : 'cursor-crosshair',
          )}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          data-testid="signature-pad-canvas"
        />
        {!hasDrawing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-caption text-text-muted">Draw your signature above</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasDrawing}
          className="btn-secondary text-caption"
          aria-label="Clear signature drawing"
          data-testid="signature-pad-clear"
        >
          <Eraser className="h-3.5 w-3.5 mr-1" aria-hidden />
          Clear
        </button>
        <button
          type="button"
          onClick={useDrawing}
          disabled={disabled || !hasDrawing}
          className="btn-primary text-caption"
          aria-label="Use the drawn signature"
          data-testid="signature-pad-use"
        >
          <PenLine className="h-3.5 w-3.5 mr-1" aria-hidden />
          Use drawing
        </button>
      </div>
    </div>
  )
}
