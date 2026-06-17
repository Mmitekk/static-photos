import { useState, useEffect, useCallback } from 'react'
import * as auth from '@/lib/auth'
import * as githubStorage from '@/lib/github-storage'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isPasswordSet: boolean  // true if data file exists OR hash in localStorage
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    isPasswordSet: false,
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      // If already authenticated in this session, no need to recheck
      if (auth.isAuthenticated()) {
        if (!cancelled) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            isPasswordSet: true,
          })
        }
        return
      }

      // Check if there's existing data to determine login mode:
      // - If GitHub is not configured yet, can't check — fall back to localStorage hash
      // - If data file exists → must enter password to decrypt → isPasswordSet = true
      // - If no data file → first-time setup → isPasswordSet = false
      let passwordSet = auth.isPasswordSet()
      if (githubStorage.isConfigured()) {
        try {
          const exists = await githubStorage.dataFileExists()
          if (exists) passwordSet = true
        } catch {
          // Network error — fall back to localStorage hash check
        }
      }

      if (!cancelled) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          isPasswordSet: passwordSet,
        })
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (password: string): Promise<boolean> => {
    // Verify password against actual encrypted data (if data exists)
    // This handles 3 cases:
    //   1. Data exists & encrypted → password must decrypt it
    //   2. Data exists & plaintext (legacy) → any password OK, will be re-encrypted on next save
    //   3. No data → any password OK, hash gets stored for future
    const verifier = githubStorage.isConfigured()
      ? (pw: string) => githubStorage.verifyPasswordAgainstData(pw)
      : undefined

    const valid = await auth.verifyPassword(password, verifier)
    if (valid) {
      auth.setAuthenticated()
      setState(prev => ({ ...prev, isAuthenticated: true }))
    }
    return valid
  }, [])

  const setup = useCallback(async (password: string): Promise<void> => {
    await auth.setPassword(password)
    auth.setAuthenticated()
    setState({ isAuthenticated: true, isLoading: false, isPasswordSet: true })
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setState(prev => ({ ...prev, isAuthenticated: false }))
  }, [])

  return { ...state, login, setup, logout }
}
