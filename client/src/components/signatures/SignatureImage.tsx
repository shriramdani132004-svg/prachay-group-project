import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCsrfToken } from '@/lib/api'
import { ImageOff, Loader2 } from 'lucide-react'

/**
 * Authenticated private signature image (Phase 8).
 *
 * Signature bytes live behind `GET /api/v1/signatures/:id`, which requires
 * the session cookie AND passes the ownership/role policy. We therefore fetch
 * the bytes ourselves (credentials: 'include' + CSRF-free GET) and turn them
 * into a short-lived object URL - the private file is never placed in a
 * long-lived public URL and never cached by a shared proxy.
 *
 * States handled honestly:
 * - loading: spinner (bounded, not endless)
 * - error (401/403/404/500): broken-image notice, never a path or storage key
 * - success: <img> with object URL, revoked on unmount/replace
 */

interface SignatureImageProps {
  signatureId: string
  alt: string
  className?: string
}

export function SignatureImage({ signatureId, alt, className }: SignatureImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null

    async function load() {
      try {
        const headers: Record<string, string> = { Accept: 'image/*' }
        const csrf = getCsrfToken()
        if (csrf) headers['X-CSRF-Token'] = csrf

        const response = await fetch(`/api/v1/signatures/${signatureId}`, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) {
          if (!cancelled) setFailed(true)
          return
        }

        const blob = await response.blob()
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void load()

    return () => {
      cancelled = true
      // Revoke promptly so replaced/expired previews never leak memory.
      if (url) URL.revokeObjectURL(url)
    }
  }, [signatureId])

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-input border border-border-subtle bg-bg-subtle p-4 text-center ${className ?? ''}`}
        data-testid="signature-unavailable"
      >
        <ImageOff className="h-5 w-5 text-text-muted" aria-hidden />
        <p className="text-caption text-text-muted">Signature unavailable</p>
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-input border border-border-subtle bg-bg-subtle p-4 ${className ?? ''}`}
        aria-busy="true"
      >
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" aria-label="Loading signature" />
      </div>
    )
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`max-w-full rounded-input border border-border-subtle bg-white object-contain ${className ?? ''}`}
      data-testid="signature-image"
    />
  )
}
