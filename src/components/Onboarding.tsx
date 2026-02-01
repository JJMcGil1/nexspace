import React, { useState, useRef } from 'react'
import { useUser, NEXSPACE_COLORS } from '../contexts/UserContext'
import { useTheme } from '../contexts/ThemeContext'
import { LuArrowRight, LuSparkles, LuUser, LuCheck, LuCamera, LuSun, LuMoon, LuX } from 'react-icons/lu'
import './Onboarding.css'

const Onboarding: React.FC = () => {
  const { setUser, completeOnboarding, addNexSpace } = useUser()
  const { theme, setTheme } = useTheme()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarImage, setAvatarImage] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState(NEXSPACE_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setAvatarImage(result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setAvatarImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)

    try {
      // Save user profile
      await setUser({
        id: '',
        name: name.trim(),
        email: email.trim() || '',
        avatarColor: avatarColor,
        avatarImage: avatarImage || undefined,
        createdAt: '',
      })

      // Create a default first canvas
      await addNexSpace('My First NexSpace')

      // Complete onboarding
      await completeOnboarding()
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      setIsSubmitting(false)
    }
  }

  const handleContinue = () => {
    setStep(1)
  }

  // Get initials for avatar fallback
  const getInitials = () => {
    if (!name.trim()) return '?'
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="onboarding">
      {/* Background gradient */}
      <div className="onboarding__bg" />

      {/* Floating orbs for visual interest */}
      <div className="onboarding__orb onboarding__orb--1" />
      <div className="onboarding__orb onboarding__orb--2" />
      <div className="onboarding__orb onboarding__orb--3" />

      <div className="onboarding__container">
        {step === 0 ? (
          // Welcome screen
          <div className="onboarding__welcome">
            <div className="onboarding__logo">
              <LuSparkles size={48} />
            </div>
            <h1 className="onboarding__title">Welcome to NexSpace</h1>
            <p className="onboarding__subtitle">
              Your AI-powered workspace for creative thinking.
              <br />
              Let's get you set up in just a moment.
            </p>
            <button
              className="onboarding__button onboarding__button--primary"
              onClick={handleContinue}
            >
              Get Started
              <LuArrowRight size={18} />
            </button>
          </div>
        ) : (
          // Profile setup
          <div className="onboarding__setup">
            <h2 className="onboarding__setup-title">Create your profile</h2>
            <p className="onboarding__setup-subtitle">
              This stays on your machine — we don't collect any data.
            </p>

            <form className="onboarding__form" onSubmit={handleSubmit}>
              {/* Avatar Section */}
              <div className="onboarding__avatar-section">
                <div className="onboarding__avatar-preview-wrapper">
                  <button
                    type="button"
                    className="onboarding__avatar-upload"
                    onClick={handleAvatarClick}
                  >
                    {avatarImage ? (
                      <img
                        src={avatarImage}
                        alt="Profile"
                        className="onboarding__avatar-image"
                      />
                    ) : (
                      <div
                        className="onboarding__avatar-initials"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {name.trim() ? getInitials() : <LuUser size={32} />}
                      </div>
                    )}
                    <div className="onboarding__avatar-overlay">
                      <LuCamera size={20} />
                    </div>
                  </button>
                  {avatarImage && (
                    <button
                      type="button"
                      className="onboarding__avatar-remove"
                      onClick={handleRemoveImage}
                      aria-label="Remove photo"
                    >
                      <LuX size={14} />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="onboarding__file-input"
                />

                {/* Color Picker - only show when no image uploaded */}
                {!avatarImage && (
                  <div className="onboarding__color-picker">
                    <span className="onboarding__color-label">Choose a color</span>
                    <div className="onboarding__color-options">
                      {NEXSPACE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`onboarding__color-option ${avatarColor === color ? 'onboarding__color-option--active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setAvatarColor(color)}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <span className="onboarding__avatar-hint">
                  {avatarImage ? 'Click to change photo' : 'Click avatar to upload photo'}
                </span>
              </div>

              <div className="onboarding__field">
                <label htmlFor="name" className="onboarding__label">
                  Name <span className="onboarding__required">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  className="onboarding__input"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="onboarding__field">
                <label htmlFor="email" className="onboarding__label">
                  Email <span className="onboarding__optional">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className="onboarding__input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Theme Selection */}
              <div className="onboarding__field">
                <label className="onboarding__label">Appearance</label>
                <div className="onboarding__theme-picker">
                  <button
                    type="button"
                    className={`onboarding__theme-option ${theme === 'light' ? 'onboarding__theme-option--active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <div className="onboarding__theme-icon onboarding__theme-icon--light">
                      <LuSun size={20} />
                    </div>
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`onboarding__theme-option ${theme === 'dark' ? 'onboarding__theme-option--active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <div className="onboarding__theme-icon onboarding__theme-icon--dark">
                      <LuMoon size={20} />
                    </div>
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              <div className="onboarding__privacy">
                <LuCheck size={14} />
                <span>All your data is stored locally on your device</span>
              </div>

              <button
                type="submit"
                className="onboarding__button onboarding__button--primary"
                disabled={!name.trim() || isSubmitting}
              >
                {isSubmitting ? 'Setting up...' : 'Continue to NexSpace'}
                <LuArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {/* Step indicator */}
        <div className="onboarding__steps">
          <div className={`onboarding__step-dot ${step >= 0 ? 'onboarding__step-dot--active' : ''}`} />
          <div className={`onboarding__step-dot ${step >= 1 ? 'onboarding__step-dot--active' : ''}`} />
        </div>
      </div>
    </div>
  )
}

export default Onboarding
