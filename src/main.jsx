import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Compass,
  FolderHeart,
  Heart,
  LogIn,
  LogOut,
  LayoutDashboard,
  MapPin,
  Menu,
  Sparkles,
  WandSparkles,
  X
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import DashboardView from './components/DashboardView'
import {
  getActiveSession,
  logOutUser,
  getUserTrips,
  syncSessionWithNeon
} from './auth'
import './styles.css'

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

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getActiveSession())
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash
    if (hash === '#/login' || hash === '#login') return 'login'
    if (hash === '#/dashboard' || hash === '#dashboard') return 'dashboard'
    return 'landing'
  })
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState(null)

  // Listen to hash changes for browser navigation
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash
      if (hash === '#/login' || hash === '#login') {
        setCurrentView('login')
      } else if (hash === '#/dashboard' || hash === '#dashboard') {
        const session = getActiveSession()
        if (session) {
          setCurrentUser(session)
          setCurrentView('dashboard')
        } else {
          setCurrentView('login')
        }
      } else if (hash === '#/home' || hash === '#home' || hash === '') {
        setCurrentView('landing')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
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
    if (view === 'login') {
      window.location.hash = '/login'
    } else if (view === 'dashboard') {
      window.location.hash = '/dashboard'
    } else {
      window.location.hash = '/home'
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoginSuccess = (user, welcomeMsg) => {
    setCurrentUser(user)
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

  // Picking a destination preset routes directly into the Personal Dashboard planner!
  const handleDestinationPick = (card) => {
    try {
      sessionStorage.setItem('tripmind_preset_destination', JSON.stringify({
        name: card.name,
        days: card.days,
        budget: card.budget,
        interests: card.interests
      }))
    } catch (e) {}

    if (currentUser) {
      showToast(`Selected ${card.name} — opening your dashboard...`)
      navigateToView('dashboard')
    } else {
      showToast(`Selected ${card.name} — sign in to start planning!`)
      navigateToView('login')
    }
  }

  // VIEW 1: Dedicated Login / Register Page
  if (currentView === 'login') {
    return (
      <div className="app-shell">
        <Analytics />
        {toast && (
          <div className="toast-banner" role="status" aria-live="polite">
            <Sparkles size={16} />
            <span>{toast}</span>
          </div>
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onCancel={() => navigateToView('landing')}
        />
      </div>
    )
  }

  // VIEW 2: Individual User Dashboard & Planner Workspace
  if (currentView === 'dashboard') {
    if (!currentUser) {
      return (
        <div className="app-shell">
          <Analytics />
          {toast && (
            <div className="toast-banner" role="status" aria-live="polite">
              <Sparkles size={16} />
              <span>{toast}</span>
            </div>
          )}
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => navigateToView('landing')}
          />
        </div>
      )
    }

    return (
      <div className="app-shell">
        <Analytics />
        {toast && (
          <div className="toast-banner" role="status" aria-live="polite">
            <Sparkles size={16} />
            <span>{toast}</span>
          </div>
        )}
        <DashboardView
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigateExplore={() => navigateToView('landing')}
          showToast={showToast}
        />
      </div>
    )
  }

  // VIEW 3: Clean Intro / Landing Page with Sign In & Sign Up Options
  return (
    <div className="app-shell">
      <Analytics />
      {/* Toast Notification */}
      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          <Sparkles size={16} />
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
            <Compass size={21} strokeWidth={2.2} />
          </span>
          <span>
            tripmind<span className="brand-ai">.ai</span>
          </span>
        </a>

        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'}>
          <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How It Works</a>
          <a href="#inspiration" onClick={() => setMobileMenu(false)}>Destinations</a>
          <a href="#why-tripmind" onClick={() => setMobileMenu(false)}>Why TripMind</a>
          <div className="mobile-drawer-footer">
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
                    alt={currentUser.name}
                    className="nav-avatar-img"
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
            className="nav-primary-cta"
            onClick={() => navigateToView(currentUser ? 'dashboard' : 'login')}
          >
            <span>{currentUser ? 'My Dashboard' : 'Start Planning'}</span>
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

      <main>
        {/* Hero Section */}
        <section className="hero section-container" id="home">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> YOUR PERSONAL TRAVEL CONCIERGE
            </div>
            <h1>
              Less planning.<br />
              <span>More feeling.</span>
            </h1>
            <p className="hero-description">
              The best trips aren't packed spreadsheets. They're quiet morning cafés,
              unexpected stone alleys, and moments that stay with you long after you return.
            </p>
            <div className="hero-actions">
              {currentUser ? (
                <>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => navigateToView('dashboard')}
                  >
                    <LayoutDashboard size={17} />
                    <span>Open My Dashboard</span>
                    <ArrowRight size={17} />
                  </button>
                  <a
                    href="#inspiration"
                    className="button button-secondary-outline"
                  >
                    <span>Explore Destinations</span>
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => navigateToView('login')}
                  >
                    <span>Start Planning</span>
                    <ArrowRight size={17} />
                  </button>
                  <a
                    href="#inspiration"
                    className="button button-secondary-outline"
                  >
                    <span>Explore Destinations</span>
                  </a>
                </>
              )}
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
              src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1800&q=85"
              alt="Colourful coastal village on the Italian Riviera"
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
              onClick={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              style={{ background: 'none', border: 0, cursor: 'pointer' }}
            >
              <span>{currentUser ? 'Plan custom trip in Dashboard' : 'Sign in to customize any destination'}</span>
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
                <img src={dest.img} alt={dest.subtitle} loading="lazy" />
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
                  <Compass size={20} />
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

      {/* Footer */}
      <footer className="footer section-container">
        <a className="brand" href="#home">
          <span className="brand-mark">
            <Compass size={19} />
          </span>
          <span>
            tripmind<span className="brand-ai">.ai</span>
          </span>
        </a>
        <span>Thoughtful itineraries powered by Gemini AI intelligence.</span>
        <span>DESIGNED TO WANDER © 2026</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
