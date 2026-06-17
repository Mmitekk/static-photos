import { useState } from 'react'
import * as githubStorage from '@/lib/github-storage'
import { type GitHubConfig } from '@/lib/github-storage'
import { testConnection } from '@/lib/github-storage'
import { getDeepLKey, setDeepLKey } from '@/lib/translate'
import * as auth from '@/lib/auth'
import { GitBranch, ExternalLink, Check, AlertCircle, Settings, Languages, KeyRound } from 'lucide-react'
import { showToast } from './toaster'

interface SettingsPageProps {
  onClose: () => void
  onConfigured: () => void
}

export function SettingsPage({ onClose, onConfigured }: SettingsPageProps) {
  const existing = githubStorage.getConfigOrNull()
  const [token, setToken] = useState(existing?.token || '')
  const [owner, setOwner] = useState(existing?.owner || '')
  const [repo, setRepo] = useState(existing?.repo || '')
  const [branch, setBranch] = useState(existing?.branch || 'main')
  const [deeplKey, setDeeplKeyState] = useState(getDeepLKey() || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testingDeepl, setTestingDeepl] = useState(false)
  const [deeplTestResult, setDeeplTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Change password state
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [newPwdConfirm, setNewPwdConfirm] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  const handleTest = async () => {
    if (!token || !owner || !repo) {
      showToast('Заполните все поля', 'error')
      return
    }
    setTesting(true)
    setTestResult(null)
    
    const tempConfig: GitHubConfig = { token, owner, repo, branch }
    githubStorage.setConfig(tempConfig)
    
    const result = await testConnection()
    setTestResult(result)
    setTesting(false)
    
    if (result.success) {
      showToast('GitHub подключен!', 'success')
    }
  }

  const handleTestDeepL = async () => {
    if (!deeplKey.trim()) {
      showToast('Введите DeepL API ключ', 'error')
      return
    }
    setTestingDeepl(true)
    setDeeplTestResult(null)

    // Temporarily save key to test
    setDeepLKey(deeplKey.trim())

    try {
      const response = await fetch('https://api-free.deepl.com/v2/usage', {
        headers: {
          'Authorization': `DeepL-Auth-Key ${deeplKey.trim()}`,
        },
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const data = await response.json()
        const used = data.character_count || 0
        const limit = data.character_limit || 500000
        setDeeplTestResult({ success: true, error: `Использовано: ${Math.round(used / 1000)}K / ${Math.round(limit / 1000)}K символов` })
        showToast('DeepL подключен!', 'success')
      } else {
        setDeepLKey('') // Remove invalid key
        setDeeplTestResult({ success: false, error: 'Неверный API ключ' })
      }
    } catch (e) {
      setDeepLKey('')
      setDeeplTestResult({ success: false, error: (e as Error).message })
    } finally {
      setTestingDeepl(false)
    }
  }

  const handleSave = () => {
    if (!token || !owner || !repo || !branch) {
      showToast('Заполните поля GitHub', 'error')
      return
    }
    const config: GitHubConfig = { token, owner, repo, branch }
    githubStorage.setConfig(config)
    setDeepLKey(deeplKey.trim())
    showToast('Настройки сохранены', 'success')
    onConfigured()
  }

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || !newPwdConfirm) {
      showToast('Заполните все поля', 'error')
      return
    }
    if (newPwd.length < 4) {
      showToast('Новый пароль слишком короткий (минимум 4 символа)', 'error')
      return
    }
    if (newPwd !== newPwdConfirm) {
      showToast('Новые пароли не совпадают', 'error')
      return
    }
    if (newPwd === oldPwd) {
      showToast('Новый пароль должен отличаться от старого', 'error')
      return
    }
    setChangingPwd(true)
    try {
      const ok = await githubStorage.verifyPasswordAgainstData(oldPwd)
      if (!ok) {
        showToast('Старый пароль неверен', 'error')
        return
      }
      const data = await githubStorage.loadData<{ cards: unknown[]; version?: number }>(oldPwd)
      if (data) {
        await githubStorage.saveData(data, newPwd, 'Смена пароля: перешифрование данных')
      }
      await auth.setPassword(newPwd)
      showToast('Пароль успешно изменён! Данные перешифрованы.', 'success')
      setShowChangePwd(false)
      setOldPwd('')
      setNewPwd('')
      setNewPwdConfirm('')
    } catch (e) {
      showToast('Ошибка: ' + (e as Error).message, 'error')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-bold">Настройки</h2>
        </div>

        <div className="space-y-6">
          {/* GitHub section */}
          <div>
            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Хранилище данных (GitHub)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                  placeholder="github_pat_..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Владелец
                  </label>
                  <input
                    type="text"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    placeholder="Mmitekk"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Репозиторий
                  </label>
                  <input
                    type="text"
                    value={repo}
                    onChange={e => setRepo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    placeholder="static-photos"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ветка
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                  placeholder="main"
                />
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {testResult.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{testResult.success ? 'Подключение успешно!' : testResult.error}</span>
                </div>
              )}

              <button
                onClick={handleTest}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <GitBranch className="w-4 h-4" />
                {testing ? 'Проверка...' : 'Проверить подключение'}
              </button>
            </div>
          </div>

          {/* DeepL section */}
          <div className="border-t border-[var(--border)] pt-5">
            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Переводчик (DeepL)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Опционально. Без ключа используются бесплатные API (Lingva = Google Translate).
              DeepL Free: 500K символов/мес — <a href="https://www.deepl.com/pro#developer" target="_blank" rel="noopener" className="text-purple-500 underline">получить ключ</a>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  DeepL API Key (Free)
                </label>
                <input
                  type="password"
                  value={deeplKey}
                  onChange={e => setDeeplKeyState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                  placeholder="Оставьте пустым если нет ключа"
                />
              </div>

              {deeplTestResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  deeplTestResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {deeplTestResult.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{deeplTestResult.success ? deeplTestResult.error : deeplTestResult.error}</span>
                </div>
              )}

              <button
                onClick={handleTestDeepL}
                disabled={testingDeepl || !deeplKey.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Languages className="w-4 h-4" />
                {testingDeepl ? 'Проверка...' : 'Проверить DeepL'}
              </button>
            </div>
          </div>

          {/* Change password section */}
          <div className="border-t border-[var(--border)] pt-5">
            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Пароль шифрования
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Данные в репозитории зашифрованы AES-256 с ключом, производным от пароля.
              Смена пароля перешифрует все данные.
            </p>

            {!showChangePwd ? (
              <button
                onClick={() => setShowChangePwd(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Сменить пароль
              </button>
            ) : (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Текущий пароль
                  </label>
                  <input
                    type="password"
                    value={oldPwd}
                    onChange={e => setOldPwd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    placeholder="Введите текущий пароль"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    placeholder="Минимум 4 символа"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Повторите новый пароль
                  </label>
                  <input
                    type="password"
                    value={newPwdConfirm}
                    onChange={e => setNewPwdConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    placeholder="Повторите новый пароль"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPwd}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {changingPwd ? 'Перешифрование...' : 'Сменить пароль'}
                  </button>
                  <button
                    onClick={() => { setShowChangePwd(false); setOldPwd(''); setNewPwd(''); setNewPwdConfirm('') }}
                    disabled={changingPwd}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="border-t border-[var(--border)] pt-4">
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Сохранить все настройки
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
