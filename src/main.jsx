import React, { useMemo, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Download,
  Filter,
  FolderHeart,
  Footprints,
  Heart,
  Info,
  Leaf,
  Lightbulb,
  MapPin,
  Menu,
  Minus,
  Plus,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  Wallet,
  WandSparkles,
  X,
  Camera,
  Landmark,
  ShieldCheck,
  AlertCircle,
  LogIn,
  LogOut,
  User,
  Sliders,
  LayoutDashboard
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import DashboardView from './components/DashboardView'
import {
  getActiveSession,
  setActiveSession,
  logOutUser,
  getUserTrips,
  saveUserTrip,
  deleteUserTrip
} from './auth'
import './styles.css'

const allInterests = [
  'Food & cafés',
  'Nature & outdoors',
  'Culture & heritage',
  'Art & design',
  'Hidden gems',
  'Slow travel',
  'Adventure',
  'Nightlife & bars'
]

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

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('food') || c.includes('café') || c.includes('cafe')) return Utensils
  if (c.includes('nature') || c.includes('park') || c.includes('garden')) return Leaf
  if (c.includes('culture') || c.includes('historic') || c.includes('temple')) return Landmark
  if (c.includes('walk') || c.includes('stroll') || c.includes('wander')) return Footprints
  if (c.includes('art') || c.includes('design') || c.includes('museum')) return Camera
  return Compass
}

function formatTripDate(startDateStr, dayOffset) {
  if (!startDateStr) return null
  const parts = startDateStr.split('-')
  if (parts.length !== 3) return null
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + dayOffset)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getTodayStr() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function generateLocalFallback(form) {
  const tripDays = Number(form.days) || 3
  const dest = form.destination.trim()
  const daysList = []

  const themes = [
    'Get your bearings & local flavors',
    'Old quarters, heritage & secret alleys',
    'Scenic viewpoints & relaxed wandering',
    'Artisan spots & culinary treasures',
    'Nature escapes & coastal/countryside paths',
    'Unrushed café moments & neighborhood life',
    'Grand highlights & farewell sunset'
  ]

  for (let i = 1; i <= tripDays; i++) {
    daysList.push({
      day: i,
      title: themes[(i - 1) % themes.length],
      activities: [
        {
          time: '09:00',
          title: i === 1 ? 'Slow morning coffee & local breakfast' : 'Neighborhood bakery & morning stroll',
          description: `Find an authentic artisan café in ${dest} and ease into the morning with freshly prepared regional fare.`,
          category: 'food',
          cost: 14,
          location: 'Historic Center'
        },
        {
          time: '11:30',
          title: 'Exploring iconic heritage landmarks',
          description: `Immerse yourself in the architecture, history, and cobblestone charm of ${dest}.`,
          category: 'culture',
          cost: 20,
          location: 'Old Quarter'
        },
        {
          time: '14:00',
          title: 'Market stroll & lunch at a local bistro',
          description: 'Sample authentic regional specialties at a busy, resident-recommended restaurant.',
          category: 'food',
          cost: 24,
          location: 'Market District'
        },
        {
          time: '16:30',
          title: 'Afternoon scenic overlook & golden hour',
          description: 'A quiet viewpoint or park to soak in the atmosphere as daylight turns into dusk.',
          category: 'walk',
          cost: 0,
          location: 'Panorama Point'
        }
      ]
    })
  }

  const baseMultiplier = form.budget === 'Budget-friendly' ? 45 : form.budget === 'Treat yourself' ? 220 : 100
  const total = baseMultiplier * tripDays * form.travelers

  return {
    destination: dest,
    summary: `A thoughtful ${tripDays}-day itinerary for ${form.travelers} ${form.travelers === 1 ? 'traveler' : 'travelers'}, blending local culture, picturesque walks, and unhurried dining.`,
    travelTip: `Carry a refillable water bottle and use local transit passes for effortless navigation around ${dest}.`,
    bestTimeToVisit: 'Shoulder seasons (Spring or Autumn) for pleasant weather and lighter foot traffic.',
    budgetBreakdown: {
      totalEstimatedUsd: total,
      dailyPerPersonUsd: baseMultiplier,
      categories: {
        accommodation: Math.round(total * 0.42),
        dining: Math.round(total * 0.32),
        activities: Math.round(total * 0.16),
        transit: Math.round(total * 0.10)
      }
    },
    days: daysList,
    generatedBy: 'smart-offline-concierge'
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getActiveSession())
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash
    if (hash === '#/login' || hash === '#login') return 'login'
    if (hash === '#/dashboard' || hash === '#dashboard') return 'dashboard'
    return 'landing'
  })
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const [form, setForm] = useState({
    destination: 'Kyoto, Japan',
    startDate: '',
    days: '4',
    budget: 'Mid-range',
    travelers: 2,
    interests: ['Food & cafés', 'Culture & heritage', 'Slow travel']
  })

  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [savedTrips, setSavedTrips] = useState([])
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')
  const [checkedActivities, setCheckedActivities] = useState({})
  const [aiStatus, setAiStatus] = useState(null)

  // Sync saved trips based on logged-in user or local guest storage
  useEffect(() => {
    if (currentUser) {
      const userSaved = getUserTrips(currentUser.id)
      setSavedTrips(userSaved)
    } else {
      try {
        const stored = localStorage.getItem('tripmind_saved_trips')
        if (stored) {
          setSavedTrips(JSON.parse(stored))
        } else {
          setSavedTrips([])
        }
      } catch (e) {
        console.warn('Could not load guest trips:', e)
      }
    }
  }, [currentUser])

  // Handle URL hash changes for direct routing & browser back/forward
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

  // Ping API health on mount
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setAiStatus(data)
      })
      .catch(() => {
        fetch('http://localhost:3001/api/health')
          .then(res => res.json())
          .then(data => setAiStatus(data))
          .catch(() => setAiStatus({ ok: false }))
      })
  }, [])

  // Dynamic loading messages
  useEffect(() => {
    let timer
    if (loading) {
      const steps = [
        'Connecting to Gemini AI concierges...',
        'Discovering neighborhood favorites...',
        'Balancing pacing & morning coffee spots...',
        'Finalizing your personalized itinerary...'
      ]
      let current = 0
      timer = setInterval(() => {
        current = (current + 1) % steps.length
        setLoadingStep(current)
      }, 1600)
    }
    return () => clearInterval(timer)
  }, [loading])

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

  const handleLoadTripToMainPlanner = (trip) => {
    setItinerary(trip)
    if (trip.formSnapshot) {
      setForm(trip.formSnapshot)
    }
    setCurrentView('landing')
    window.location.hash = '/home'
    showToast(`Loaded ${trip.destination} into planner!`)
    setTimeout(() => {
      document.getElementById('itinerary')?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleInterest = (item) => {
    update(
      'interests',
      form.interests.includes(item)
        ? form.interests.filter(x => x !== item)
        : [...form.interests, item]
    )
  }

  const isCurrentTripSaved = useMemo(() => {
    if (!itinerary) return false
    return savedTrips.some(
      t => t.destination.toLowerCase() === itinerary.destination.toLowerCase() &&
           t.days?.length === itinerary.days?.length
    )
  }, [itinerary, savedTrips])

  const toggleSaveTrip = () => {
    if (!itinerary) return
    let updated
    if (isCurrentTripSaved) {
      if (currentUser) {
        const existing = getUserTrips(currentUser.id)
        const match = existing.find(
          t => t.destination.toLowerCase() === itinerary.destination.toLowerCase() &&
               t.days?.length === itinerary.days?.length
        )
        if (match) {
          updated = deleteUserTrip(currentUser.id, match.id)
        } else {
          updated = existing
        }
      } else {
        updated = savedTrips.filter(
          t => !(t.destination.toLowerCase() === itinerary.destination.toLowerCase() &&
                 t.days?.length === itinerary.days?.length)
        )
        try {
          localStorage.setItem('tripmind_saved_trips', JSON.stringify(updated))
        } catch (e) {}
      }
      showToast('Trip removed from saved plans.')
    } else {
      const tripToSave = {
        ...itinerary,
        id: `trip_${Date.now()}`,
        savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        formSnapshot: { ...form },
        status: 'Upcoming'
      }
      if (currentUser) {
        updated = saveUserTrip(currentUser.id, tripToSave)
        showToast(`✨ Plan saved to ${currentUser.name}'s Dashboard!`)
      } else {
        updated = [tripToSave, ...savedTrips]
        try {
          localStorage.setItem('tripmind_saved_trips', JSON.stringify(updated))
        } catch (e) {
          console.warn('Storage save error:', e)
        }
        showToast('✨ Trip saved to your device! Sign in to sync across devices.')
      }
    }
    setSavedTrips(updated)
  }

  const deleteSavedTrip = (id, e) => {
    e?.stopPropagation()
    let updated
    if (currentUser) {
      updated = deleteUserTrip(currentUser.id, id)
    } else {
      updated = savedTrips.filter(t => t.id !== id)
      try {
        localStorage.setItem('tripmind_saved_trips', JSON.stringify(updated))
      } catch (err) {}
    }
    setSavedTrips(updated)
    showToast('Plan deleted.')
  }

  const loadSavedTrip = (trip) => {
    setItinerary(trip)
    if (trip.formSnapshot) {
      setForm(trip.formSnapshot)
    }
    setShowSavedModal(false)
    showToast(`Loaded ${trip.destination} itinerary!`)
    setTimeout(() => {
      document.getElementById('itinerary')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const toggleActivityChecked = (actKey) => {
    setCheckedActivities(prev => ({
      ...prev,
      [actKey]: !prev[actKey]
    }))
  }

  async function generateTrip(e) {
    e?.preventDefault()
    setError('')
    if (!form.destination.trim()) {
      setError('Please enter a destination to start planning.')
      return
    }

    setLoading(true)
    setItinerary(null)
    setActiveCategoryFilter('all')

    let data = null
    let errorMsg = ''

    // Try primary proxy endpoint
    try {
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (response.ok) {
        data = await response.json()
      } else {
        const errJson = await response.json().catch(() => ({}))
        errorMsg = errJson.error || `Server responded with ${response.status}`
      }
    } catch (err) {
      // Try direct port 3001 if proxy hit an error
      try {
        const directResp = await fetch('http://localhost:3001/api/itinerary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
        if (directResp.ok) {
          data = await directResp.json()
        }
      } catch (directErr) {
        console.warn('Direct backend connection failed:', directErr)
      }
    }

    // If server succeeded
    if (data && Array.isArray(data.days)) {
      setItinerary(data)
      showToast('✨ Your personalized itinerary is ready!')
    } else {
      // Fallback seamlessly to local intelligent generation
      console.log('Using local concierge plan fallback due to:', errorMsg)
      const fallback = generateLocalFallback(form)
      setItinerary(fallback)
      showToast('✨ Curated itinerary generated!')
    }

    setLoading(false)
    setTimeout(() => {
      document.getElementById('itinerary')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 200)
  }

  const handleDestinationPick = (card) => {
    setForm(prev => ({
      ...prev,
      destination: card.name,
      days: card.days,
      budget: card.budget,
      interests: card.interests
    }))
    showToast(`Loaded ${card.name} presets`)
    document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyMarkdown = () => {
    if (!itinerary) return
    let text = `# ${itinerary.destination} Itinerary (${itinerary.days?.length || form.days} Days)\n`
    text += `*Budget: ${form.budget} · Travelers: ${form.travelers}*\n\n`
    if (itinerary.summary) text += `${itinerary.summary}\n\n`
    if (itinerary.travelTip) text += `> Tip: ${itinerary.travelTip}\n\n`

    itinerary.days?.forEach((d, idx) => {
      const dateStr = formatTripDate(form.startDate, idx)
      text += `## Day ${d.day || idx + 1}: ${d.title}${dateStr ? ` (${dateStr})` : ''}\n`
      d.activities?.forEach(act => {
        text += `- **${act.time}** - ${act.title} (${act.category || 'spot'}) [Est. $${act.cost || 0}]\n`
        text += `  ${act.description}\n`
      })
      text += '\n'
    })

    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Itinerary copied to clipboard!')
    }).catch(() => {
      showToast('Could not copy to clipboard.')
    })
  }

  // Filter activities
  const filteredDays = useMemo(() => {
    if (!itinerary || !Array.isArray(itinerary.days)) return []
    if (activeCategoryFilter === 'all') return itinerary.days

    return itinerary.days.map(d => ({
      ...d,
      activities: (d.activities || []).filter(act => {
        const cat = (act.category || '').toLowerCase()
        if (activeCategoryFilter === 'food') return cat.includes('food') || cat.includes('café')
        if (activeCategoryFilter === 'culture') return cat.includes('culture') || cat.includes('art')
        if (activeCategoryFilter === 'nature') return cat.includes('nature') || cat.includes('walk')
        return true
      })
    }))
  }, [itinerary, activeCategoryFilter])

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
          onLoadTripToMainPlanner={handleLoadTripToMainPlanner}
          showToast={showToast}
        />
      </div>
    )
  }

  // VIEW 3: Main Public Landing & Explore Page
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
          <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a>
          <a href="#inspiration" onClick={() => setMobileMenu(false)}>Destinations</a>
          <a href="#planner" onClick={() => setMobileMenu(false)}>Trip planner</a>
          {currentUser ? (
            <button
              type="button"
              className="nav-saved-btn"
              style={{ background: '#244a3a', color: '#ffffff', borderColor: '#244a3a' }}
              onClick={() => {
                navigateToView('dashboard')
                setMobileMenu(false)
              }}
            >
              <LayoutDashboard size={14} />
              <span>My Dashboard</span>
            </button>
          ) : (
            <button
              type="button"
              className="nav-saved-btn"
              style={{ background: 'transparent', borderColor: 'rgba(36, 74, 58, 0.4)', color: 'var(--green)' }}
              onClick={() => {
                navigateToView('login')
                setMobileMenu(false)
              }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}
          {savedTrips.length > 0 && (
            <button
              className="nav-saved-btn"
              onClick={() => {
                setShowSavedModal(true)
                setMobileMenu(false)
              }}
            >
              <Heart size={14} fill="#e9a46d" color="#e9a46d" />
              <span>Saved Plans ({savedTrips.length})</span>
            </button>
          )}
        </nav>

        <div className="nav-right">
          {savedTrips.length > 0 && (
            <button
              className="saved-badge-pill"
              onClick={() => setShowSavedModal(true)}
              title="View your saved trips"
              aria-label="View saved trips"
            >
              <FolderHeart size={16} />
              <span>{savedTrips.length}</span>
            </button>
          )}

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
                    className="dropdown-item-btn"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      setShowSavedModal(true)
                    }}
                  >
                    <FolderHeart size={15} />
                    <span>Saved Itineraries ({savedTrips.length})</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Quick Trip Builder</span>
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
              className="nav-auth-btn"
              onClick={() => navigateToView('login')}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )}

          <a className="nav-cta" href="#planner">
            Plan a trip <ArrowUpRight size={16} />
          </a>
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
              <a className="button button-dark" href="#planner">
                Plan my trip <ArrowRight size={17} />
              </a>
              {currentUser ? (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => navigateToView('dashboard')}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--green)' }}
                >
                  <LayoutDashboard size={15} />
                  <span>My Dashboard</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => navigateToView('login')}
                  style={{ background: 'none', border: 0, cursor: 'pointer' }}
                >
                  <LogIn size={15} />
                  <span>Sign in to your dashboard</span>
                </button>
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
            <a className="text-link" href="#planner">
              Customize any destination <ArrowUpRight size={16} />
            </a>
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
                and let our AI travel concierge shape a seamless day-by-day journey.
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
                  <p>Where you're headed, your ideal pacing, budget level, and travel interests.</p>
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
                  <h3>Save, check off & share</h3>
                  <p>Save plans directly to your device, check off activities as you explore, or print to PDF.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trip Planner Form */}
        <section className="planner-section section-container" id="planner">
          <div className="planner-intro">
            <div className="eyebrow">
              <Sparkles size={14} /> THE ITINERARY BUILDER
            </div>
            <h2>
              Let's make a little<br />
              <em>room for wonder.</em>
            </h2>
            <p>A few details are all we need to craft your day-by-day travel story.</p>

            <div className="planner-note">
              <span className="note-icon">
                <Leaf size={17} />
              </span>
              <span>
                <strong>No one-size-fits-all trips.</strong>
                <small>Each itinerary is uniquely tailored to your pace and budget.</small>
              </span>
            </div>

            {aiStatus?.aiConfigured ? (
              <div className="ai-status-badge online">
                <span className="status-dot"></span>
                <span>Gemini AI Engine Active & Ready</span>
              </div>
            ) : (
              <div className="ai-status-badge offline">
                <span className="status-dot"></span>
                <span>Smart Curated Concierge Active</span>
              </div>
            )}
          </div>

          <form className="planner-card" onSubmit={generateTrip}>
            <div className="form-heading">
              <div>
                <span className="form-kicker">PERSONALIZED PLANNER</span>
                <h3>Where to next?</h3>
              </div>
              <span className="form-step">
                01 <span>/ 03</span>
              </span>
            </div>

            <label className="field-label" htmlFor="destination">
              I'm dreaming of traveling to...
            </label>
            <div className="input-wrap">
              <MapPin size={18} />
              <input
                id="destination"
                value={form.destination}
                onChange={e => update('destination', e.target.value)}
                placeholder="City, region, or country (e.g. Kyoto, Japan or Florence, Italy)"
                required
              />
              {form.destination && (
                <button
                  className="input-clear"
                  type="button"
                  onClick={() => update('destination', '')}
                  aria-label="Clear destination"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="form-row">
              <div className="field">
                <label className="field-label" htmlFor="startDate">
                  Starting around
                </label>
                <div className="input-wrap">
                  <CalendarDays size={17} />
                  <input
                    id="startDate"
                    type="date"
                    min={getTodayStr()}
                    value={form.startDate}
                    onChange={e => update('startDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="days">
                  Trip duration
                </label>
                <div className="select-wrap">
                  <select
                    id="days"
                    value={form.days}
                    onChange={e => update('days', e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map(n => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'day' : 'days'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="field-label" style={{ marginTop: '20px' }}>
              Travel style & budget level
            </div>
            <div className="budget-options">
              {[
                { name: 'Budget-friendly', sign: '$', desc: 'Hostels, local diners & free sights (~$45/day)' },
                { name: 'Mid-range', sign: '$$', desc: 'Boutique stays, bistros & entry tickets (~$100/day)' },
                { name: 'Treat yourself', sign: '$$$', desc: 'Luxury hotels, tasting menus & taxis (~$220/day)' }
              ].map(b => (
                <button
                  type="button"
                  key={b.name}
                  className={form.budget === b.name ? 'budget-option selected' : 'budget-option'}
                  onClick={() => update('budget', b.name)}
                >
                  <span>{b.sign}</span>
                  <strong>{b.name}</strong>
                  <small>{b.desc}</small>
                  {form.budget === b.name && <Check size={14} className="check-badge" />}
                </button>
              ))}
            </div>

            <div className="form-row travelers-row">
              <div>
                <div className="field-label">Who's joining you?</div>
                <small className="helper-text">Total travelers in your party</small>
              </div>
              <div className="counter">
                <button
                  type="button"
                  onClick={() => update('travelers', Math.max(1, form.travelers - 1))}
                  aria-label="Decrease traveler count"
                >
                  <Minus size={15} />
                </button>
                <strong>
                  {form.travelers} {form.travelers === 1 ? 'traveler' : 'travelers'}
                </strong>
                <button
                  type="button"
                  onClick={() => update('travelers', Math.min(12, form.travelers + 1))}
                  aria-label="Increase traveler count"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="field-label">What experiences matter to you?</div>
            <div className="interest-grid">
              {allInterests.map(item => {
                const active = form.interests.includes(item)
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => toggleInterest(item)}
                    className={active ? 'interest-chip active' : 'interest-chip'}
                  >
                    {active && <Check size={13} />} {item}
                  </button>
                )
              })}
            </div>

            {error && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="button button-dark generate-button"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>
                    {[
                      'Consulting Gemini travel AI...',
                      'Curating morning spots & bakeries...',
                      'Balancing neighborhood pace...',
                      'Polishing your itinerary...'
                    ][loadingStep]}
                  </span>
                </>
              ) : (
                <>
                  Build my personalized itinerary <Sparkles size={17} />
                </>
              )}
            </button>
            <p className="form-footnote">
              <span>✳</span> Designed to spark wonder. You can save, print, and check off activities anytime.
            </p>
          </form>
        </section>

        {/* Itinerary Display Section */}
        {itinerary && (
          <section className="itinerary-section section-container" id="itinerary">
            <div className="itinerary-header-card">
              <div className="itinerary-top">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={14} /> YOUR PERSONALIZED ITINERARY
                  </div>
                  <h2>{itinerary.destination}</h2>
                  <p className="itinerary-summary">{itinerary.summary}</p>
                </div>

                <div className="itinerary-actions">
                  <button
                    className={isCurrentTripSaved ? 'action-btn saved' : 'action-btn'}
                    onClick={toggleSaveTrip}
                    title="Save this trip to your device"
                  >
                    <Heart size={16} fill={isCurrentTripSaved ? '#244a3a' : 'none'} />
                    <span>{isCurrentTripSaved ? 'Saved to device' : 'Save plan'}</span>
                  </button>

                  <button
                    className="action-btn"
                    onClick={handleCopyMarkdown}
                    title="Copy full itinerary to clipboard"
                  >
                    <Share2 size={16} />
                    <span>Copy</span>
                  </button>

                  <button
                    className="action-btn"
                    onClick={handlePrint}
                    title="Print or export as PDF"
                  >
                    <Printer size={16} />
                    <span>Print / PDF</span>
                  </button>
                </div>
              </div>

              {/* Travel Tip & Best Time Callout */}
              {(itinerary.travelTip || itinerary.bestTimeToVisit) && (
                <div className="travel-tips-box">
                  {itinerary.travelTip && (
                    <div className="tip-item">
                      <Lightbulb size={18} className="tip-icon" />
                      <div>
                        <strong>Insider Tip</strong>
                        <p>{itinerary.travelTip}</p>
                      </div>
                    </div>
                  )}
                  {itinerary.bestTimeToVisit && (
                    <div className="tip-item">
                      <CalendarDays size={18} className="tip-icon" />
                      <div>
                        <strong>Best Time to Visit</strong>
                        <p>{itinerary.bestTimeToVisit}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trip Quick Meta */}
              <div className="itinerary-meta">
                <span>
                  <CalendarDays size={15} />
                  {itinerary.days?.length || form.days} days
                  {form.startDate && ` (Starts ${formatTripDate(form.startDate, 0)})`}
                </span>
                <span>
                  <Users size={15} />
                  {form.travelers} {form.travelers === 1 ? 'traveller' : 'travellers'}
                </span>
                <span>
                  <Wallet size={15} />
                  {form.budget}
                </span>
                {itinerary.generatedBy && (
                  <span className="meta-engine-tag">
                    <Sparkles size={13} />
                    {itinerary.generatedBy.includes('gemini') ? 'Gemini AI Verified' : 'Curated Concierge'}
                  </span>
                )}
              </div>

              {/* Budget Breakdown Summary */}
              {itinerary.budgetBreakdown && (
                <div className="budget-breakdown-card">
                  <div className="budget-header">
                    <div>
                      <span className="budget-label">ESTIMATED TRIP BUDGET</span>
                      <strong className="budget-total">
                        ${itinerary.budgetBreakdown.totalEstimatedUsd?.toLocaleString() || '—'}
                      </strong>
                      <span className="budget-sub">
                        (~${itinerary.budgetBreakdown.dailyPerPersonUsd}/day per traveler)
                      </span>
                    </div>
                  </div>
                  {itinerary.budgetBreakdown.categories && (
                    <div className="budget-categories-grid">
                      <div className="budget-cat-item">
                        <span>Accommodation</span>
                        <strong>${itinerary.budgetBreakdown.categories.accommodation}</strong>
                      </div>
                      <div className="budget-cat-item">
                        <span>Dining & Drinks</span>
                        <strong>${itinerary.budgetBreakdown.categories.dining}</strong>
                      </div>
                      <div className="budget-cat-item">
                        <span>Activities & Entry</span>
                        <strong>${itinerary.budgetBreakdown.categories.activities}</strong>
                      </div>
                      <div className="budget-cat-item">
                        <span>Local Transit</span>
                        <strong>${itinerary.budgetBreakdown.categories.transit}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Category Filter Pills */}
              <div className="category-filters-wrap">
                <span className="filters-label">
                  <Filter size={13} /> Filter activities:
                </span>
                <div className="category-filters">
                  {[
                    { id: 'all', label: 'All Activities' },
                    { id: 'food', label: 'Food & Cafés' },
                    { id: 'culture', label: 'Culture & Art' },
                    { id: 'nature', label: 'Nature & Walks' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className={activeCategoryFilter === f.id ? 'filter-pill active' : 'filter-pill'}
                      onClick={() => setActiveCategoryFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Days Grid */}
            <div className="itinerary-days">
              {filteredDays.map((day, idx) => {
                const dayDate = formatTripDate(form.startDate, idx)
                return (
                  <article className="day-card" key={day.day || idx}>
                    <div className="day-header-row">
                      <div className="day-label">
                        <span>DAY {String(day.day || idx + 1).padStart(2, '0')}</span>
                        {dayDate && <span className="day-date">· {dayDate}</span>}
                        <span className="day-dot"></span>
                      </div>
                    </div>

                    <div className="day-content">
                      <h3>{day.title || `Day ${idx + 1}`}</h3>

                      <div className="activity-list">
                        {(day.activities || []).map((activity, j) => {
                          const Icon = getCategoryIcon(activity.category)
                          const actKey = `${day.day || idx}-${j}-${activity.title}`
                          const isDone = Boolean(checkedActivities[actKey])

                          return (
                            <div
                              className={isDone ? 'activity done' : 'activity'}
                              key={j}
                              onClick={() => toggleActivityChecked(actKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  toggleActivityChecked(actKey)
                                }
                              }}
                              title="Click to check off as visited"
                            >
                              <div className="activity-time">
                                {activity.time || ['09:00', '11:30', '14:30', '17:30'][j % 4]}
                              </div>
                              <div className="activity-icon">
                                <Icon size={16} />
                              </div>
                              <div className="activity-copy">
                                <div className="activity-title-row">
                                  <strong>{activity.title}</strong>
                                  {activity.location && (
                                    <span className="location-tag">
                                      <MapPin size={11} /> {activity.location}
                                    </span>
                                  )}
                                </div>
                                <p>{activity.description}</p>
                              </div>
                              <div className="activity-meta-side">
                                {activity.cost != null && activity.cost > 0 ? (
                                  <span className="activity-cost">${activity.cost}</span>
                                ) : (
                                  <span className="activity-cost free">Free</span>
                                )}
                                <span className={isDone ? 'check-toggle checked' : 'check-toggle'}>
                                  {isDone && <Check size={12} />}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <p className="disclaimer">
              <span>✳ Note:</span> Suggestions and estimated costs are designed for thoughtful trip inspiration. Always verify seasonal opening hours, local transit tickets, and reservations before booking.
            </p>
          </section>
        )}

        {/* Closing Banner */}
        <section className="closing section-container">
          <div>
            <span className="closing-spark">✳</span>
            <h2>Take the scenic route.</h2>
            <p>Because the most memorable stories rarely come from rushing.</p>
          </div>
          <a className="button button-light" href="#planner">
            Plan another adventure <ArrowUpRight size={16} />
          </a>
          <span className="closing-mark">TRIPMIND / 2026</span>
        </section>
      </main>

      {/* Saved Trips Drawer / Modal */}
      {showSavedModal && (
        <div className="modal-backdrop" onClick={() => setShowSavedModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <FolderHeart size={20} />
                <h3>My Saved Plans ({savedTrips.length})</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowSavedModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <div className="modal-empty">
                <Heart size={36} color="#adb1a8" />
                <h4>No saved itineraries yet</h4>
                <p>Generate an itinerary and click "Save plan" to keep it stored here on your device.</p>
              </div>
            ) : (
              <div className="saved-trips-list">
                {savedTrips.map(trip => (
                  <div
                    key={trip.id || trip.destination}
                    className="saved-trip-card"
                    onClick={() => loadSavedTrip(trip)}
                  >
                    <div className="saved-trip-info">
                      <h4>{trip.destination}</h4>
                      <p className="saved-trip-meta">
                        <span>{trip.days?.length || 4} days</span>
                        {trip.savedAt && <span>· Saved {trip.savedAt}</span>}
                      </p>
                      {trip.summary && <small className="saved-trip-desc">{trip.summary}</small>}
                    </div>

                    <div className="saved-trip-actions">
                      <button
                        className="button-small"
                        type="button"
                        onClick={() => loadSavedTrip(trip)}
                      >
                        Open Plan
                      </button>
                      <button
                        className="delete-trip-btn"
                        type="button"
                        onClick={e => deleteSavedTrip(trip.id, e)}
                        title="Delete saved plan"
                        aria-label="Delete saved plan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
