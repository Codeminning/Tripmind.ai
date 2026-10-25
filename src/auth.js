// TripMind AI - Authentication & Multi-Tenant User Management System

const USERS_STORAGE_KEY = 'tripmind_users_db'
const SESSION_STORAGE_KEY = 'tripmind_active_session'
const USER_TRIPS_PREFIX = 'tripmind_trips_'

// Initial Seed Travelers for demo & testing
const DEFAULT_SEED_USERS = [
  {
    id: 'user_sophia',
    name: 'Sophia Chen',
    email: 'sophia@tripmind.ai',
    password: 'explorer123',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    initials: 'SC',
    travelVibe: 'Slow & Cultural Wanderer',
    defaultBudget: 'Mid-range',
    defaultTravelers: 2,
    favoriteInterests: ['Food & cafés', 'Culture & heritage', 'Slow travel'],
    createdAt: '2026-01-15'
  },
  {
    id: 'user_liam',
    name: 'Liam Vance',
    email: 'liam@tripmind.ai',
    password: 'wanderer123',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    initials: 'LV',
    travelVibe: 'Gastronomy & Hidden Gems',
    defaultBudget: 'Treat yourself',
    defaultTravelers: 1,
    favoriteInterests: ['Food & cafés', 'Art & design', 'Hidden gems'],
    createdAt: '2026-02-10'
  }
]

// Seed itineraries for Sophia
const SOPHIA_INITIAL_TRIPS = [
  {
    id: 'trip_sophia_kyoto',
    destination: 'Kyoto, Japan',
    startDate: '2026-11-12',
    savedAt: 'Oct 18, 2026',
    status: 'Upcoming',
    summary: 'A serene 4-day autumn journey through tranquil bamboo groves, early-morning Zen temples, and hidden machiya cafés.',
    travelTip: 'Walk the philosopher’s path before 08:30 AM to catch the morning mist without any tour groups.',
    bestTimeToVisit: 'November for vibrant maple foliage and crisp morning breezes.',
    budgetBreakdown: {
      totalEstimatedUsd: 1100,
      dailyPerPersonUsd: 137,
      categories: { accommodation: 462, dining: 352, activities: 176, transit: 110 }
    },
    days: [
      {
        day: 1,
        title: 'Arashiyama Bamboo & Secret Zen Courtyards',
        activities: [
          { time: '08:30', title: 'Morning artisan matcha & pastry at Tenryu-ji approach', category: 'food', cost: 12, description: 'Single-origin green tea whisked tableside with chestnut wagashi.' },
          { time: '10:30', title: 'Okochi Sanso Villa gardens & panoramic valley overlook', category: 'walk', cost: 10, description: 'Quiet hillside gardens with tea pavilions away from the crowded riverbank.' },
          { time: '13:00', title: 'Handmade soba noodles in a 120-year-old wooden teahouse', category: 'food', cost: 22, description: 'Fresh buckwheat soba with local mountain vegetables.' },
          { time: '16:00', title: 'Saga-Toriimoto preserved preservation district walk', category: 'culture', cost: 0, description: 'Thatched-roof merchant cottages and stone statues lined with lanterns.' }
        ]
      },
      {
        day: 2,
        title: 'Historic Gion Alleys & Evening Lantern Strolls',
        activities: [
          { time: '09:00', title: 'Quiet morning walk through Shirakawa canal', category: 'walk', cost: 0, description: 'Willows drooping over traditional canal bridges before shops open.' },
          { time: '11:00', title: 'Kennin-ji temple twin dragon ceiling & rock garden', category: 'culture', cost: 14, description: 'Oldest Zen temple in Kyoto, featuring dramatic twin dragon ink artwork.' },
          { time: '14:00', title: 'Obanzai multi-dish lunch in Pontocho', category: 'food', cost: 28, description: 'Traditional seasonal Kyoto home cooking served in handmade pottery.' },
          { time: '17:30', title: 'Golden hour at Kiyomizu-dera wooden stage', category: 'culture', cost: 8, description: 'Overlooking Kyoto valley as paper lanterns begin to illuminate.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Kyoto, Japan',
      startDate: '2026-11-12',
      days: '4',
      budget: 'Mid-range',
      travelers: 2,
      interests: ['Food & cafés', 'Culture & heritage', 'Slow travel']
    }
  },
  {
    id: 'trip_sophia_amalfi',
    destination: 'Amalfi Coast, Italy',
    startDate: '2027-05-18',
    savedAt: 'Oct 22, 2026',
    status: 'Dream Wishlist',
    summary: 'Cliffside coastal dream across pastel villages, fragrant lemon groves, and quiet sea-view terraces.',
    travelTip: 'Take the local ferry between Positano and Amalfi for the most breathtaking views from the water.',
    bestTimeToVisit: 'May to June for warm swimming weather before peak summer crowds.',
    budgetBreakdown: {
      totalEstimatedUsd: 1850,
      dailyPerPersonUsd: 230,
      categories: { accommodation: 777, dining: 592, activities: 296, transit: 185 }
    },
    days: [
      {
        day: 1,
        title: 'Ravello Heights & Villa Cimbrone Vistas',
        activities: [
          { time: '09:30', title: 'Espresso & warm sfogliatella on Piazza Vescovado', category: 'food', cost: 8, description: 'Crisp pastry layered with sweet ricotta and candied citrus zest.' },
          { time: '11:00', title: 'Villa Cimbrone infinity terrace walk', category: 'walk', cost: 12, description: 'Panoramic cliffside view known as the Terrace of Infinity.' },
          { time: '14:00', title: 'Seafood paccheri lunch overlooking the Mediterranean', category: 'food', cost: 38, description: 'Fresh catch of the day cooked with cherry tomatoes and white wine.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Amalfi Coast, Italy',
      startDate: '2027-05-18',
      days: '4',
      budget: 'Treat yourself',
      travelers: 2,
      interests: ['Food & cafés', 'Nature & outdoors', 'Slow travel']
    }
  }
]

// Seed itinerary for Liam
const LIAM_INITIAL_TRIPS = [
  {
    id: 'trip_liam_oaxaca',
    destination: 'Oaxaca, Mexico',
    startDate: '2026-12-05',
    savedAt: 'Oct 20, 2026',
    status: 'Upcoming',
    summary: 'A 4-day culinary and artisan odyssey uncovering rich moles, family-owned mezcalerias, and vibrant indigenous craft markets.',
    travelTip: 'Visit the morning food market Mercado 20 de Noviembre hungry for tlayudas and hot chocolate with pan de yema.',
    bestTimeToVisit: 'October through March for clear sunny skies and festival season.',
    budgetBreakdown: {
      totalEstimatedUsd: 740,
      dailyPerPersonUsd: 92,
      categories: { accommodation: 310, dining: 236, activities: 118, transit: 74 }
    },
    days: [
      {
        day: 1,
        title: 'Historic Center, Smoky Markets & Artisan Mezcal',
        activities: [
          { time: '09:00', title: 'Hot chocolate & pan de yema at Mercado 20 de Noviembre', category: 'food', cost: 6, description: 'Frothy artisanal cinnamon chocolate prepared in clay pots.' },
          { time: '11:00', title: 'Santo Domingo church & ethnobotanical garden stroll', category: 'culture', cost: 12, description: 'Stunning cacti collection and baroque gold-leaf church interior.' },
          { time: '14:00', title: 'Black mole tasting & handcrafted tortillas lunch', category: 'food', cost: 18, description: 'Complex 30-ingredient mole negro simmered for over 12 hours.' },
          { time: '18:00', title: 'Evening mezcal tasting flights in a candlelit courtyard', category: 'food', cost: 24, description: 'Wild agave varieties paired with spiced orange slices and sal de gusano.' }
        ]
      }
    ],
    formSnapshot: {
      destination: 'Oaxaca, Mexico',
      startDate: '2026-12-05',
      days: '4',
      budget: 'Budget-friendly',
      travelers: 1,
      interests: ['Food & cafés', 'Culture & heritage', 'Art & design']
    }
  }
]

// Helpers for storage
export function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (!raw) {
      // First time initialization with seed demo users
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_USERS))
      // Preload seed trips
      if (!localStorage.getItem(`${USER_TRIPS_PREFIX}user_sophia`)) {
        localStorage.setItem(`${USER_TRIPS_PREFIX}user_sophia`, JSON.stringify(SOPHIA_INITIAL_TRIPS))
      }
      if (!localStorage.getItem(`${USER_TRIPS_PREFIX}user_liam`)) {
        localStorage.setItem(`${USER_TRIPS_PREFIX}user_liam`, JSON.stringify(LIAM_INITIAL_TRIPS))
      }
      return DEFAULT_SEED_USERS
    }
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to get stored users:', e)
    return DEFAULT_SEED_USERS
  }
}

export function saveStoredUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  } catch (e) {
    console.error('Failed to save users:', e)
  }
}

export function getActiveSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export function setActiveSession(user) {
  try {
    if (!user) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
    }
  } catch (e) {
    console.error('Failed to set active session:', e)
  }
}

export function getUserTrips(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(`${USER_TRIPS_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('Failed to load user trips:', e)
    return []
  }
}

// Sync all user trips from Neon DB to local cache
export async function syncTripsFromNeon(userId) {
  if (!userId) return []
  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(userId)}`)
    if (res.ok) {
      const remoteTrips = await res.json()
      if (Array.isArray(remoteTrips)) {
        localStorage.setItem(`${USER_TRIPS_PREFIX}${userId}`, JSON.stringify(remoteTrips))
        return remoteTrips
      }
    }
  } catch (err) {
    console.warn('Trips sync from Neon DB failed, using local cache:', err)
  }
  return getUserTrips(userId)
}

export function saveUserTrip(userId, trip) {
  if (!userId || !trip) return []
  try {
    const existing = getUserTrips(userId)
    const tripToSave = {
      ...trip,
      id: trip.id || `trip_${Date.now()}`,
      savedAt: trip.savedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: trip.status || 'Upcoming'
    }

    const existingIdx = existing.findIndex(t => t.id === tripToSave.id)
    let updated
    if (existingIdx >= 0) {
      updated = [...existing]
      updated[existingIdx] = { ...tripToSave, updatedAt: new Date().toISOString() }
    } else {
      updated = [tripToSave, ...existing]
    }
    localStorage.setItem(`${USER_TRIPS_PREFIX}${userId}`, JSON.stringify(updated))

    // Persist to Neon Postgres in background
    fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, trip: tripToSave })
    })
      .then(r => r.json())
      .then(remoteTrips => {
        if (Array.isArray(remoteTrips)) {
          localStorage.setItem(`${USER_TRIPS_PREFIX}${userId}`, JSON.stringify(remoteTrips))
        }
      })
      .catch(e => console.warn('Neon save trip sync error:', e))

    return updated
  } catch (e) {
    console.error('Failed to save user trip:', e)
    return []
  }
}

export function deleteUserTrip(userId, tripId) {
  if (!userId || !tripId) return []
  try {
    const existing = getUserTrips(userId)
    const updated = existing.filter(t => t.id !== tripId)
    localStorage.setItem(`${USER_TRIPS_PREFIX}${userId}`, JSON.stringify(updated))

    // Remove from Neon Postgres in background
    fetch(`/api/trips/${encodeURIComponent(userId)}/${encodeURIComponent(tripId)}`, {
      method: 'DELETE'
    }).catch(e => console.warn('Neon delete trip sync error:', e))

    return updated
  } catch (e) {
    console.error('Failed to delete user trip:', e)
    return []
  }
}

export function updateUserTrip(userId, tripId, updates) {
  if (!userId || !tripId) return []
  try {
    const existing = getUserTrips(userId)
    const tripToUpdate = existing.find(t => t.id === tripId)
    const updated = existing.map(t => (t.id === tripId ? { ...t, ...updates } : t))
    localStorage.setItem(`${USER_TRIPS_PREFIX}${userId}`, JSON.stringify(updated))

    if (tripToUpdate) {
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trip: { ...tripToUpdate, ...updates } })
      }).catch(e => console.warn('Neon update trip sync error:', e))
    }

    return updated
  } catch (e) {
    console.error('Failed to update trip:', e)
    return []
  }
}

// User Auth Operations (Backed by Neon Postgres)
export async function authenticateWithEmail(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase()

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.')
    }

    const session = data.user
    setActiveSession(session)
    // Synchronize trips from Neon into local cache
    syncTripsFromNeon(session.id)
    return session
  } catch (err) {
    // If network or server error, check local stored demo accounts
    console.warn('Backend login unavailable, checking local fallback:', err.message)
    const users = getStoredUsers()
    const user = users.find(u => u.email.toLowerCase() === cleanEmail)

    if (!user) {
      throw new Error(err.message || 'No account found with this email address. Please sign up.')
    }

    if (user.password !== password) {
      throw new Error('Incorrect password. Please try again.')
    }

    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      initials: user.initials,
      travelVibe: user.travelVibe || 'Thoughtful Explorer',
      defaultBudget: user.defaultBudget || 'Mid-range',
      defaultTravelers: user.defaultTravelers || 2,
      favoriteInterests: user.favoriteInterests || ['Food & cafés', 'Culture & heritage'],
      authProvider: 'email',
      loggedInAt: new Date().toISOString()
    }

    setActiveSession(session)
    return session
  }
}

export async function registerWithEmail({ name, email, password, travelVibe }) {
  const cleanEmail = (email || '').trim().toLowerCase()
  const cleanName = (name || '').trim()

  if (!cleanName) throw new Error('Please enter your name.')
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.')
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.')

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, email: cleanEmail, password, travelVibe })
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed.')
    }

    const session = data.user
    setActiveSession(session)
    return session
  } catch (err) {
    console.warn('Backend registration unavailable, using local fallback:', err.message)
    const users = getStoredUsers()
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.')
    }

    const nameParts = cleanName.split(' ')
    const initials = nameParts.length > 1 
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : cleanName.slice(0, 2).toUpperCase()

    const newUser = {
      id: `user_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=244a3a&textColor=ffffff`,
      initials,
      travelVibe: travelVibe || 'Slow & Curious Traveler',
      defaultBudget: 'Mid-range',
      defaultTravelers: 2,
      favoriteInterests: ['Food & cafés', 'Culture & heritage', 'Slow travel'],
      createdAt: new Date().toISOString().split('T')[0]
    }

    saveStoredUsers([...users, newUser])

    const session = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      initials: newUser.initials,
      travelVibe: newUser.travelVibe,
      defaultBudget: newUser.defaultBudget,
      defaultTravelers: newUser.defaultTravelers,
      favoriteInterests: newUser.favoriteInterests,
      authProvider: 'email',
      loggedInAt: new Date().toISOString()
    }

    setActiveSession(session)
    return session
  }
}

export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export async function authenticateWithGoogleCredential(credentialToken) {
  const payload = parseJwt(credentialToken)
  if (!payload || !payload.email) {
    throw new Error('Could not verify Google credential.')
  }
  return authenticateWithGoogle({
    name: payload.name || payload.given_name || payload.email.split('@')[0],
    email: payload.email,
    avatar: payload.picture,
    initials: (payload.name || payload.email).slice(0, 2).toUpperCase()
  })
}

export async function authenticateWithGoogle(customProfile = null) {
  const profile = customProfile || {
    name: 'Dhyanesh Visakan',
    email: 'dhyanesh.visakan@gmail.com',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Dhyanesh%20Visakan&backgroundColor=244a3a&textColor=ffffff',
    initials: 'DV'
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    })
    const data = await res.json()
    if (res.ok && data.user) {
      setActiveSession(data.user)
      syncTripsFromNeon(data.user.id)
      return data.user
    }
  } catch (e) {
    console.warn('Neon Google auth failed, falling back locally:', e)
  }

  // Local fallback
  const users = getStoredUsers()
  let user = users.find(u => u.email.toLowerCase() === profile.email.toLowerCase())

  if (!user) {
    user = {
      id: `user_google_${Date.now()}`,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name)}&backgroundColor=244a3a&textColor=ffffff`,
      initials: profile.initials || profile.name.slice(0, 2).toUpperCase(),
      travelVibe: 'Food & Culinary Explorer',
      defaultBudget: 'Mid-range',
      defaultTravelers: 2,
      favoriteInterests: ['Food & cafés', 'Culture & heritage', 'Slow travel'],
      authProvider: 'google',
      createdAt: new Date().toISOString().split('T')[0]
    }
    saveStoredUsers([...users, user])
  }

  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    initials: user.initials,
    travelVibe: user.travelVibe || 'Food & Culinary Explorer',
    defaultBudget: user.defaultBudget || 'Mid-range',
    defaultTravelers: user.defaultTravelers || 2,
    favoriteInterests: user.favoriteInterests || ['Food & cafés'],
    authProvider: 'google',
    loggedInAt: new Date().toISOString()
  }

  setActiveSession(session)
  return session
}

export function logOutUser() {
  setActiveSession(null)
}

export function updateUserProfile(userId, updates) {
  const users = getStoredUsers()
  const updatedUsers = users.map(u => {
    if (u.id === userId) {
      return { ...u, ...updates }
    }
    return u
  })
  saveStoredUsers(updatedUsers)

  const currentSession = getActiveSession()
  let newSession = currentSession
  if (currentSession && currentSession.id === userId) {
    newSession = { ...currentSession, ...updates }
    setActiveSession(newSession)
  }

  // Sync to Neon DB
  fetch('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...updates })
  }).catch(e => console.warn('Neon profile update sync failed:', e))

  return newSession
}

