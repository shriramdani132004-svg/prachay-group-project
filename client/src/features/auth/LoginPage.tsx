import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/forms/Input'
import { Card } from '@/components/common/Card'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'

interface LoginPageProps {
  onDemoLogin: (role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS') => void
}

const demoRoles = [
  { role: 'EMPLOYEE' as const, label: 'Employee', description: 'Create and submit vouchers', color: 'text-blue-400', icon: <CheckCircle className="h-5 w-5" /> },
  { role: 'DIRECTOR' as const, label: 'Director', description: 'Approve and reject vouchers', color: 'text-amber-400', icon: <Shield className="h-5 w-5" /> },
  { role: 'ACCOUNTS' as const, label: 'Accounts', description: 'View organization-wide register', color: 'text-emerald-400', icon: <DollarSign className="h-5 w-5" /> },
]

import { DollarSign } from 'lucide-react'

export function LoginPage({ onDemoLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    if (!email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      // In a real app, this would call the auth API
      console.log('Login attempt:', { email, password, rememberMe })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-login-glow" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.08)_0%,_transparent_70%)]" aria-hidden="true" />

      <div className="relative w-full max-w-md">
        <Card className="glass border-border-subtle/50 animate-slide-up" padding="lg">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-h1 text-text-primary">PSPL Voucher Portal</h1>
            <p className="text-body text-text-secondary mt-2">Secure expense management for Prachay Securities</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="your@pspl.com"
              autoComplete="email"
              autoFocus
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-text-muted hover:text-text-primary transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-input border-border-subtle text-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-bg-base"
                />
                <span className="text-caption text-text-secondary">Remember me</span>
              </label>
              <a href="#" className="text-caption text-primary hover:underline">Forgot password?</a>
            </div>

            <Button type="submit" variant="primary" className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle">
            <p className="text-caption text-text-muted text-center mb-4">Or continue with demo access</p>
            <div className="grid grid-cols-3 gap-3" role="group" aria-label="Demo role selection">
              {demoRoles.map(({ role, label, description, color, icon }) => (
                <button
                  key={role}
                  onClick={() => onDemoLogin(role)}
                  className={cn(
                    'relative p-3 rounded-button border transition-all duration-fast text-left',
                    'hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base'
                  )}
                  aria-label={`Login as ${label}`}
                >
                  <div className={cn('flex items-center justify-center gap-2 mb-2', color)}>
                    {icon}
                  </div>
                  <p className="text-body font-medium text-text-primary text-center">{label}</p>
                  <p className="text-caption text-text-muted text-center truncate">{description}</p>
                </button>
              ))}
            </div>
          </div>

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
          DEMO PREVIEW — Sample data, not connected to production database
        </motion.p>
      </div>
    </div>
  )
}