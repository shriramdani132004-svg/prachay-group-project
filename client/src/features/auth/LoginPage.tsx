import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/forms/Input'
import { Card } from '@/components/common/Card'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { homeForRole } from '@/components/auth/RouteGuards'
import { ApiRequestError, UnauthorizedError } from '@/lib/api'

/**
 * Real credential login (Phase 4).
 *
 * The Phase 2 demo role selector has been REMOVED: choosing a role in the UI
 * must never grant authentication. Navigation follows the role the SERVER
 * reports for the authenticated account.
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}

    if (!email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format'

    if (!password) newErrors.password = 'Password is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!validateForm()) return

    // Prevent accidental duplicate submission.
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const user = await login(email, password)

      // The password is never retained after a successful login.
      setPassword('')

      // Navigate using the server-provided role, never a client-chosen one.
      navigate(homeForRole(user.role), { replace: true })
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        // Generic message: never reveal whether the account exists.
        setFormError('Invalid email or password.')
      } else if (error instanceof ApiRequestError) {
        if (error.status === 429) {
          setFormError('Too many sign-in attempts. Please wait a moment and try again.')
        } else {
          setFormError(error.message || 'Unable to sign in. Please try again.')
        }
      } else {
        setFormError('Unable to reach the server. Check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-login-glow" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.08)_0%,_transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        <Card className="glass border-border-subtle/50 animate-slide-up" padding="lg">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-h1 text-text-primary">PSPL Voucher Portal</h1>
            <p className="text-body text-text-secondary mt-2">
              Secure expense management for Prachay Securities
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-card bg-red-500/10 border border-red-500/30 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-body text-red-400">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="your@pspl.com"
              autoComplete="email"
              disabled={isSubmitting}
              autoFocus
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-text-muted hover:text-text-primary transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <Button type="submit" variant="primary" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-caption text-text-muted">
              <span className="flex items-center justify-center gap-1.5 mx-auto mb-2">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span>Authorized Personnel Only</span>
              </span>
              Session monitored and audited
            </p>
          </div>
        </Card>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-caption text-text-muted text-center mt-6"
        >
          Access is restricted to provisioned accounts.
        </motion.p>
      </div>
    </div>
  )
}