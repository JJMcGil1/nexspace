import React, { createContext, useContext, useState, useCallback } from 'react'

interface DeleteConfirmationOptions {
  title: string
  message: string
  itemName?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

interface DeleteConfirmationContextType {
  isOpen: boolean
  options: DeleteConfirmationOptions | null
  showDeleteConfirmation: (options: DeleteConfirmationOptions) => void
  hideDeleteConfirmation: () => void
  confirm: () => void
}

const DeleteConfirmationContext = createContext<DeleteConfirmationContextType | null>(null)

export const useDeleteConfirmation = () => {
  const context = useContext(DeleteConfirmationContext)
  if (!context) {
    throw new Error('useDeleteConfirmation must be used within DeleteConfirmationProvider')
  }
  return context
}

interface DeleteConfirmationProviderProps {
  children: React.ReactNode
}

export const DeleteConfirmationProvider: React.FC<DeleteConfirmationProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<DeleteConfirmationOptions | null>(null)

  const showDeleteConfirmation = useCallback((opts: DeleteConfirmationOptions) => {
    setOptions(opts)
    setIsOpen(true)
  }, [])

  const hideDeleteConfirmation = useCallback(() => {
    setIsOpen(false)
    if (options?.onCancel) {
      options.onCancel()
    }
    // Delay clearing options to allow animation
    setTimeout(() => setOptions(null), 200)
  }, [options])

  const confirm = useCallback(() => {
    if (options?.onConfirm) {
      options.onConfirm()
    }
    setIsOpen(false)
    setTimeout(() => setOptions(null), 200)
  }, [options])

  return (
    <DeleteConfirmationContext.Provider
      value={{
        isOpen,
        options,
        showDeleteConfirmation,
        hideDeleteConfirmation,
        confirm,
      }}
    >
      {children}
    </DeleteConfirmationContext.Provider>
  )
}
