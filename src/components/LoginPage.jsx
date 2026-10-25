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
  Heart,
  Globe
} from 'lucide-react'
import {
  authenticateWithEmail,
  registerWithEmail,
  authenticateWithGoogle
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
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [customGoogleEmail, setCustomGoogleEmail] = useState('')
  const [customGoogleName, setCustomGoogleName] = useState('')

  const handleEmailSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      try {
        if (mode === 'signin') {
          const user = authenticateWithEmail(email, password)
          onLoginSuccess(user, `Welcome back, ${user.name}! 🌿`)
        } else {
          const user = registerWithEmail({ name, email, password, travelVibe })
          onLoginSuccess(user, `Account created! Welcome to TripMind, ${user.name} ✨`)
        }
      } catch (err) {
        setError(err.message || 'Authentication failed. Please try again.')
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  const handleQuickDemo = (demoEmail, demoPass) => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      try {
        const user = authenticateWithEmail(demoEmail, demoPass)
        onLoginSuccess(user, `Signed in as ${user.name} (Demo Account) 🌿`)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const handleGoogleSignIn = (profile = null) => {
    setLoading(true)
    setError('')
    setTimeout(() => {
      try {
        const user = authenticateWithGoogle(profile)
        setShowGoogleModal(false)
        onLoginSuccess(user, `Signed in with Google as ${user.name}! ✨`)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  return (
    <div className="auth-page-root">
      {/* Top Bar Navigation */}
      <header className="auth-nav">
        <button type="button" className="auth-back-btn" onClick={onCancel}>
          <ArrowLeft size={16} />
          <span>Back to Explore</span>
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
          <span>Curated Travel Concierge</span>
        </div>
      </header>

      {/* Main Authentication Container */}
      <div className="auth-container">
        {/* Left Side: Editorial Mood & Brand Story */}
        <div className="auth-visual-panel">
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85"
            alt="Tranquil coastal viewpoint"
            className="auth-bg-img"
          />
          <div className="auth-visual-overlay"></div>

          <div className="auth-visual-content">
            <div className="auth-visual-badge">
              <Sparkles size={14} /> YOUR PERSONAL ITINERARY DASHBOARD
            </div>
            <h2>
              Travel with intention.<br />
              <em>Plan without the stress.</em>
            </h2>
            <p>
              Sign in to unlock your personal trip workspace, keep all your day-by-day itineraries
              in one calm space, and tailor recommendations to your travel rhythm.
            </p>

            <div className="auth-perks-list">
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Dedicated travel dashboard for all your upcoming and dream trips</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Smart budget tracking, packing lists, and day checklists</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle2 size={18} color="#e9a46d" />
                <span>Powered by Gemini AI with custom concierge preferences</span>
              </div>
            </div>

            <div className="auth-quote-card">
              <p>“TripMind completely changed how I explore. No frantic spreadsheets, just beautiful, balanced days.”</p>
              <div className="auth-quote-author">
                <div className="auth-mini-avatar">SC</div>
                <div>
                  <strong>Sophia Chen</strong>
                  <small>Slow traveler & architectural writer</small>
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
                {mode === 'signin' ? 'Welcome back to TripMind' : 'Start your travel journey'}
              </h3>
              <p>
                {mode === 'signin'
                  ? 'Access your private itineraries and continue crafting your adventures.'
                  : 'Create your private dashboard and begin personalizing your itineraries.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="auth-alert error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Google Authentication Button */}
            <div className="auth-social-section">
              <button
                type="button"
                className="google-auth-btn"
                onClick={() => setShowGoogleModal(true)}
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
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Quick Demo Accounts Banner */}
            <div className="demo-accounts-pill-box">
              <span className="demo-pill-title">⚡ Quick 1-Click Demo Accounts:</span>
              <div className="demo-pill-actions">
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => handleQuickDemo('sophia@tripmind.ai', 'explorer123')}
                  title="Sign in as Sophia (2 planned trips in Kyoto & Amalfi)"
                >
                  <span className="avatar-chip">SC</span>
                  <span>Sophia (Slow Explorer)</span>
                </button>
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => handleQuickDemo('liam@tripmind.ai', 'wanderer123')}
                  title="Sign in as Liam (Planned trip in Oaxaca)"
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
                        placeholder="e.g. Maya Lin"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={mode === 'signup'}
                      />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label className="field-label" htmlFor="register-vibe">
                      Your Travel Vibe / Style
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
                          'For this preview, you can use the demo accounts (sophia@tripmind.ai / explorer123 or liam@tripmind.ai / wanderer123) or Google authentication.'
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
                  <span>Authenticating...</span>
                ) : mode === 'signin' ? (
                  <>
                    <span>Enter My Travel Dashboard</span>
                    <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    <span>Create My Free Account</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-card-footer">
              <div className="auth-security-notice">
                <ShieldCheck size={16} color="#244a3a" />
                <span>Your travel plans and personal data are safely encrypted.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Authentication Modal Simulator */}
      {showGoogleModal && (
        <div className="modal-backdrop" onClick={() => setShowGoogleModal(false)}>
          <div className="modal-sheet google-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="google-dialog-header">
              <svg viewBox="0 0 24 24" width="24" height="24">
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
              <div>
                <h4>Sign in with Google</h4>
                <p>Choose an account to continue to TripMind AI</p>
              </div>
            </div>

            <div className="google-accounts-list">
              <button
                type="button"
                className="google-account-choice"
                onClick={() =>
                  handleGoogleSignIn({
                    name: 'Julian Thorne',
                    email: 'julian.thorne@gmail.com',
                    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
                    initials: 'JT'
                  })
                }
              >
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                  alt="Julian Thorne"
                  className="google-user-avatar"
                />
                <div className="google-user-info">
                  <strong>Julian Thorne</strong>
                  <span>julian.thorne@gmail.com</span>
                </div>
              </button>

              <button
                type="button"
                className="google-account-choice"
                onClick={() =>
                  handleGoogleSignIn({
                    name: 'Elena Rostova',
                    email: 'elena.travels@gmail.com',
                    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
                    initials: 'ER'
                  })
                }
              >
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
                  alt="Elena Rostova"
                  className="google-user-avatar"
                />
                <div className="google-user-info">
                  <strong>Elena Rostova</strong>
                  <span>elena.travels@gmail.com</span>
                </div>
              </button>
            </div>

            <div className="google-custom-entry">
              <span className="google-custom-kicker">Or enter your own Google account details:</span>
              <div className="google-input-group">
                <input
                  type="text"
                  placeholder="Your Name (e.g. David Miller)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Your Google Email (e.g. david@gmail.com)"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="button button-dark"
                  disabled={!customGoogleEmail.trim()}
                  onClick={() =>
                    handleGoogleSignIn({
                      name: customGoogleName.trim() || customGoogleEmail.split('@')[0],
                      email: customGoogleEmail.trim(),
                      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(customGoogleEmail)}`,
                      initials: (customGoogleName.trim() || customGoogleEmail).slice(0, 2).toUpperCase()
                    })
                  }
                >
                  Sign In as {customGoogleEmail.split('@')[0] || 'User'}
                </button>
              </div>
            </div>

            <div className="google-dialog-footer">
              <button
                type="button"
                className="google-cancel-btn"
                onClick={() => setShowGoogleModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
