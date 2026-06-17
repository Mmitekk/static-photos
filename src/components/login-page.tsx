import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Lock, Eye, EyeOff, Shield } from 'lucide-react'

export function LoginPage() {
  const { isPasswordSet, login, setup } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password.trim()) {
      setError('Введите пароль')
      return
    }

    if (!isPasswordSet) {
      if (password.length < 4) {
        setError('Пароль должен быть не менее 4 символов')
        return
      }
      if (password !== confirmPassword) {
        setError('Пароли не совпадают')
        return
      }
    }

    setIsLoading(true)
    try {
      if (isPasswordSet) {
        const success = await login(password)
        if (!success) {
          setError('Неверный пароль')
        }
      } else {
        await setup(password)
      }
    } catch {
      setError('Ошибка авторизации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
            <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Перевод-Карточки
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isPasswordSet ? 'Введите пароль для входа' : 'Создайте пароль для защиты'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Введите пароль"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isPasswordSet && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Подтвердите пароль
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Повторите пароль"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {isLoading ? 'Загрузка...' : isPasswordSet ? 'Войти' : 'Создать пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}
