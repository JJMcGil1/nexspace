import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { UserProfile, NexSpace } from '../types/electron'

interface UserContextType {
  // User profile
  user: UserProfile | null
  setUser: (user: UserProfile) => Promise<void>

  // Onboarding state
  onboardingComplete: boolean
  completeOnboarding: () => Promise<void>

  // NexSpaces
  nexspaces: NexSpace[]
  addNexSpace: (title: string, coverImage?: string, coverColor?: string) => Promise<NexSpace>
  updateNexSpace: (id: string, updates: Partial<NexSpace>) => Promise<void>
  deleteNexSpace: (id: string) => Promise<void>

  // Loading state
  isLoading: boolean
}

const UserContext = createContext<UserContextType | null>(null)

// Avatar/cover color palette - vibrant, modern colors
export const NEXSPACE_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
]

function getRandomColor(): string {
  return NEXSPACE_COLORS[Math.floor(Math.random() * NEXSPACE_COLORS.length)]
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserProfile | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [nexspaces, setNexSpaces] = useState<NexSpace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load data from store on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedUser = await window.electronAPI.store.get<UserProfile | null>('user')
        const storedOnboarding = await window.electronAPI.store.get<boolean>('onboardingComplete')
        // Support both old 'canvases' key and new 'nexspaces' key for migration
        let storedNexSpaces = await window.electronAPI.store.get<NexSpace[]>('nexspaces')
        if (!storedNexSpaces || storedNexSpaces.length === 0) {
          // Try loading from old 'canvases' key for migration
          const oldCanvases = await window.electronAPI.store.get<NexSpace[]>('canvases')
          if (oldCanvases && oldCanvases.length > 0) {
            storedNexSpaces = oldCanvases.map(c => ({
              ...c,
              coverColor: c.coverColor || getRandomColor(),
            }))
            // Migrate to new key
            await window.electronAPI.store.set('nexspaces', storedNexSpaces)
          }
        }

        setUserState(storedUser || null)
        setOnboardingComplete(storedOnboarding || false)
        setNexSpaces(storedNexSpaces || [])
      } catch (error) {
        console.error('Failed to load data from store:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Listen for canvas refresh events and sync nexspaces state
  useEffect(() => {
    const unsubRefresh = window.electronAPI.canvas.onRefresh(async (freshNexSpaces) => {
      console.log('[UserContext] Canvas refresh event - syncing nexspaces')
      // Update our local state with the fresh data from store
      setNexSpaces(freshNexSpaces as NexSpace[])
    })

    return () => {
      unsubRefresh()
    }
  }, [])

  // Set user profile
  const setUser = useCallback(async (newUser: UserProfile) => {
    const userWithDefaults: UserProfile = {
      ...newUser,
      id: newUser.id || generateId(),
      avatarColor: newUser.avatarColor || getRandomColor(),
      createdAt: newUser.createdAt || new Date().toISOString(),
    }

    await window.electronAPI.store.set('user', userWithDefaults)
    setUserState(userWithDefaults)
  }, [])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    await window.electronAPI.store.set('onboardingComplete', true)
    setOnboardingComplete(true)
  }, [])

  // Add a new NexSpace
  const addNexSpace = useCallback(async (
    title: string,
    coverImage?: string,
    coverColor?: string
  ): Promise<NexSpace> => {
    const newNexSpace: NexSpace = {
      id: generateId(),
      title: title || 'Untitled NexSpace',
      coverImage,
      coverColor: coverColor || getRandomColor(),
      lastEdited: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      chatMessages: [],
    }

    // IMPORTANT: Always read fresh from store to avoid race conditions with CanvasContext
    const freshNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const updatedNexSpaces = [newNexSpace, ...freshNexSpaces]
    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setNexSpaces(updatedNexSpaces)

    return newNexSpace
  }, [])

  // Update a NexSpace
  const updateNexSpace = useCallback(async (id: string, updates: Partial<NexSpace>) => {
    // IMPORTANT: Always read fresh from store to avoid race conditions with CanvasContext
    const freshNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const updatedNexSpaces = freshNexSpaces.map(ns =>
      ns.id === id ? { ...ns, ...updates, lastEdited: new Date().toISOString() } : ns
    )

    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setNexSpaces(updatedNexSpaces)
  }, [])

  // Delete a NexSpace
  const deleteNexSpace = useCallback(async (id: string) => {
    // IMPORTANT: Always read fresh from store to avoid race conditions with CanvasContext
    const freshNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const updatedNexSpaces = freshNexSpaces.filter(ns => ns.id !== id)
    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setNexSpaces(updatedNexSpaces)
  }, [])

  const value: UserContextType = {
    user,
    setUser,
    onboardingComplete,
    completeOnboarding,
    nexspaces,
    addNexSpace,
    updateNexSpace,
    deleteNexSpace,
    isLoading,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = (): UserContextType => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
