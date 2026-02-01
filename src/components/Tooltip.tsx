import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../contexts/ThemeContext'
import './Tooltip.css'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 400,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const calculatePosition = () => {
    if (!triggerRef.current) return { x: 0, y: 0 }

    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipHeight = 28 // Approximate height
    const tooltipPadding = 8

    let x = 0
    let y = 0

    switch (position) {
      case 'top':
        x = rect.left + rect.width / 2
        y = rect.top - tooltipPadding - tooltipHeight
        break
      case 'bottom':
        x = rect.left + rect.width / 2
        y = rect.bottom + tooltipPadding
        break
      case 'left':
        x = rect.left - tooltipPadding
        y = rect.top + rect.height / 2
        break
      case 'right':
        x = rect.right + tooltipPadding
        y = rect.top + rect.height / 2
        break
    }

    return { x, y }
  }

  const showTooltip = () => {
    // Calculate position immediately
    const pos = calculatePosition()
    setCoords(pos)

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const tooltipElement = isVisible && (
    <div
      ref={tooltipRef}
      className={`tooltip tooltip--${position} ${isDark ? 'tooltip--dark' : 'tooltip--light'}`}
      style={{
        left: coords.x,
        top: coords.y,
      }}
    >
      {content}
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {createPortal(tooltipElement, document.body)}
    </>
  )
}

export default Tooltip
