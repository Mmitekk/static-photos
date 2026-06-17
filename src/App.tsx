import { useAuth } from '@/hooks/use-auth'
import { LoginPage } from '@/components/login-page'
import { AppContent } from '@/components/app-content'

export default function App() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AppContent />
}
