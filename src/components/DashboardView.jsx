import React, { useState, useMemo, useEffect } from 'react'
import {
  Compass,
  Sparkles,
  CalendarDays,
  MapPin,
  Clock,
  Wallet,
  Users,
  Plus,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Heart,
  FolderHeart,
  Trash2,
  Download,
  Share2,
  Printer,
  ChevronRight,
  LogOut,
  Sliders,
  Settings,
  Search,
  Check,
  Leaf,
  Utensils,
  Camera,
  Landmark,
  Footprints,
  AlertCircle
} from 'lucide-react'
import {
  getUserTrips,
  syncTripsFromNeon,
  saveUserTrip,
  deleteUserTrip,
  updateUserTrip,
  updateUserProfile
} from '../auth'

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('food') || c.includes('café') || c.includes('cafe')) return Utensils
  if (c.includes('nature') || c.includes('park') || c.includes('garden')) return Leaf
  if (c.includes('culture') || c.includes('historic') || c.includes('temple')) return Landmark
  if (c.includes('walk') || c.includes('stroll') || c.includes('wander')) return Footprints
  if (c.includes('art') || c.includes('design') || c.includes('museum')) return Camera
  return Compass
}

export default function DashboardView({
  currentUser,
  onLogout,
  onNavigateExplore,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('planner') // Default to 'planner' so they can plan right away!
  const [userTrips, setUserTrips] = useState(() => getUserTrips(currentUser.id))
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'Upcoming' | 'Dream Wishlist'
  const [checkedActivities, setCheckedActivities] = useState({})
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')

  // Individual Planner State inside the dashboard
  const [dashboardForm, setDashboardForm] = useState({
    destination: '',
    startDate: '',
    days: '4',
    budget: currentUser.defaultBudget || 'Mid-range',
    travelers: currentUser.defaultTravelers || 2,
    interests: currentUser.favoriteInterests || ['Food & cafés', 'Culture & heritage', 'Slow travel']
  })
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [plannerError, setPlannerError] = useState('')

  // Profile editing state
  const [profileName, setProfileName] = useState(currentUser.name || '')
  const [profileVibe, setProfileVibe] = useState(currentUser.travelVibe || 'Slow & Cultural Wanderer')
  const [profileBudget, setProfileBudget] = useState(currentUser.defaultBudget || 'Mid-range')
  const [profileTravelers, setProfileTravelers] = useState(currentUser.defaultTravelers || 2)

  // Pick up any preset destination selected on the intro page
  useEffect(() => {
    try {
      const preset = sessionStorage.getItem('tripmind_preset_destination')
      if (preset) {
        const parsed = JSON.parse(preset)
        setDashboardForm(prev => ({
          ...prev,
          destination: parsed.name || parsed.destination || prev.destination,
          days: parsed.days || prev.days,
          budget: parsed.budget || prev.budget,
          interests: parsed.interests || prev.interests
        }))
        setActiveTab('planner')
        sessionStorage.removeItem('tripmind_preset_destination')
      }
    } catch (e) {}
  }, [])

  // Sync user trips from Neon PostgreSQL on dashboard mount
  useEffect(() => {

    if (currentUser?.id) {
      syncTripsFromNeon(currentUser.id).then(trips => {
        if (Array.isArray(trips)) {
          setUserTrips(trips)
        }
      }).catch(err => console.warn('Neon trip sync:', err))
    }
  }, [currentUser?.id])

  const toggleActivity = (key) => {

    setCheckedActivities(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handlePrint = () => {
    window.print()
  }

  // Refresh user trips from storage
  const reloadTrips = () => {
    const fresh = getUserTrips(currentUser.id)
    setUserTrips(fresh)
  }

  // Calculate dashboard statistics
  const stats = useMemo(() => {
    const totalTrips = userTrips.length
    const totalDays = userTrips.reduce((acc, t) => acc + (Number(t.days?.length) || Number(t.formSnapshot?.days) || 3), 0)
    const totalBudget = userTrips.reduce((acc, t) => acc + (t.budgetBreakdown?.totalEstimatedUsd || 0), 0)
    const upcoming = userTrips.filter(t => t.status !== 'Completed').length
    return { totalTrips, totalDays, totalBudget, upcoming }
  }, [userTrips])

  // Next upcoming journey spotlight
  const nextTrip = useMemo(() => {
    if (userTrips.length === 0) return null
    return userTrips[0]
  }, [userTrips])

  // Filtered trips for "My Trips" tab
  const filteredTrips = useMemo(() => {
    return userTrips.filter(trip => {
      const matchSearch = trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trip.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === 'all' || trip.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [userTrips, searchQuery, statusFilter])

  // Toggle interest in dashboard planner form
  const toggleInterest = (interest) => {
    setDashboardForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }))
  }

  // Handle generating a new trip directly inside their individual dashboard
  const handleGenerateDashboardTrip = async (e) => {
    e.preventDefault()
    if (!dashboardForm.destination.trim()) {
      setPlannerError('Please enter a destination.')
      return
    }

    setPlannerLoading(true)
    setPlannerError('')

    let tripData = null

    try {
      const resp = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardForm)
      })
      if (resp.ok) {
        tripData = await resp.json()
      }
    } catch (err) {
      console.warn('Backend proxy fetch failed:', err)
    }

    // Fallback if server call didn't complete
    if (!tripData || !Array.isArray(tripData.days)) {
      const daysCount = Number(dashboardForm.days) || 3
      const daysList = []
      const titles = [
        'Arrival & Neighborhood Coffee Walks',
        'Historic Quarters, Museums & Old Charm',
        'Scenic Panoramas & Golden Hour Vistas',
        'Local Gastronomy & Evening Courtyards',
        'Hidden Gardens & Local Artisans'
      ]
      for (let i = 1; i <= daysCount; i++) {
        daysList.push({
          day: i,
          title: titles[(i - 1) % titles.length],
          activities: [
            { time: '09:00', title: 'Single-origin café & local bakery pastries', category: 'food', cost: 14, description: 'Wake up leisurely and soak in neighborhood street life.' },
            { time: '11:30', title: 'Heritage landmark & hidden architectural courtyards', category: 'culture', cost: 18, description: 'Explore authentic corners with centuries of stories.' },
            { time: '14:00', title: 'Seasonal lunch at a resident-loved bistro', category: 'food', cost: 26, description: 'Locally grown ingredients and signature regional delicacies.' },
            { time: '17:00', title: 'Sunset viewpoint & quiet stroll', category: 'walk', cost: 0, description: 'Golden hour vantage point overlooking the surrounding scenery.' }
          ]
        })
      }
      const multiplier = dashboardForm.budget === 'Budget-friendly' ? 50 : dashboardForm.budget === 'Treat yourself' ? 220 : 110
      const totalCost = multiplier * daysCount * dashboardForm.travelers
      tripData = {
        destination: dashboardForm.destination.trim(),
        summary: `A carefully paced ${daysCount}-day journey through ${dashboardForm.destination.trim()}, curated specifically for ${currentUser.name}'s travel rhythm.`,
        travelTip: 'Walk early in the morning before crowds gather to experience the most peaceful side of the city.',
        bestTimeToVisit: 'Spring or Autumn for milder weather and fewer tour groups.',
        budgetBreakdown: {
          totalEstimatedUsd: totalCost,
          dailyPerPersonUsd: multiplier,
          categories: { accommodation: Math.round(totalCost * 0.45), dining: Math.round(totalCost * 0.3), activities: Math.round(totalCost * 0.15), transit: Math.round(totalCost * 0.1) }
        },
        days: daysList
      }
    }

    const saved = saveUserTrip(currentUser.id, {
      ...tripData,
      id: `trip_${Date.now()}`,
      startDate: dashboardForm.startDate,
      status: 'Upcoming',
      formSnapshot: { ...dashboardForm }
    })

    setUserTrips(saved)
    setSelectedTrip(saved[0])
    setPlannerLoading(false)
    setActiveTab('trips')
    showToast(`✨ Plan for ${dashboardForm.destination} saved to your dashboard!`)
  }

  const handleDeleteTrip = (tripId, e) => {
    e?.stopPropagation()
    if (window.confirm('Are you sure you want to remove this itinerary from your dashboard?')) {
      const updated = deleteUserTrip(currentUser.id, tripId)
      setUserTrips(updated)
      if (selectedTrip?.id === tripId) {
        setSelectedTrip(null)
      }
      showToast('Itinerary removed from your dashboard.')
    }
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    updateUserProfile(currentUser.id, {
      name: profileName,
      travelVibe: profileVibe,
      defaultBudget: profileBudget,
      defaultTravelers: Number(profileTravelers)
    })
    showToast('✨ Travel profile preferences updated!')
  }

  const copyTripMarkdown = (trip) => {
    let text = `# ${trip.destination} Itinerary (${trip.days?.length || 4} Days)\n`
    text += `*Planned for ${currentUser.name} · Status: ${trip.status}*\n\n`
    if (trip.summary) text += `${trip.summary}\n\n`
    if (trip.travelTip) text += `> Travel Tip: ${trip.travelTip}\n\n`
    trip.days?.forEach((d) => {
      text += `## Day ${d.day}: ${d.title}\n`
      d.activities?.forEach(act => {
        text += `- **${act.time}** - ${act.title} (${act.category}) [Est. $${act.cost}]\n  ${act.description}\n`
      })
      text += '\n'
    })
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Trip copied to clipboard!')
    })
  }

  return (
    <div className="dashboard-root">
      {/* Dashboard Top Header Bar */}
      <header className="dashboard-topbar">
        <div className="dashboard-brand-wrap">
          <button
            type="button"
            className="brand brand-btn"
            onClick={onNavigateExplore}
            title="Return to Public Explore Page"
          >
            <span className="brand-mark">
              <Compass size={21} strokeWidth={2.2} />
            </span>
            <span>
              tripmind<span className="brand-ai">.ai</span>
            </span>
          </button>
          <span className="dashboard-tag">Personal Workspace</span>
        </div>

        <div className="dashboard-top-actions">
          <button
            type="button"
            className="topbar-btn text"
            onClick={onNavigateExplore}
          >
            Explore Inspirations
          </button>
          <div className="user-profile-badge">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="user-badge-avatar"
              />
            ) : (
              <span className="user-badge-initials">{currentUser.initials || 'U'}</span>
            )}
            <div className="user-badge-info">
              <span className="user-badge-name">{currentUser.name}</span>
              <span className="user-badge-vibe">{currentUser.travelVibe}</span>
            </div>
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={onLogout}
            title="Log out of this device"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <div className="dashboard-hero-banner section-container">
        <div className="dashboard-welcome">
          <div className="dashboard-eyebrow">
            <Sparkles size={14} /> INDIVIDUAL TRAVEL CONCIERGE
          </div>
          <h1>
            Welcome back, <span>{currentUser.name}</span>.
          </h1>
          <p>
            Your personal travel workspace where every itinerary is tailored to your taste,
            budget, and favorite way to wander.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="dashboard-stats-grid">
          <div className="stat-card">
            <span className="stat-num">{stats.totalTrips}</span>
            <span className="stat-label">Saved Itineraries</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.totalDays}</span>
            <span className="stat-label">Travel Days Planned</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">${stats.totalBudget.toLocaleString()}</span>
            <span className="stat-label">Est. Budget Tracked</span>
          </div>
          <div className="stat-card highlight">
            <span className="stat-num">{stats.upcoming}</span>
            <span className="stat-label">Active Journeys</span>
          </div>
        </div>
      </div>

      {/* Dashboard Tab Navigation */}
      <div className="section-container dashboard-nav-tabs">
        <button
          type="button"
          className={`d-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('overview')
            setSelectedTrip(null)
          }}
        >
          <Compass size={17} />
          <span>Dashboard Overview</span>
        </button>

        <button
          type="button"
          className={`d-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('planner')
            setSelectedTrip(null)
          }}
        >
          <Plus size={17} />
          <span>Plan a New Journey</span>
        </button>

        <button
          type="button"
          className={`d-tab-btn ${activeTab === 'trips' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('trips')
            reloadTrips()
          }}
        >
          <FolderHeart size={17} />
          <span>My Saved Trips ({userTrips.length})</span>
        </button>

        <button
          type="button"
          className={`d-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('profile')
            setSelectedTrip(null)
          }}
        >
          <Sliders size={17} />
          <span>Traveler Preferences</span>
        </button>
      </div>

      {/* Main Content Areas */}
      <main className="section-container dashboard-main-content">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="dashboard-overview-layout">
            {/* Left Column: Spotlight on Next Upcoming Trip */}
            <div className="overview-left">
              {nextTrip ? (
                <div className="spotlight-card">
                  <div className="spotlight-header">
                    <div className="spotlight-badge">
                      <Sparkles size={14} /> FEATURED UPCOMING JOURNEY
                    </div>
                    <span className="spotlight-status">{nextTrip.status}</span>
                  </div>

                  <h3 className="spotlight-destination">{nextTrip.destination}</h3>
                  <p className="spotlight-summary">{nextTrip.summary}</p>

                  <div className="spotlight-meta-row">
                    <div className="spotlight-meta-pill">
                      <CalendarDays size={15} />
                      <span>{nextTrip.days?.length || 4} Days</span>
                    </div>
                    {nextTrip.startDate && (
                      <div className="spotlight-meta-pill">
                        <Clock size={15} />
                        <span>Starting {nextTrip.startDate}</span>
                      </div>
                    )}
                    <div className="spotlight-meta-pill">
                      <Wallet size={15} />
                      <span>${nextTrip.budgetBreakdown?.totalEstimatedUsd || '—'} Est.</span>
                    </div>
                  </div>

                  {nextTrip.travelTip && (
                    <div className="spotlight-tip">
                      <span className="tip-spark">✳</span>
                      <p>
                        <strong>Concierge Tip:</strong> {nextTrip.travelTip}
                      </p>
                    </div>
                  )}

                  <div className="spotlight-actions">
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => {
                        setSelectedTrip(nextTrip)
                        setActiveTab('trips')
                      }}
                    >
                      <span>View Full Itinerary</span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => onLoadTripToMainPlanner(nextTrip)}
                    >
                      <span>Open in Main Builder</span>
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-spotlight-card">
                  <FolderHeart size={44} color="#7e9b7a" />
                  <h3>No trips saved in your dashboard yet</h3>
                  <p>Ready for your next journey? Plan an itinerary and keep it organized right here.</p>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => setActiveTab('planner')}
                  >
                    <span>Plan Your First Trip</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* Quick Inspiration Prompts */}
              <div className="dashboard-inspiration-box">
                <div className="inspiration-box-header">
                  <h4>Curated Suggestions for {currentUser.name}</h4>
                  <small>Based on your {currentUser.travelVibe} preference</small>
                </div>
                <div className="inspiration-pills">
                  {[
                    { name: 'Kyoto, Japan', days: '4', budget: 'Mid-range' },
                    { name: 'Amalfi Coast, Italy', days: '4', budget: 'Treat yourself' },
                    { name: 'Oaxaca, Mexico', days: '4', budget: 'Budget-friendly' },
                    { name: 'Lisbon, Portugal', days: '3', budget: 'Mid-range' }
                  ].map(item => (
                    <button
                      key={item.name}
                      type="button"
                      className="inspire-chip"
                      onClick={() => {
                        setDashboardForm(prev => ({
                          ...prev,
                          destination: item.name,
                          days: item.days,
                          budget: item.budget
                        }))
                        setActiveTab('planner')
                      }}
                    >
                      <MapPin size={14} />
                      <span>{item.name}</span>
                      <small>({item.days}d · {item.budget})</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Quick Planner Widget */}
            <div className="overview-right">
              <div className="quick-planner-box">
                <div className="box-header">
                  <div className="eyebrow">QUICK PLANNER</div>
                  <h3>Where are you dreaming of?</h3>
                  <p>Spin up a tailored itinerary in seconds directly into your dashboard.</p>
                </div>

                <form onSubmit={handleGenerateDashboardTrip} className="quick-planner-form">
                  <div className="field">
                    <label className="field-label">Destination</label>
                    <div className="input-wrap">
                      <MapPin size={16} />
                      <input
                        type="text"
                        placeholder="e.g. Bergen, Norway or Kyoto"
                        value={dashboardForm.destination}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, destination: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label className="field-label">Duration</label>
                      <div className="select-wrap">
                        <select
                          value={dashboardForm.days}
                          onChange={(e) =>
                            setDashboardForm(p => ({ ...p, days: e.target.value }))
                          }
                        >
                          <option value="2">2 Days (Quick escape)</option>
                          <option value="3">3 Days (Long weekend)</option>
                          <option value="4">4 Days (Classic pace)</option>
                          <option value="5">5 Days (Immersive)</option>
                          <option value="7">7 Days (Full week)</option>
                        </select>
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">Budget</label>
                      <div className="select-wrap">
                        <select
                          value={dashboardForm.budget}
                          onChange={(e) =>
                            setDashboardForm(p => ({ ...p, budget: e.target.value }))
                          }
                        >
                          <option value="Budget-friendly">Budget-friendly</option>
                          <option value="Mid-range">Mid-range</option>
                          <option value="Treat yourself">Treat yourself</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="button button-dark full-width"
                    disabled={plannerLoading}
                  >
                    {plannerLoading ? (
                      <span>Curating Day-by-Day Plan...</span>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Generate & Save to My Dashboard</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Recent Saved Itineraries Mini List */}
              <div className="recent-trips-card">
                <div className="recent-header">
                  <h4>My Recent Plans</h4>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setActiveTab('trips')}
                  >
                    View all ({userTrips.length})
                  </button>
                </div>

                {userTrips.length === 0 ? (
                  <p className="no-trips-hint">No trips created yet.</p>
                ) : (
                  <div className="recent-list">
                    {userTrips.slice(0, 3).map(trip => (
                      <div
                        key={trip.id}
                        className="recent-trip-item"
                        onClick={() => {
                          setSelectedTrip(trip)
                          setActiveTab('trips')
                        }}
                      >
                        <div className="recent-item-info">
                          <strong>{trip.destination}</strong>
                          <small>
                            {trip.days?.length || 4} days · Saved {trip.savedAt}
                          </small>
                        </div>
                        <ChevronRight size={16} color="#7e9b7a" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEDICATED PLANNER STUDIO */}
        {activeTab === 'planner' && (
          <div className="dashboard-planner-studio">
            <div className="studio-header">
              <div className="eyebrow">
                <Sparkles size={14} /> PERSONAL ITINERARY BUILDER
              </div>
              <h2>Plan an adventure tailored to you.</h2>
              <p>
                Tell us where you want to go. TripMind crafts an unhurried, day-by-day plan
                with neighborhood spots, estimated costs, and morning coffee recommendations.
              </p>
            </div>

            <div className="planner-card studio-card">
              <form onSubmit={handleGenerateDashboardTrip}>
                {plannerError && (
                  <div className="auth-alert error" role="alert">
                    <AlertCircle size={16} />
                    <span>{plannerError}</span>
                  </div>
                )}

                <div className="field">
                  <label className="field-label">Where do you want to explore?</label>
                  <div className="input-wrap">
                    <MapPin size={18} />
                    <input
                      type="text"
                      placeholder="e.g. Kyoto, Japan or Florence, Italy"
                      value={dashboardForm.destination}
                      onChange={(e) =>
                        setDashboardForm(p => ({ ...p, destination: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <label className="field-label">Target Start Date (Optional)</label>
                    <div className="input-wrap">
                      <CalendarDays size={18} />
                      <input
                        type="date"
                        value={dashboardForm.startDate}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, startDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Trip Length (Days)</label>
                    <div className="select-wrap">
                      <select
                        value={dashboardForm.days}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, days: e.target.value }))
                        }
                      >
                        <option value="2">2 Days (Weekend Break)</option>
                        <option value="3">3 Days (Long Weekend)</option>
                        <option value="4">4 Days (Classic Pace)</option>
                        <option value="5">5 Days (In-Depth)</option>
                        <option value="7">7 Days (Full Explorer)</option>
                        <option value="10">10 Days (Deep Travel)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <label className="field-label">Budget Pacing</label>
                    <div className="select-wrap">
                      <select
                        value={dashboardForm.budget}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, budget: e.target.value }))
                        }
                      >
                        <option value="Budget-friendly">Budget-friendly (Hostels, street food, transit)</option>
                        <option value="Mid-range">Mid-range (Boutique hotels, cozy bistros)</option>
                        <option value="Treat yourself">Treat yourself (Luxury retreats, fine dining)</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Travelers</label>
                    <div className="select-wrap">
                      <select
                        value={dashboardForm.travelers}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, travelers: Number(e.target.value) }))
                        }
                      >
                        <option value="1">1 Solo explorer</option>
                        <option value="2">2 Travelers (Duo / Couple)</option>
                        <option value="3">3 Travelers</option>
                        <option value="4">4 Travelers (Small group)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="field interest-field" style={{ marginTop: '20px' }}>
                  <label className="field-label">Select your travel interests:</label>
                  <div className="interests-grid">
                    {[
                      'Food & cafés',
                      'Nature & outdoors',
                      'Culture & heritage',
                      'Art & design',
                      'Hidden gems',
                      'Slow travel',
                      'Adventure',
                      'Nightlife & bars'
                    ].map(interest => {
                      const active = dashboardForm.interests.includes(interest)
                      return (
                        <button
                          key={interest}
                          type="button"
                          className={`interest-tag ${active ? 'active' : ''}`}
                          onClick={() => toggleInterest(interest)}
                        >
                          {active && <Check size={14} />}
                          <span>{interest}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="planner-submit-row" style={{ marginTop: '28px' }}>
                  <button
                    type="submit"
                    className="button button-dark"
                    disabled={plannerLoading}
                  >
                    {plannerLoading ? (
                      <span>Consulting AI Travel Concierge...</span>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        <span>Generate Itinerary & Save to Dashboard</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: MY SAVED TRIPS */}
        {activeTab === 'trips' && (
          <div className="dashboard-trips-view">
            {/* Filter and Search Bar */}
            <div className="trips-filter-bar">
              <div className="trips-search-wrap">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search your saved itineraries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="trips-status-filters">
                {['all', 'Upcoming', 'Dream Wishlist'].map(status => (
                  <button
                    key={status}
                    type="button"
                    className={`filter-pill ${statusFilter === status ? 'active' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All Trips' : status}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="button button-dark"
                onClick={() => setActiveTab('planner')}
              >
                <Plus size={16} />
                <span>New Trip</span>
              </button>
            </div>

            {/* Display Selected Trip Details Modal or Expanded Panel */}
            {selectedTrip ? (
              <div className="selected-trip-workspace">
                <div className="workspace-header">
                  <button
                    type="button"
                    className="back-to-list-btn"
                    onClick={() => setSelectedTrip(null)}
                  >
                    ← Back to all saved plans
                  </button>
                  <div className="workspace-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={handlePrint}
                    >
                      <Printer size={15} />
                      <span>Print PDF</span>
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => copyTripMarkdown(selectedTrip)}
                    >
                      <Share2 size={15} />
                      <span>Copy Markdown</span>
                    </button>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => {
                        setSelectedTrip(null)
                        setActiveTab('planner')
                      }}
                    >
                      <Plus size={15} />
                      <span>Plan Another Trip</span>
                    </button>
                    <button
                      type="button"
                      className="delete-trip-btn"
                      onClick={(e) => handleDeleteTrip(selectedTrip.id, e)}
                      title="Delete this itinerary"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Itinerary Preview in Dashboard */}
                <div className="trip-sheet-card">
                  <div className="trip-sheet-top">
                    <span className="destination-tag">
                      {selectedTrip.destination.toUpperCase()} · {selectedTrip.status || 'SAVED'}
                    </span>
                    <h2>{selectedTrip.destination}</h2>
                    <p className="trip-sheet-summary">{selectedTrip.summary}</p>
                    {selectedTrip.travelTip && (
                      <div className="trip-sheet-tip">
                        <strong>✳ Local Secret:</strong> {selectedTrip.travelTip}
                      </div>
                    )}
                  </div>

                  {/* Budget breakdown mini banner */}
                  {selectedTrip.budgetBreakdown && (
                    <div className="budget-summary-strip">
                      <div className="budget-strip-item">
                        <small>Total Estimated</small>
                        <strong>${selectedTrip.budgetBreakdown.totalEstimatedUsd || 0} USD</strong>
                      </div>
                      <div className="budget-strip-item">
                        <small>Daily per person</small>
                        <strong>${selectedTrip.budgetBreakdown.dailyPerPersonUsd || 0} / day</strong>
                      </div>
                      {selectedTrip.budgetBreakdown.categories && (
                        <div className="budget-strip-breakdown">
                          <span>🏨 Stay: ${selectedTrip.budgetBreakdown.categories.accommodation || 0}</span>
                          <span>🍽 Food: ${selectedTrip.budgetBreakdown.categories.dining || 0}</span>
                          <span>🎟 Activities: ${selectedTrip.budgetBreakdown.categories.activities || 0}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Day-by-Day Accordion */}
                  <div className="trip-days-list">
                    {selectedTrip.days?.map(d => (
                      <div key={d.day} className="dashboard-day-card">
                        <div className="day-card-header">
                          <span className="day-badge">Day 0{d.day}</span>
                          <h4>{d.title}</h4>
                        </div>
                        <div className="day-activities-grid">
                          {d.activities?.map((act, actIdx) => {
                            const IconComponent = getCategoryIcon(act.category)
                            const actKey = `${selectedTrip.id || selectedTrip.destination}_d${d.day}_${actIdx}`
                            const isChecked = Boolean(checkedActivities[actKey])
                            return (
                              <div
                                key={actIdx}
                                className={`day-activity-row ${isChecked ? 'completed' : ''}`}
                                onClick={() => toggleActivity(actKey)}
                                style={{ cursor: 'pointer' }}
                                title="Click to mark activity as completed"
                              >
                                <div className="activity-time-chip">
                                  <Clock size={12} />
                                  <span>{act.time}</span>
                                </div>
                                <div className="activity-icon-badge">
                                  <IconComponent size={15} />
                                </div>
                                <div className="activity-details">
                                  <strong style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
                                    {act.title}
                                  </strong>
                                  <p>{act.description}</p>
                                </div>
                                {act.cost !== undefined && (
                                  <div className="activity-cost-tag">
                                    {act.cost === 0 ? 'Free' : `$${act.cost}`}
                                  </div>
                                )}
                                <div className={`check-toggle ${isChecked ? 'checked' : ''}`}>
                                  {isChecked && <Check size={12} />}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Grid of All Saved Trips */
              <div className="trips-cards-grid">
                {filteredTrips.length === 0 ? (
                  <div className="empty-trips-state">
                    <FolderHeart size={44} color="#adb1a8" />
                    <h3>No matching itineraries found</h3>
                    <p>Try searching for a different destination or create a new plan.</p>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => setActiveTab('planner')}
                    >
                      <span>Create New Itinerary</span>
                    </button>
                  </div>
                ) : (
                  filteredTrips.map(trip => (
                    <div
                      key={trip.id}
                      className="user-trip-card"
                      onClick={() => setSelectedTrip(trip)}
                    >
                      <div className="trip-card-header">
                        <span className="trip-status-chip">{trip.status || 'Upcoming'}</span>
                        <button
                          type="button"
                          className="delete-trip-btn"
                          onClick={(e) => handleDeleteTrip(trip.id, e)}
                          title="Delete trip"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <h3 className="trip-card-destination">{trip.destination}</h3>
                      <p className="trip-card-summary">
                        {trip.summary || 'A thoughtfully planned journey organized for your travel rhythm.'}
                      </p>

                      <div className="trip-card-meta">
                        <div className="meta-pill">
                          <CalendarDays size={13} />
                          <span>{trip.days?.length || 4} days</span>
                        </div>
                        <div className="meta-pill">
                          <Wallet size={13} />
                          <span>${trip.budgetBreakdown?.totalEstimatedUsd || '—'}</span>
                        </div>
                        {trip.savedAt && (
                          <div className="meta-pill">
                            <span>Saved {trip.savedAt}</span>
                          </div>
                        )}
                      </div>

                      <div className="trip-card-actions">
                        <button
                          type="button"
                          className="button-small"
                          onClick={() => setSelectedTrip(trip)}
                        >
                          <span>Open Itinerary</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROFILE & PREFERENCES */}
        {activeTab === 'profile' && (
          <div className="dashboard-profile-view">
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-avatar-large">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} />
                  ) : (
                    <span>{currentUser.initials || 'U'}</span>
                  )}
                </div>
                <div>
                  <h3>{currentUser.name}</h3>
                  <p>{currentUser.email}</p>
                  <span className="provider-badge">
                    {currentUser.authProvider === 'google' ? 'Connected via Google' : 'Email Account'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="field">
                  <label className="field-label">Display Name</label>
                  <div className="input-wrap">
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Traveler Persona & Rhythm</label>
                  <div className="select-wrap">
                    <select
                      value={profileVibe}
                      onChange={(e) => setProfileVibe(e.target.value)}
                    >
                      <option value="Slow & Cultural Wanderer">Slow & Cultural Wanderer</option>
                      <option value="Gastronomy & Hidden Gems">Gastronomy & Hidden Gems</option>
                      <option value="Nature & Wild Landscapes">Nature & Wild Landscapes</option>
                      <option value="Art, Design & Architecture">Art, Design & Architecture</option>
                      <option value="Curious Explorer">Curious Explorer</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <label className="field-label">Default Budget Level</label>
                    <div className="select-wrap">
                      <select
                        value={profileBudget}
                        onChange={(e) => setProfileBudget(e.target.value)}
                      >
                        <option value="Budget-friendly">Budget-friendly</option>
                        <option value="Mid-range">Mid-range</option>
                        <option value="Treat yourself">Treat yourself</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Default Traveling Party</label>
                    <div className="select-wrap">
                      <select
                        value={profileTravelers}
                        onChange={(e) => setProfileTravelers(e.target.value)}
                      >
                        <option value="1">1 Solo explorer</option>
                        <option value="2">2 Travelers (Duo)</option>
                        <option value="3">3 Travelers</option>
                        <option value="4">4 Travelers (Small Group)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="profile-save-row">
                  <button type="submit" className="button button-dark">
                    <span>Save Travel Preferences</span>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={onLogout}
                  >
                    <span>Sign Out of Account</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
