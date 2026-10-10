import { Link } from 'react-router-dom'
import { ArrowLeft, Search, Home } from 'lucide-react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { cn } from '@/lib/utils'

export function NotFound() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center animate-fade-in" padding="lg">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
          <Search className="h-8 w-8 text-rose-400" />
        </div>
        <h1 className="text-h1 text-text-primary mb-2">Page Not Found</h1>
        <p className="text-body text-text-secondary mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Link to="/employee">
            <Button variant="ghost">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}