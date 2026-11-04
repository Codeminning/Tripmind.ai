import React, { useState, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  FolderHeart,
  Heart,
  LogIn,
  LogOut,
  LayoutDashboard,
  MapPin,
  Menu,
  Sparkles,
  Sun,
  Moon,
  WandSparkles,
  X
} from 'lucide-react'
import { AppFooter } from './components/AppFooter'
import {
  getActiveSession,
  logOutUser,
  getUserTrips,
  saveUserTrip,
  syncSessionWithNeon
} from './auth'
import './styles.css'

// Lazy-load views with React.lazy to keep initial landing page bundle lightweight
const LoginPage = lazy(() => import('./components/LoginPage'))
const DashboardView = lazy(() => import('./components/DashboardView'))
const SharedTripView = lazy(() => import('./components/SharedTripView'))
const JoinTripView = lazy(() => import('./components/JoinTripView').then(m => ({ default: m.JoinTripView })))
const AboutPage = lazy(() => import('./components/TrustPages').then(m => ({ default: m.AboutPage })))
const PrivacyPage = lazy(() => import('./components/TrustPages').then(m => ({ default: m.PrivacyPage })))
const ContactPage = lazy(() => import('./components/TrustPages').then(m => ({ default: m.ContactPage })))

function ViewLoadingFallback() {
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      color: 'var(--muted, #596055)',
      fontFamily: "'DM Sans', sans-serif"
    }} role="status" aria-live="polite">
      <div className="spinner-dot" aria-hidden="true" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
      <span>Loading workspace...</span>
    </div>
  )
}

const destinationCards = [
  {
    name: 'Kyoto, Japan',
    subtitle: 'Kyoto, in quiet moments',
    tag: 'JAPAN · CULTURE',
    detail: 'Temple paths & serene tea houses',
    days: '4',
    budget: 'Mid-range',
    interests: ['Food & cafés', 'Culture & heritage', 'Slow travel'],
    img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80',
    number: '01'
  },
  {
    name: 'Bali, Indonesia',
    subtitle: 'Bali beyond the beach',
    tag: 'INDONESIA · NATURE',
    detail: 'Lush retreats & spiritual escapes',
    days: '5',
    budget: 'Budget-friendly',
    interests: ['Nature & outdoors', 'Hidden gems', 'Slow travel'],
    img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80',
    number: '02'
  },
  {
    name: 'Lisbon, Portugal',
    subtitle: 'Lisbon, take the long way',
    tag: 'PORTUGAL · CITY BREAK',
    detail: 'Tile-lined miradouros & sunsets',
    days: '3',
    budget: 'Mid-range',
    interests: ['Food & cafés', 'Art & design', 'Culture & heritage'],
    img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=80',
    number: '03'
  },
  {
    name: 'Amalfi Coast, Italy',
    subtitle: 'Cliffside coastal dream',
    tag: 'ITALY · SCENIC',
    detail: 'Pastel villages & lemon groves',
    days: '4',
    budget: 'Treat yourself',
    interests: ['Food & cafés', 'Nature & outdoors', 'Slow travel'],
    img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&q=80',
    number: '04'
  },
  {
    name: 'Oaxaca, Mexico',
    subtitle: 'Artisan soul & culinary roots',
    tag: 'MEXICO · GASTRONOMY',
    detail: 'Mole tastings & vibrant markets',
    days: '4',
    budget: 'Budget-friendly',
    interests: ['Food & cafés', 'Culture & heritage', 'Art & design'],
    img: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=900&q=80',
    number: '05'
  },
  {
    name: 'Reykjavík, Iceland',
    subtitle: 'Nordic landscapes & hot springs',
    tag: 'ICELAND · ADVENTURE',
    detail: 'Volcanic wonders & dark skies',
    days: '5',
    budget: 'Treat yourself',
    interests: ['Adventure', 'Nature & outdoors', 'Hidden gems'],
    img: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=900&q=80',
    number: '06'
  }
]

function parseRoute() {
  if (typeof window === 'undefined') return { view: 'landing', shareId: null, inviteToken: null }
  const pathname = window.location.pathname
  if (pathname.startsWith('/t/')) {
    const id = pathname.replace(/^\/t\/?/, '').split('/')[0]
    if (id) return { view: 'shared', shareId: id, inviteToken: null }
  }
  if (pathname.startsWith('/join/')) {
    const token = pathname.replace(/^\/join\/?/, '').split('/')[0]
    if (token) return { view: 'join', shareId: null, inviteToken: token }
  }
  const hash = window.location.hash
  if (hash.startsWith('#/t/') || hash.startsWith('#t/')) {
    const id = hash.replace(/^#\/?t\/?/, '').split('/')[0]
    if (id) return { view: 'shared', shareId: id, inviteToken: null }
  }
  if (hash.startsWith('#/join/') || hash.startsWith('#join/')) {
    const token = hash.replace(/^#\/?join\/?/, '').split('/')[0]
    if (token) return { view: 'join', shareId: null, inviteToken: token }
  }
  if (hash === '#/login' || hash === '#login') return { view: 'login', shareId: null, inviteToken: null }
  if (hash === '#/dashboard' || hash === '#dashboard' || hash === '#/planner' || hash === '#planner') return { view: 'dashboard', shareId: null, inviteToken: null }
  if (hash === '#/about' || hash === '#about') return { view: 'about', shareId: null, inviteToken: null }
  if (hash === '#/privacy' || hash === '#privacy') return { view: 'privacy', shareId: null, inviteToken: null }
  if (hash === '#/contact' || hash === '#contact') return { view: 'contact', shareId: null, inviteToken: null }
  return { view: 'landing', shareId: null, inviteToken: null }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => (typeof window !== 'undefined' ? getActiveSession() : null))
  const [sharedTripId, setSharedTripId] = useState(() => parseRoute().shareId)
  const [inviteToken, setInviteToken] = useState(() => parseRoute().inviteToken)
  const [currentView, setCurrentView] = useState(() => parseRoute().view)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      return localStorage.getItem('tripmind_theme') || 'light'
    } catch (e) {
      return 'light'
    }
  })

  // Initialize theme (strictly light or dark)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('tripmind_theme') || 'light'
      const active = savedTheme === 'dark' ? 'dark' : 'light'
      setTheme(active)
      document.documentElement.setAttribute('data-theme', active)
    } catch (e) {}
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('tripmind_theme', next)
      document.documentElement.setAttribute('data-theme', next)
    } catch (e) {}
  }

  // Dynamic robots meta tag: noindex dashboard/user pages, allow landing/legal pages (SEO requirement)
  useEffect(() => {
    if (typeof document === 'undefined') return
    let robotsMeta = document.querySelector('meta[name="robots"]')
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.name = 'robots'
      document.head.appendChild(robotsMeta)
    }
    if (currentView === 'dashboard') {
      robotsMeta.content = 'noindex, nofollow'
    } else {
      robotsMeta.content = 'index, follow'
    }
  }, [currentView])

  // Listen to hash and browser popstate changes for seamless navigation
  useEffect(() => {
    const onLocationChange = () => {
      const route = parseRoute()
      setCurrentView(route.view)
      if (route.shareId) {
        setSharedTripId(route.shareId)
      }
      if (route.view === 'dashboard') {
        const session = getActiveSession()
        if (session) {
          setCurrentUser(session)
        }
      }
    }
    window.addEventListener('hashchange', onLocationChange)
    window.addEventListener('popstate', onLocationChange)
    return () => {
      window.removeEventListener('hashchange', onLocationChange)
      window.removeEventListener('popstate', onLocationChange)
    }
  }, [])

  // Close user dropdown popover when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.user-nav-dropdown-wrapper')) {
        setUserDropdownOpen(false)
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('click', handleDocumentClick)
    }
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [userDropdownOpen])

  // Automatically sync local session with Neon DB if user is already logged in
  useEffect(() => {
    if (currentUser?.id) {
      syncSessionWithNeon(currentUser).then(res => {
        if (res?.created) {
          showToast(`✨ Synced ${currentUser.name} to Neon database!`)
        }
      }).catch(e => console.warn('Sync session check:', e))
    }
  }, [currentUser?.id])

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3400)
  }

  const navigateToView = (view) => {
    setCurrentView(view)
    setUserDropdownOpen(false)
    setMobileMenu(false)
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/t/')) {
        window.history.pushState(null, '', '/')
      }
      if (view === 'login') {
        window.location.hash = '/login'
      } else if (view === 'dashboard') {
        window.location.hash = '/dashboard'
      } else if (view === 'about') {
        window.location.hash = '/about'
      } else if (view === 'privacy') {
        window.location.hash = '/privacy'
      } else if (view === 'contact') {
        window.location.hash = '/contact'
      } else {
        window.location.hash = '/home'
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleLoginSuccess = (user, welcomeMsg) => {
    setCurrentUser(user)

    // Check if there is a pending group trip invite saved before login
    try {
      const pendingInvite = sessionStorage.getItem('tripmind_pending_invite')
      if (pendingInvite) {
        sessionStorage.removeItem('tripmind_pending_invite')
        setInviteToken(pendingInvite)
        setCurrentView('join')
        if (typeof window !== 'undefined') {
          window.location.hash = `/join/${pendingInvite}`
        }
        showToast(welcomeMsg || `Welcome back, ${user.name}! Resuming your group trip invite... 🌿`)
        return
      }
    } catch (e) {}

    // Seamlessly migrate any trips generated as a guest to the logged-in user account
    try {
      const guestTrips = getUserTrips('guest')
      if (Array.isArray(guestTrips) && guestTrips.length > 0) {
        guestTrips.forEach(t => saveUserTrip(user.id, t))
        localStorage.removeItem('tripmind_trips_guest')
        showToast(welcomeMsg || `✨ Welcome ${user.name}! Your planned trip was saved to your account.`)
        navigateToView('dashboard')
        return
      }
    } catch (e) {}

    showToast(welcomeMsg || `Welcome back, ${user.name}! 🌿`)
    navigateToView('dashboard')
  }

  const handleLogout = () => {
    logOutUser()
    setCurrentUser(null)
    setUserDropdownOpen(false)
    showToast('You have signed out.')
    navigateToView('landing')
  }

  // Picking a destination preset routes directly into the Trip Planner!
  const handleDestinationPick = (card) => {
    try {
      sessionStorage.setItem('tripmind_preset_destination', JSON.stringify({
        name: card.name,
        days: card.days,
        budget: card.budget,
        interests: card.interests
      }))
    } catch (e) {}

    showToast(`Selected ${card.name} — opening trip planner...`)
    navigateToView('dashboard')
  }

  // VIEW 0: Public Shared Itinerary (/t/:shareId)
  if (currentView === 'shared' && sharedTripId) {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Suspense fallback={<ViewLoadingFallback />}>
          <SharedTripView
            shareId={sharedTripId}
            onNavigateHome={() => navigateToView('landing')}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 0b: Group Trip Invite Link (/join/:inviteToken)
  if (currentView === 'join' && inviteToken) {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {toast && (
          <div className="toast-banner" role="status" aria-live="polite">
            <Sparkles size={16} aria-hidden="true" />
            <span>{toast}</span>
          </div>
        )}
        <Suspense fallback={<ViewLoadingFallback />}>
          <JoinTripView
            inviteToken={inviteToken}
            currentUser={currentUser}
            onJoinSuccess={(joinedTripId) => {
              showToast('Successfully joined the group trip party! 🎒')
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/#/dashboard')
              }
              navigateToView('dashboard')
            }}
            onNavigateLogin={() => navigateToView('login')}
            onBackToApp={() => navigateToView('landing')}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 1: Dedicated Login / Register Page
  if (currentView === 'login') {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {toast && (
          <div className="toast-banner" role="status" aria-live="polite">
            <Sparkles size={16} aria-hidden="true" />
            <span>{toast}</span>
          </div>
        )}
        <Suspense fallback={<ViewLoadingFallback />}>
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => navigateToView('landing')}
            onNavigate={navigateToView}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 2: Trip Planner & Dashboard Workspace (open to first-time visitors & members)
  if (currentView === 'dashboard') {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {toast && (
          <div className="toast-banner" role="status" aria-live="polite">
            <Sparkles size={16} aria-hidden="true" />
            <span>{toast}</span>
          </div>
        )}
        <Suspense fallback={<ViewLoadingFallback />}>
          <DashboardView
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigateLogin={() => navigateToView('login')}
            onNavigateExplore={() => navigateToView('landing')}
            showToast={showToast}
            onUserUpdated={(updated) => setCurrentUser(updated)}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 3: About Page
  if (currentView === 'about') {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Suspense fallback={<ViewLoadingFallback />}>
          <AboutPage
            onBack={() => navigateToView('landing')}
            onStartPlanning={() => navigateToView('dashboard')}
            onNavigate={navigateToView}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 4: Privacy Policy Page
  if (currentView === 'privacy') {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Suspense fallback={<ViewLoadingFallback />}>
          <PrivacyPage
            onBack={() => navigateToView('landing')}
            onNavigate={navigateToView}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 5: Contact Page
  if (currentView === 'contact') {
    return (
      <div className="app-shell">
        <Analytics />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Suspense fallback={<ViewLoadingFallback />}>
          <ContactPage
            onBack={() => navigateToView('landing')}
            onNavigate={navigateToView}
          />
        </Suspense>
      </div>
    )
  }

  // VIEW 6: Clean Intro / Landing Page with Sign In & Sign Up Options
  return (
    <div className="app-shell">
      <Analytics />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Toast Notification */}
      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          <Sparkles size={16} aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {/* Navigation */}
      <header className="nav-wrap">
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault()
            navigateToView('landing')
          }}
          aria-label="TripMind AI home"
        >
          <span className="brand-mark">
            <img src="/tripmind-icon.svg?v=3" alt="TripMind AI logo" width="32" height="32" />
          </span>
          <span>
            tripmind<span className="brand-ai">.ai</span>
          </span>
        </a>

        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'}>
          <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How It Works</a>
          <a href="#example-itinerary" onClick={() => setMobileMenu(false)}>Sample Itinerary</a>
          <a href="#inspiration" onClick={() => setMobileMenu(false)}>Destinations</a>
          <a
            href="#/about"
            onClick={(e) => {
              e.preventDefault()
              setMobileMenu(false)
              navigateToView('about')
            }}
          >
            About
          </a>
          <a
            href="#/contact"
            onClick={(e) => {
              e.preventDefault()
              setMobileMenu(false)
              navigateToView('contact')
            }}
          >
            Contact
          </a>
          <div className="mobile-drawer-footer">
            <button
              type="button"
              className="mobile-drawer-btn"
              onClick={toggleTheme}
              style={{ background: 'transparent', color: 'var(--ink)', fontSize: '13px' }}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              className="mobile-drawer-btn"
              onClick={() => {
                navigateToView('privacy')
                setMobileMenu(false)
              }}
              style={{ background: 'transparent', color: 'var(--muted)', fontSize: '13px' }}
            >
              <span>Privacy Policy</span>
            </button>
            {currentUser ? (
              <button
                type="button"
                className="mobile-drawer-btn"
                onClick={() => {
                  navigateToView('dashboard')
                  setMobileMenu(false)
                }}
              >
                <LayoutDashboard size={15} />
                <span>My Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                className="mobile-drawer-btn"
                onClick={() => {
                  navigateToView('login')
                  setMobileMenu(false)
                }}
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </nav>

        <div className="nav-right">
          {currentUser ? (
            <div className="user-nav-dropdown-wrapper">
              <button
                type="button"
                className={`user-nav-pill ${userDropdownOpen ? 'active' : ''}`}
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-expanded={userDropdownOpen}
                aria-label="User account menu"
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={`${currentUser.name}'s profile avatar`}
                    className="nav-avatar-img"
                    width="28"
                    height="28"
                  />
                ) : (
                  <span className="nav-avatar-initials">{currentUser.initials || 'U'}</span>
                )}
                <span className="nav-user-name">{currentUser.name}</span>
                <ChevronDown size={14} color="#788273" />
              </button>

              {userDropdownOpen && (
                <div className="user-dropdown-popover">
                  <div className="user-dropdown-header">
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.email}</small>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => navigateToView('dashboard')}
                  >
                    <LayoutDashboard size={15} />
                    <span>My Dashboard & Planner</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item-btn logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="nav-signin-link"
              onClick={() => navigateToView('login')}
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            className="nav-theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            className="nav-primary-cta"
            onClick={() => navigateToView('dashboard')}
          >
            <span>{currentUser ? 'My Dashboard' : 'Plan a Trip'}</span>
            <ArrowRight size={15} />
          </button>

          <button
            className="mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="main-content">
        {/* Hero Section */}
        <section className="hero section-container" id="home">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> YOUR PERSONAL TRAVEL CONCIERGE
            </div>
            <h1>
              Your trip,<br />
              <span>thoughtfully planned.</span>
            </h1>
            <p className="hero-description">
              Tell us where you're going and get a day-by-day itinerary, budget, and packing list in seconds.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="button button-dark"
                onClick={() => navigateToView('dashboard')}
              >
                {currentUser ? (
                  <>
                    <LayoutDashboard size={17} />
                    <span>Open my dashboard</span>
                  </>
                ) : (
                  <span>Plan my trip</span>
                )}
                <ArrowRight size={17} />
              </button>
            </div>

            <div className="hero-proof">
              <div className="avatar-stack">
                <span>J</span>
                <span>M</span>
                <span>A</span>
                <span>+</span>
              </div>
              <div>
                <strong>Made for curious travellers</strong>
                <small>Thoughtful plans, calibrated to your kind of pace</small>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <img
              className="hero-image"
              src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1000&q=80"
              alt="Colourful coastal village on the Italian Riviera overlooking the turquoise sea"
              fetchpriority="high"
              decoding="async"
              width="540"
              height="490"
            />
            <div className="image-tint"></div>
            <div className="floating-note note-top">
              <span className="note-icon">
                <Sparkles size={16} />
              </span>
              <span>
                <strong>Your trip, your rhythm</strong>
                <small>Intelligently tailored to your style</small>
              </span>
            </div>
            <div className="floating-note note-bottom">
              <div className="mini-map">
                <MapPin size={20} />
              </div>
              <span>
                <strong>Find your somewhere</strong>
                <small>Hidden gems, not just crowded hotspots</small>
              </span>
              <ArrowUpRight size={17} />
            </div>
            <div className="hero-stamp">
              <span>GO</span>
              <span>SLOW</span>
              <span>•</span>
              <span>FEEL</span>
              <span>MORE</span>
            </div>
          </div>

          <div className="hero-bottom">
            <span>POWERED BY ADVANCED GEMINI INTELLIGENCE</span>
            <span className="bottom-line"></span>
            <span>01 — 06</span>
          </div>
        </section>

        {/* Sample Itinerary Section */}
        <section className="sample-itinerary section-container" id="example-itinerary">
          <div className="sample-label">
            <span>Example itinerary</span>
          </div>
          <div className="sample-header">
            <h2>See what TripMind creates</h2>
            <p>A 3-day trip to Jaipur — generated in seconds.</p>
          </div>

          <div className="sample-days-grid">
            <div className="sample-day-card">
              <div className="sample-day-header">
                <span className="sample-day-no">Day 1</span>
                <span>Arrival &amp; Old City</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Morning</span>
                <span>Amber Fort at sunrise — explore the hilltop fortress before crowds ($8)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Afternoon</span>
                <span>City Palace &amp; Hawa Mahal — ornate pink facades and royal museum ($5)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Evening</span>
                <span>Chokhi Dhani village dinner — folk dance, thali feast under the stars ($15)</span>
              </div>
            </div>

            <div className="sample-day-card">
              <div className="sample-day-header">
                <span className="sample-day-no">Day 2</span>
                <span>Bazaars &amp; Blue Pottery</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Morning</span>
                <span>Johari Bazaar — gemstones, hand-block printed textiles, chai stops (Free)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Afternoon</span>
                <span>Nahargarh Fort sunset hike — panoramic city views from the ramparts ($3)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Evening</span>
                <span>Rooftop restaurant at Achrol House — candlelit Rajasthani cuisine ($22)</span>
              </div>
            </div>

            <div className="sample-day-card">
              <div className="sample-day-header">
                <span className="sample-day-no">Day 3</span>
                <span>Stepwells &amp; Departure</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Morning</span>
                <span>Panna Meena Ka Kund — geometric stepwell, almost entirely tourist-free (Free)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Afternoon</span>
                <span>Anokhi Museum of Hand Printing — block-printing workshop ($4)</span>
              </div>
              <div className="sample-slot">
                <span className="slot-time">Evening</span>
                <span>Departure — auto-rickshaw to airport or train station ($3)</span>
              </div>
            </div>
          </div>

          <div className="sample-extras">
            <div className="sample-budget">
              <h4>Estimated budget <span>(2 people, mid-range)</span></h4>
              <div className="sample-budget-row"><span>Accommodation</span><span>~$90</span></div>
              <div className="sample-budget-row"><span>Dining</span><span>~$60</span></div>
              <div className="sample-budget-row"><span>Activities</span><span>~$30</span></div>
              <div className="sample-budget-row"><span>Local transit</span><span>~$20</span></div>
              <div className="sample-budget-row total"><span>Total (3 days)</span><span>~$200</span></div>
            </div>

            <div className="sample-packing">
              <h4>Packing essentials</h4>
              <ul>
                <li>Light cotton clothes (modest for temple visits)</li>
                <li>Comfortable walking sandals</li>
                <li>Sun hat &amp; SPF 50+</li>
                <li>Reusable water bottle</li>
                <li>Small daypack</li>
                <li>Offline maps downloaded</li>
              </ul>
            </div>
          </div>

          <div className="trip-sheet-disclaimer" style={{ maxWidth: '640px', margin: '24px auto 0' }} role="note">
            <AlertCircle size={15} aria-hidden="true" />
            <span>Prices, timings, and availability are AI-generated estimates. Please verify before booking.</span>
          </div>

          <div className="sample-cta">
            <button
              type="button"
              className="button button-dark"
              onClick={() => navigateToView('dashboard')}
            >
              <span>Create yours</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </section>

        {/* Destination Inspiration */}
        <section className="inspiration section-container" id="inspiration">
          <div className="section-heading">
            <div>
              <div className="eyebrow">CURATED INSPIRATION</div>
              <h2>Somewhere calling your name?</h2>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => navigateToView('dashboard')}
              style={{ background: 'none', border: 0, cursor: 'pointer' }}
            >
              <span>{currentUser ? 'Plan custom trip in Dashboard' : 'Plan custom trip in Trip Planner'}</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="destination-grid">
            {destinationCards.map(dest => (
              <button
                key={dest.name}
                type="button"
                className="destination-card"
                onClick={() => handleDestinationPick(dest)}
                aria-label={`Plan trip to ${dest.name}`}
              >
                <img src={dest.img} alt={`${dest.name} — ${dest.detail}`} loading="lazy" decoding="async" />
                <span className="destination-overlay"></span>
                <span className="destination-info">
                  <span>{dest.tag}</span>
                  <strong>{dest.subtitle}</strong>
                  <small>
                    {dest.detail} <ArrowUpRight size={14} />
                  </small>
                </span>
                <span className="destination-number">{dest.number}</span>
              </button>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="how-section" id="how-it-works">
          <div className="section-container how-inner">
            <div className="how-title">
              <div className="eyebrow">THOUGHTFUL DISCOVERY</div>
              <h2>
                Your kind of trip,<br />
                <em>in three little steps.</em>
              </h2>
              <p>
                Skip the 27 open tabs and conflicting reviews. Tell us what moves you,
                and let our AI travel concierge shape a seamless day-by-day journey inside your personal dashboard.
              </p>
            </div>
            <div className="steps">
              <div className="step">
                <span className="step-no">01</span>
                <div className="step-icon">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3>Tell us what moves you</h3>
                  <p>Pick your destination, travel dates, pacing, budget level, and personal style.</p>
                </div>
              </div>
              <div className="step">
                <span className="step-no">02</span>
                <div className="step-icon">
                  <WandSparkles size={20} />
                </div>
                <div>
                  <h3>Gemini curates your days</h3>
                  <p>Get authentic dining, scenic walks, and heritage sights organized in natural order.</p>
                </div>
              </div>
              <div className="step">
                <span className="step-no">03</span>
                <div className="step-icon">
                  <Heart size={20} />
                </div>
                <div>
                  <h3>Track in your Dashboard</h3>
                  <p>Keep your itineraries organized, check off visited places, monitor costs, and export to PDF.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Unified Editorial Call to Action */}
        <section className="closing section-container" id="why-tripmind">
          <div className="closing-content">
            <div className="closing-eyebrow">
              <Sparkles size={14} /> YOUR PERSONAL TRAVEL WORKSPACE
            </div>
            <h2>Ready to plan your next journey?</h2>
            <p>
              Experience travel planning without the stress. Receive intelligent day-by-day itineraries,
              curated dining, transparent budget estimates, and offline-ready schedules.
            </p>
            <div className="closing-perks-grid">
              <div className="closing-perk">
                <CheckCircle2 size={16} className="perk-icon" />
                <span>Tailored Gemini AI Itineraries</span>
              </div>
              <div className="closing-perk">
                <CheckCircle2 size={16} className="perk-icon" />
                <span>Personal Saved Trips Vault</span>
              </div>
              <div className="closing-perk">
                <CheckCircle2 size={16} className="perk-icon" />
                <span>Real-Time Budget Breakdown</span>
              </div>
              <div className="closing-perk">
                <CheckCircle2 size={16} className="perk-icon" />
                <span>PDF Export & Print-Ready Plans</span>
              </div>
            </div>
          </div>

          <div className="closing-action-box">
            <button
              type="button"
              className="button button-light-prominent"
              onClick={() => navigateToView(currentUser ? 'dashboard' : 'login')}
            >
              <span>{currentUser ? 'Open Travel Dashboard' : 'Start Planning for Free'}</span>
              <ArrowRight size={16} />
            </button>
            {!currentUser && (
              <button
                type="button"
                className="closing-sub-link"
                onClick={() => navigateToView('login')}
              >
                <span>Already have an account? <strong>Sign In</strong></span>
              </button>
            )}
          </div>
          <span className="closing-mark">TRIPMIND / 2026</span>
        </section>

      </main>

      {/* Footer reachable across pages */}
      <AppFooter onNavigate={navigateToView} currentView="landing" />
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('TripMind UI Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--paper, #f7f6f2)',
          color: 'var(--ink, #20251f)',
          padding: '24px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{
            maxWidth: '480px',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--line, #e4e4dc)',
            borderRadius: '16px',
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: '22px', marginBottom: '12px' }}>
              Something unexpected happened
            </h2>
            <p style={{ color: 'var(--muted, #596055)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              We ran into a small hiccup while rendering the workspace. Click below to reload.
            </p>
            <button
              type="button"
              className="button button-dark"
              onClick={() => {
                window.location.hash = ''
                window.location.reload()
              }}
              style={{ margin: '0 auto' }}
            >
              Reload TripMind
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

if (typeof document !== 'undefined') {
  const rootEl = document.getElementById('root')
  if (rootEl) {
    createRoot(rootEl).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
  }
}
