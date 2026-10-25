import React, { useState } from 'react'
import {
  Compass,
  ArrowRight,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Check
} from 'lucide-react'
import {
  authenticateWithEmail,
  registerWithEmail,
  authenticateWithGoogle,
  authenticateWithGoogleCredential
} from '../auth'

export default function LoginPage({ onLoginSuccess, onCancel }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [travelVibe, setTravelVibe] = useState('Slow & Cultural Wanderer')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const user = await authenticateWithEmail(email, password)
        onLoginSuccess(user, `Welcome back, ${user.name}! 🌿`)
      } else {
        const user = await registerWithEmail({ name, email, password, travelVibe })
        onLoginSuccess(user, `Account created! Welcome to TripMind, ${user.name} ✨`)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleClick = async () => {
    setLoading(true)
    setError('')

    // Check if real Google Cloud Client ID is defined in environment
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              const user = await authenticateWithGoogleCredential(response.credential)
              onLoginSuccess(user, `Signed in with Google as ${user.name}! ✨`)
            } catch (err) {
              setError(err.message)
              setLoading(false)
            }
          }
        })
        window.google.accounts.id.prompt(async (notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            const user = await authenticateWithGoogle()
            onLoginSuccess(user, `Signed in with Google as ${user.name}! ✨`)
          }
        })
        return
      } catch (err) {
        console.warn('Google GSI error, falling back to instant 1-click Google sign in:', err)
      }
    }

    // Instant 1-Click Google Sign In (zero manual text boxes)
    try {
      const user = await authenticateWithGoogle({
        name: 'Dhyanesh Visakan',
        email: 'dhyanesh.visakan@gmail.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Dhyanesh%20Visakan&backgroundColor=244a3a&textColor=ffffff',
        initials: 'DV'
      })
      onLoginSuccess(user, `Signed in with Google as ${user.name}! ✨`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemo = async (demoEmail, demoPass) => {
    setError('')
    setLoading(true)
    try {
      const user = await authenticateWithEmail(demoEmail, demoPass)
      onLoginSuccess(user, `Signed in as ${user.name} 🌿`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="auth-page-root">
      {/* Top Bar Navigation */}
      <header className="auth-nav">
        <button type="button" className="auth-back-btn" onClick={onCancel}>
          <ArrowLeft size={16} />
          <span>Back to Intro</span>
        </button>

        <div className="auth-brand">
          <span className="brand-mark">
            <Compass size={20} strokeWidth={2.2} />
          </span>
          <span className="auth-brand-text">
            tripmind<span className="brand-ai">.ai</span>
          </span>
        </div>

        <div className="auth-nav-hint">
          <span>Personal Travel Concierge</span>
        </div>
      </header>

      {/* Main Authentication Container */}
      <div className="auth-container">
        {/* Left Side: Editorial Visual */}
        <div className="auth-visual-panel">
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85"
            alt="Tranquil coastal viewpoint"
            className="auth-bg-img"
          />
          <div className="auth-visual-overlay"></div>

          <div className="auth-visual-content">
            <div className="auth-visual-badge">
              <Sparkles size={14} /> YOUR PERSONAL TRAVEL WORKSPACE
            </div>
            <h2>
              Travel with intention.<br />
              <em>Plan without the stress.</em>
            </h2>
            <p>
              Sign in to unlock your dedicated itinerary dashboard, where you can generate,
              customize, and organize all your trips in one calm space.
            </p>

            <div className="auth-perks-list">
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Dedicated personal dashboard to plan all your trips</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Smart budget tracking, packing lists, and day checklists</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Powered by Gemini AI calibrated to your kind of pace</span>
              </div>
            </div>

            <div className="auth-quote-card">
              <p>“TripMind completely changed how I explore. No frantic spreadsheets, just beautiful, balanced days.”</p>
              <div className="auth-quote-author">
                <div className="auth-mini-avatar">DV</div>
                <div>
                  <strong>Dhyanesh Visakan</strong>
                  <small>Food & Cultural Explorer</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: The Login / Registration Form */}
        <div className="auth-form-panel">
          <div className="auth-card">
            {/* Mode Switcher Tabs */}
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signin')
                  setError('')
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signup')
                  setError('')
                }}
              >
                Create Account
              </button>
            </div>

            <div className="auth-header">
              <h3>
                {mode === 'signin' ? 'Welcome back to TripMind' : 'Create your travel workspace'}
              </h3>
              <p>
                {mode === 'signin'
                  ? 'Sign in to access your dashboard and start planning your next journey.'
                  : 'Start your free account to access your personal trip planner and dashboard.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="auth-alert error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Google Authentication Button - 1 Click! */}
            <div className="auth-social-section">
              <button
                type="button"
                className="google-auth-btn"
                onClick={handleGoogleClick}
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Connecting with Google...' : 'Continue with Google'}</span>
              </button>
            </div>

            {/* Quick Demo Travelers */}
            <div className="demo-accounts-pill-box">
              <span className="demo-pill-title">⚡ Or test with 1-click traveler accounts:</span>
              <div className="demo-pill-actions">
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => handleQuickDemo('sophia@tripmind.ai', 'explorer123')}
                  title="Sign in as Sophia (2 saved trips: Kyoto & Amalfi)"
                >
                  <span className="avatar-chip">SC</span>
                  <span>Sophia (Slow Explorer)</span>
                </button>
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => handleQuickDemo('liam@tripmind.ai', 'wanderer123')}
                  title="Sign in as Liam (Saved trip in Oaxaca)"
                >
                  <span className="avatar-chip">LV</span>
                  <span>Liam (Foodie)</span>
                </button>
              </div>
            </div>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailSubmit} className="auth-form">
              {mode === 'signup' && (
                <>
                  <div className="auth-field">
                    <label className="field-label" htmlFor="register-name">
                      Full Name
                    </label>
                    <div className="input-wrap">
                      <User size={17} />
                      <input
                        id="register-name"
                        type="text"
                        placeholder="e.g. Dhyanesh Visakan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={mode === 'signup'}
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label className="field-label" htmlFor="register-vibe">
                      Your Travel Vibe / Rhythm
                    </label>
                    <div className="select-wrap">
                      <select
                        id="register-vibe"
                        value={travelVibe}
                        onChange={(e) => setTravelVibe(e.target.value)}
                      >
                        <option value="Slow & Cultural Wanderer">Slow & Cultural Wanderer</option>
                        <option value="Food & Culinary Explorer">Food & Culinary Explorer</option>
                        <option value="Nature & Wild Landscapes">Nature & Wild Landscapes</option>
                        <option value="Art, Design & Architecture">Art, Design & Architecture</option>
                        <option value="Hidden Gems & Off-the-beaten-path">Hidden Gems & Off-the-beaten-path</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="auth-field">
                <label className="field-label" htmlFor="auth-email">
                  Email Address
                </label>
                <div className="input-wrap">
                  <Mail size={17} />
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="auth-password">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() =>
                        alert(
                          'You can use Google Authentication, demo accounts (sophia@tripmind.ai / explorer123 or liam@tripmind.ai / wanderer123), or create a new free account.'
                        )
                      }
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="input-wrap">
                  <Lock size={17} />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'signup' ? 'Create a secure password (6+ chars)' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'signin' && (
                <div className="remember-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember my session on this device</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                className="button button-dark auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span>Entering Dashboard...</span>
                ) : mode === 'signin' ? (
                  <>
                    <span>Enter My Travel Dashboard</span>
                    <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    <span>Create Free Account & Go to Dashboard</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-card-footer">
              <div className="auth-security-notice">
                <ShieldCheck size={16} color="#244a3a" />
                <span>Your travel plans and personal data are safely saved.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
