import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import {
  Sparkles,
  CalendarDays,
  Calendar,
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
  LogIn,
  Sliders,
  Settings,
  Search,
  Check,
  Leaf,
  Utensils,
  Camera,
  Landmark,
  Footprints,
  AlertCircle,
  Sun,
  Moon,
  Upload,
  AlertTriangle,
  Globe,
  RefreshCw,
  X,
  Map,
  Link2,
  Copy,
  EyeOff,
  Image as ImageIcon,
  MessageSquare,
  Bell,
  CheckSquare,
  CloudRain,
  Compass,
  Star,
  Calculator
} from 'lucide-react'
import {
  getUserTrips,
  syncTripsFromNeon,
  syncSessionWithNeon,
  saveUserTrip,
  deleteUserTrip,
  updateUserTrip,
  updateUserProfile,
  deleteUserAccount
} from '../auth'
import {
  detectCurrencyForDestination,
  formatCurrencyAmount,
  fetchExchangeRates,
  getRatesLastUpdated,
  CURRENCIES
} from '../currency'
import { downloadTripIcs } from '../calendarExport'
import { AppFooter } from './AppFooter'
import { BudgetView } from './BudgetView'
import { TripChatPanel } from './TripChatPanel'
import { CountdownCard } from './CountdownCard'
import { WeatherWidget } from './WeatherWidget'
import { ChecklistView } from './ChecklistView'
import { TodayCompanionView } from './TodayCompanionView'
import { calculateTripCountdown } from '../tripReminders'
import { GroupInviteModal } from './GroupInviteModal'
import { JoinByLinkModal } from './JoinByLinkModal'
import { DestinationAutocomplete } from './DestinationAutocomplete'
import { upper, lower, initials, displayNameOf } from '../utils/safeText'
import { CalendarSyncModal } from './CalendarSyncModal'
import { ActivityCollaboration } from './ActivityCollaboration'
import { ActivityProposalsList } from './ActivityProposalsList'
import { ProposeActivityModal } from './ProposeActivityModal'
import { CurrencyCalculatorModal } from './CurrencyCalculatorModal'
import { TripReviewsView } from './TripReviewsView'
import {
  fetchTripCollaboration,
  updateTripCollaboration,
  proposeActivity,
  confirmProposal,
  dismissProposal,
  voteActivity,
  postActivityComment,
  deleteActivityComment
} from '../groupTrip'
import {
  fetchTripExpenses,
  saveTripExpense,
  deleteTripExpense,
  getTripTravelers,
  saveTripTravelers
} from '../expenses'

const MapView = lazy(() => import('./MapView'))

function getUpcomingWeekendDate() {
  const d = new Date()
  const day = d.getDay() // 0=Sun, 6=Sat
  const daysUntilSat = day === 6 ? 7 : (6 - day)
  d.setDate(d.getDate() + daysUntilSat)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

const TRIP_TYPE_CHIPS = [
  { label: 'Weekend', days: '2', budget: 'Mid-range' },
  { label: 'Budget', days: '3', budget: 'Budget-friendly' },
  { label: 'Family', days: '5', budget: 'Mid-range', travelers: 4 },
  { label: 'Solo', days: '3', budget: 'Budget-friendly', travelers: 1 },
  { label: 'Romantic', days: '4', budget: 'Treat yourself', travelers: 2 },
  { label: 'Adventure', days: '5', budget: 'Mid-range', interests: ['Adventure', 'Nature & outdoors'] }
]

const DEST_CHIPS = ['Jaipur', 'Goa', 'Bali', 'Paris', 'Tokyo', 'Lisbon']

const LOADING_MESSAGES = [
  'Finding the best spots...',
  'Curating unhurried walking routes and daily rhythms...',
  'Planning your days & experiences...',
  'Estimating your budget & local costs...',
  'Discovering local secrets & artisan spots...',
  'Polishing your personalized itinerary...'
]

function computeNameInitials(name) {
  return initials(name);
}

function getCategoryIcon(cat) {
  const c = lower(cat)
  if (c.includes('food') || c.includes('café') || c.includes('cafe')) return Utensils
  if (c.includes('nature') || c.includes('park') || c.includes('garden')) return Leaf
  if (c.includes('culture') || c.includes('historic') || c.includes('temple')) return Landmark
  if (c.includes('walk') || c.includes('stroll') || c.includes('wander')) return Footprints
  if (c.includes('art') || c.includes('design') || c.includes('museum')) return Camera
  return Sparkles
}

export default function DashboardView({
  currentUser,
  onLogout,
  onNavigateLogin,
  onNavigateExplore,
  showToast,
  onUserUpdated
}) {
  const [activeTab, setActiveTab] = useState('planner') // Default to 'planner' so they can plan right away!
  const [userTrips, setUserTrips] = useState(() => getUserTrips(currentUser?.id || 'guest'))
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'Upcoming' | 'Dream Wishlist'
  const [checkedActivities, setCheckedActivities] = useState({})
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')

  // Chat prefill state for in-trip shortcuts
  const [chatInitialPrompt, setChatInitialPrompt] = useState('')

  // Load and persist checked activities per trip
  useEffect(() => {
    if (!selectedTrip?.id) {
      setCheckedActivities({})
      return
    }
    try {
      const stored = localStorage.getItem(`tripmind_checked_${selectedTrip.id}`)
      if (stored) {
        setCheckedActivities(JSON.parse(stored))
      } else {
        setCheckedActivities({})
      }
    } catch (e) {
      setCheckedActivities({})
    }
  }, [selectedTrip?.id])

  // Theme state: Strictly Light or Dark only
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('tripmind_theme') || 'light'
    } catch (e) {
      return 'light'
    }
  })

  // Individual Planner State inside the dashboard
  const [dashboardForm, setDashboardForm] = useState({
    destination: '',
    startDate: getUpcomingWeekendDate(),
    days: '3',
    budget: currentUser?.defaultBudget || 'Mid-range',
    travelers: currentUser?.defaultTravelers || 2,
    interests: currentUser?.favoriteInterests || ['Food & cafés', 'Culture & heritage', 'Slow travel']
  })
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [plannerError, setPlannerError] = useState(null)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const [showGuestSavePrompt, setShowGuestSavePrompt] = useState(true)
  const abortControllerRef = useRef(null)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobStage, setJobStage] = useState('')
  const [activeJobId, setActiveJobId] = useState(null)

  const [tripTypeChip, setTripTypeChip] = useState(null)
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  // Rotating loading status messages
  useEffect(() => {
    if (!plannerLoading) {
      setLoadingMsgIndex(0)
      setJobProgress(0)
      setJobStage('')
      return
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [plannerLoading])

  // Resume in-flight generation on mount if browser was refreshed
  useEffect(() => {
    try {
      const savedJobRaw = sessionStorage.getItem('tripmind_active_job')
      if (savedJobRaw) {
        const parsed = JSON.parse(savedJobRaw)
        if (parsed?.jobId && parsed?.form) {
          setDashboardForm(prev => ({ ...prev, ...parsed.form }))
          // Resume polling if within last 5 minutes
          if (Date.now() - (parsed.startedAt || 0) < 5 * 60 * 1000) {
            handleResumeJob(parsed.jobId, parsed.form)
          } else {
            sessionStorage.removeItem('tripmind_active_job')
          }
        }
      }
    } catch (_) {}
  }, [])

  // Currency states
  const [customCurrencyCode, setCustomCurrencyCode] = useState(null)
  const [tripSheetCurrencyMode, setTripSheetCurrencyMode] = useState('local') // 'local' | 'usd'
  const [currencyCalcOpen, setCurrencyCalcOpen] = useState(false)

  // Trip sheet view tabs: 'itinerary' | 'map'
  const [tripViewTab, setTripViewTab] = useState('itinerary')

  // Rates update timestamp string
  const [ratesUpdated, setRatesUpdated] = useState(() => getRatesLastUpdated())

  // Sharing modal states
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharingLoading, setSharingLoading] = useState(false)
  const [shareCopySuccess, setShareCopySuccess] = useState(false)

  // Real Budget Tracking & Group Split States
  const [tripExpenses, setTripExpenses] = useState([])
  const [tripTravelers, setTripTravelers] = useState(['You'])

  useEffect(() => {
    if (selectedTrip?.id) {
      fetchTripExpenses(selectedTrip.id).then(setTripExpenses)
      setTripTravelers(getTripTravelers(selectedTrip))
    } else {
      setTripExpenses([])
      setTripTravelers(['You'])
    }
  }, [selectedTrip?.id])

  const handleAddExpense = async (expenseData) => {
    if (!selectedTrip?.id) return
    const updated = await saveTripExpense(selectedTrip.id, expenseData, currentUser?.id)
    setTripExpenses(updated)
    showToast?.('Expense logged successfully! 💰')
  }

  const handleUpdateExpense = async (expenseId, expenseData) => {
    if (!selectedTrip?.id) return
    const updated = await saveTripExpense(selectedTrip.id, { ...expenseData, id: expenseId }, currentUser?.id)
    setTripExpenses(updated)
    showToast?.('Expense updated! ✨')
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!selectedTrip?.id) return
    const updated = await deleteTripExpense(selectedTrip.id, expenseId)
    setTripExpenses(updated)
    showToast?.('Expense deleted.')
  }

  const handleUpdateTravelers = async (newTravelers) => {
    if (!selectedTrip?.id) return
    const saved = await saveTripTravelers(selectedTrip.id, newTravelers)
    setTripTravelers(saved)
    setSelectedTrip(prev => prev ? { ...prev, travelers: saved } : prev)
    updateUserTrip(currentUser?.id || 'guest', selectedTrip.id, { travelers: saved })
  }

  // Handle updates made by AI Trip Assistant (applying diffs or undoing)
  const handleTripUpdatedByAssistant = (updatedTrip) => {
    if (!updatedTrip?.id) return
    setSelectedTrip(updatedTrip)
    const userId = currentUser?.id || 'guest'
    updateUserTrip(userId, updatedTrip.id, updatedTrip)
    setSavedTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t))
    if (currentUser?.id) {
      saveUserTrip(currentUser.id, updatedTrip).catch(err => {
        console.warn('Neon trip sync after assistant edit failed:', err)
      })
    }
  }

  // Phase 3: Reminder & Countdown Settings
  const [reminderDays, setReminderDays] = useState([7, 3, 1])
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false)
  const [userNotifications, setUserNotifications] = useState([])
  const [savingReminders, setSavingReminders] = useState(false)

  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/users/${currentUser.id}/reminders`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            if (Array.isArray(data.reminderDays)) setReminderDays(data.reminderDays)
            setEmailRemindersEnabled(Boolean(data.emailRemindersEnabled))
            if (Array.isArray(data.notifications)) setUserNotifications(data.notifications)
          }
        })
        .catch(() => {})
    }
  }, [currentUser?.id])

  const handleSaveReminderSettings = async (e) => {
    e?.preventDefault()
    if (!currentUser?.id) {
      showToast?.('Please sign in to save reminder settings.')
      return
    }
    setSavingReminders(true)
    try {
      const res = await fetch(`/api/users/${currentUser.id}/reminders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderDays, emailRemindersEnabled })
      })
      if (res.ok) {
        showToast?.('Reminder preferences saved! 🔔')
      } else {
        showToast?.('Could not save reminder preferences.')
      }
    } catch (e) {
      showToast?.('Network error saving reminders.')
    } finally {
      setSavingReminders(false)
    }
  }

  const toggleReminderThreshold = (day) => {
    setReminderDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => b - a)
    )
  }

  // Phase 4: Group Trip & Collaboration States
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [joinByLinkOpen, setJoinByLinkOpen] = useState(false)
  const [calendarSyncOpen, setCalendarSyncOpen] = useState(false)
  const [proposeModalOpen, setProposeModalOpen] = useState(false)
  const [proposeDayNum, setProposeDayNum] = useState(1)
  const [conflictNotice, setConflictNotice] = useState(false)

  // Polling every 12 seconds when tab is visible
  useEffect(() => {
    if (!selectedTrip?.id || selectedTrip.id.startsWith('trip_preview_')) return

    const pollInterval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const collabData = await fetchTripCollaboration(selectedTrip.id, currentUser?.token)
        if (collabData && collabData.trip) {
          if (collabData.version > (selectedTrip.version || 1)) {
            setConflictNotice(true)
          }
          setSelectedTrip(prev => {
            if (!prev || prev.id !== collabData.trip.id) return prev
            return {
              ...prev,
              version: collabData.version || prev.version,
              activityProposals: collabData.activityProposals || prev.activityProposals,
              activityVotes: collabData.activityVotes || prev.activityVotes,
              activityComments: collabData.activityComments || prev.activityComments,
              travelers: collabData.trip.travelers || prev.travelers
            }
          })
          if (Array.isArray(collabData.trip.travelers)) {
            setTripTravelers(collabData.trip.travelers)
          }
        }
      } catch (e) {}
    }, 12000)

    return () => clearInterval(pollInterval)
  }, [selectedTrip?.id, selectedTrip?.version, currentUser?.token])

  const handleActivityVote = async (activityKey, voteType) => {
    if (!currentUser) {
      showToast?.('Please sign in to vote on activities.')
      return
    }
    const currentVotes = selectedTrip.activityVotes || {}
    const actVotes = currentVotes[activityKey] || { up: [], down: [] }
    const voter = currentUser.name || 'Traveler'
    let newUp = [...(actVotes.up || [])]
    let newDown = [...(actVotes.down || [])]

    if (voteType === 'up') {
      newUp = newUp.includes(voter) ? newUp.filter(v => v !== voter) : [...newUp, voter]
      newDown = newDown.filter(v => v !== voter)
    } else {
      newDown = newDown.includes(voter) ? newDown.filter(v => v !== voter) : [...newDown, voter]
      newUp = newUp.filter(v => v !== voter)
    }
    const updatedMap = { ...currentVotes, [activityKey]: { up: newUp, down: newDown } }
    setSelectedTrip(prev => ({ ...prev, activityVotes: updatedMap }))

    try {
      const serverVotes = await voteActivity({ tripId: selectedTrip.id, activityKey, voteType, token: currentUser.token })
      setSelectedTrip(prev => ({ ...prev, activityVotes: serverVotes }))
    } catch (e) {
      showToast?.('Could not record vote.')
    }
  }

  const handleActivityComment = async (activityKey, text) => {
    if (!currentUser) {
      showToast?.('Please sign in to comment.')
      return
    }
    try {
      const updatedComments = await postActivityComment({ tripId: selectedTrip.id, activityKey, text, token: currentUser.token })
      setSelectedTrip(prev => ({ ...prev, activityComments: updatedComments }))
      showToast?.('Comment added! 💬')
    } catch (e) {
      showToast?.('Could not post comment.')
    }
  }

  const handleDeleteActivityComment = async (commentId) => {
    try {
      const updatedComments = await deleteActivityComment({ tripId: selectedTrip.id, commentId, token: currentUser.token })
      setSelectedTrip(prev => ({ ...prev, activityComments: updatedComments }))
      showToast?.('Comment removed.')
    } catch (e) {
      showToast?.('Could not delete comment.')
    }
  }

  const handleProposeActivitySubmit = async (activityData) => {
    try {
      const updatedProposals = await proposeActivity({
        tripId: selectedTrip.id,
        day: proposeDayNum,
        activity: activityData,
        token: currentUser.token
      })
      setSelectedTrip(prev => ({ ...prev, activityProposals: updatedProposals }))
      showToast?.('Activity proposed to the group! 💡')
    } catch (e) {
      showToast?.(e.message || 'Could not submit proposal.')
    }
  }

  const handleConfirmProposal = async (proposalId) => {
    try {
      const res = await confirmProposal({ tripId: selectedTrip.id, proposalId, token: currentUser.token })
      if (res?.days) {
        setSelectedTrip(prev => ({
          ...prev,
          days: res.days,
          activityProposals: res.proposals,
          version: res.version
        }))
        showToast?.('Proposal confirmed and added to schedule! 🎉')
      }
    } catch (e) {
      showToast?.(e.message || 'Could not confirm proposal.')
    }
  }

  const handleDismissProposal = async (proposalId) => {
    try {
      const updatedProposals = await dismissProposal({ tripId: selectedTrip.id, proposalId, token: currentUser.token })
      setSelectedTrip(prev => ({ ...prev, activityProposals: updatedProposals }))
      showToast?.('Proposal dismissed.')
    } catch (e) {
      showToast?.('Could not dismiss proposal.')
    }
  }

  // Fetch live exchange rates on mount and refresh timestamp
  useEffect(() => {
    fetchExchangeRates().then(() => {
      setRatesUpdated(getRatesLastUpdated())
    })
  }, [])

  const handleOpenShare = () => {
    setShareCopySuccess(false)
    setShareModalOpen(true)
  }

  const handleCreateShareLink = async () => {
    if (!selectedTrip?.id) return
    if (!currentUser?.id || !currentUser?.token) {
      showToast?.('Please sign in to share itineraries.')
      return
    }

    setSharingLoading(true)
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(selectedTrip.id)}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        }
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate share link.')
      }

      const updatedTrip = { ...selectedTrip, shareId: data.shareId, isShared: true }
      setSelectedTrip(updatedTrip)
      updateUserTrip(currentUser.id, updatedTrip)
      reloadTrips()
      showToast?.('✨ Public share link generated!')
    } catch (err) {
      showToast?.(err.message || 'Error generating share link.')
    } finally {
      setSharingLoading(false)
    }
  }

  const handleRevokeShareLink = async () => {
    if (!selectedTrip?.id || !currentUser?.token) return

    setSharingLoading(true)
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(selectedTrip.id)}/share`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to turn sharing off.')
      }

      const updatedTrip = { ...selectedTrip, isShared: false }
      setSelectedTrip(updatedTrip)
      updateUserTrip(currentUser.id, updatedTrip)
      reloadTrips()
      showToast?.('🔒 Sharing turned off. Public link is now revoked.')
    } catch (err) {
      showToast?.(err.message || 'Error turning off sharing.')
    } finally {
      setSharingLoading(false)
    }
  }

  const handleCopyShareUrl = (url) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setShareCopySuccess(true)
    showToast?.('🔗 Share link copied to clipboard!')
    setTimeout(() => setShareCopySuccess(false), 2800)
  }

  const handleExportCalendar = () => {
    if (!selectedTrip) return
    const success = downloadTripIcs(selectedTrip)
    if (success) {
      showToast?.('📅 Calendar (.ics) file downloaded!')
    } else {
      showToast?.('Unable to export calendar events.')
    }
  }

  // Profile editing state
  const [profileName, setProfileName] = useState(currentUser?.name || '')
  const [profileVibe, setProfileVibe] = useState(currentUser?.travelVibe || 'Slow & Cultural Wanderer')
  const [profileBudget, setProfileBudget] = useState(currentUser?.defaultBudget || 'Mid-range')
  const [profileTravelers, setProfileTravelers] = useState(currentUser?.defaultTravelers || 2)

  // Avatar / DP management state
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || '')
  const [customAvatarInput, setCustomAvatarInput] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

  // Real-time initials computed from the full name field (First letter of Name + Surname)
  const dynamicInitials = useMemo(() => {
    return computeNameInitials(profileName || currentUser?.name || 'Explorer')
  }, [profileName, currentUser?.name])

  // Account deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const deleteModalRef = useRef(null)
  const cancelDeleteBtnRef = useRef(null)

  // Focus trap and Escape listener for Delete Modal (WCAG AA requirement)
  useEffect(() => {
    if (!showDeleteModal) return
    const prevActiveElement = document.activeElement

    const timer = setTimeout(() => {
      cancelDeleteBtnRef.current?.focus()
    }, 50)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeletingAccount) {
        e.preventDefault()
        setShowDeleteModal(false)
        return
      }
      if (e.key === 'Tab' && deleteModalRef.current) {
        const focusable = deleteModalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      prevActiveElement?.focus?.()
    }
  }, [showDeleteModal, isDeletingAccount])

  // Live interest save feedback state (Image 2)
  const [interestSavedFeedback, setInterestSavedFeedback] = useState(false)

  // Keep state in sync if currentUser prop updates
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '')
      setProfileVibe(currentUser.travelVibe || 'Slow & Cultural Wanderer')
      setProfileBudget(currentUser.defaultBudget || 'Mid-range')
      setProfileTravelers(currentUser.defaultTravelers || 2)
      setAvatarPreview(currentUser.avatar || '')
    }
  }, [currentUser])

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

  // Sync user account & trips with Neon PostgreSQL on dashboard mount
  useEffect(() => {
    if (currentUser?.id) {
      syncSessionWithNeon(currentUser).then(res => {
        if (res?.created) {
          showToast?.(`✨ Synced ${currentUser.name} to Neon database!`)
        }
      }).catch(err => console.warn('Neon user sync:', err))

      syncTripsFromNeon(currentUser.id).then(trips => {
        if (Array.isArray(trips)) {
          setUserTrips(trips)
        }
      }).catch(err => console.warn('Neon trip sync:', err))
    }
  }, [currentUser?.id])

  const toggleActivity = (key) => {
    setCheckedActivities(prev => {
      const updated = {
        ...prev,
        [key]: !prev[key]
      }
      if (selectedTrip?.id) {
        try {
          localStorage.setItem(`tripmind_checked_${selectedTrip.id}`, JSON.stringify(updated))
        } catch (e) {
          console.warn('Failed to persist checked activity:', e)
        }
      }
      return updated
    })
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
    if (!Array.isArray(userTrips) || userTrips.length === 0) return null
    return userTrips[0]
  }, [userTrips])

  // Filtered trips for "My Trips" tab
  const filteredTrips = useMemo(() => {
    if (!Array.isArray(userTrips)) return []
    return userTrips.filter(trip => {
      if (!trip) return false
      const destStr = String(trip.destination || '')
      const summaryStr = String(trip.summary || '')
      const q = lower(searchQuery)
      const matchSearch = destStr.toLowerCase().includes(q) || summaryStr.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || trip.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [userTrips, searchQuery, statusFilter])

  // Dynamic currency detected for current destination in form
  const plannerCurrency = useMemo(() => {
    if (customCurrencyCode && CURRENCIES[customCurrencyCode]) {
      return CURRENCIES[customCurrencyCode]
    }
    return detectCurrencyForDestination(dashboardForm.destination, dashboardForm.destinationMetadata)
  }, [dashboardForm.destination, dashboardForm.destinationMetadata, customCurrencyCode])

  // Dynamic currency for currently viewed trip in trip sheet
  const selectedTripCurrency = useMemo(() => {
    if (!selectedTrip?.destination) return detectCurrencyForDestination('USD')
    return detectCurrencyForDestination(selectedTrip.destination)
  }, [selectedTrip?.destination])

  // Helper to format currency values based on current INR/USD currency mode
  const formatLocal = (usd, code) => {
    if (usd === undefined || usd === null || usd === '' || isNaN(Number(usd))) return '—'
    const targetCode = tripSheetCurrencyMode === 'usd'
      ? 'USD'
      : (code || selectedTripCurrency?.code || 'USD')
    return formatCurrencyAmount(usd, targetCode).formattedWithSymbol || '—'
  }

  // Toggle theme strictly between light and dark
  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('tripmind_theme', next)
      document.documentElement.setAttribute('data-theme', next)
    } catch (e) {}
    showToast?.(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} theme`)
  }

  const handleSelectTheme = (selectedTheme) => {
    const validTheme = selectedTheme === 'dark' ? 'dark' : 'light'
    setTheme(validTheme)
    try {
      localStorage.setItem('tripmind_theme', validTheme)
      document.documentElement.setAttribute('data-theme', validTheme)
    } catch (e) {}
    showToast?.(`Switched to ${validTheme === 'dark' ? 'Dark' : 'Light'} theme`)
  }

  // Toggle interest and immediately commit to Neon DB + session (Requirement 4)
  const toggleInterest = async (interest) => {
    const current = dashboardForm.interests || []
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest]

    setDashboardForm(prev => ({
      ...prev,
      interests: updated
    }))

    try {
      const updatedUser = updateUserProfile(currentUser.id, {
        favoriteInterests: updated
      })
      onUserUpdated?.(updatedUser)
      setInterestSavedFeedback(true)
      setTimeout(() => setInterestSavedFeedback(false), 2400)
    } catch (err) {
      console.warn('Live interest commit failed:', err)
    }
  }

  // Avatar file upload from user device
  const handleAvatarFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast?.('Please choose an image under 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result
      setAvatarPreview(dataUrl)
      handleSaveAvatar(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Save Avatar (DP) to database and local session
  const handleSaveAvatar = async (newAvatarUrl) => {
    const urlToSave = newAvatarUrl || avatarPreview || customAvatarInput.trim()
    if (!urlToSave) {
      showToast?.('Please choose or enter an image URL.')
      return
    }
    setAvatarSaving(true)
    try {
      const updatedUser = updateUserProfile(currentUser.id, {
        avatar: urlToSave
      })
      onUserUpdated?.(updatedUser)
      setAvatarPreview(urlToSave)
      setCustomAvatarInput('')
      showToast?.('✨ Profile photo updated and saved to database!')
    } catch (err) {
      console.warn('Avatar update failed:', err)
      showToast?.('Failed to update avatar.')
    } finally {
      setAvatarSaving(false)
    }
  }

  // Set DP back to Name Initials (clears custom photo so initials circle displays)
  const handleUseInitials = async () => {
    setAvatarSaving(true)
    try {
      const updatedUser = updateUserProfile(currentUser.id, {
        avatar: ''
      })
      onUserUpdated?.(updatedUser)
      setAvatarPreview('')
      setCustomAvatarInput('')
      showToast?.(`✨ Display picture set to your name initials (${dynamicInitials})!`)
    } catch (err) {
      console.warn('Failed to reset to initials:', err)
      showToast?.('Could not update profile picture.')
    } finally {
      setAvatarSaving(false)
    }
  }

  // Delete account action in Neon PostgreSQL database (Requirement 2)
  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      await deleteUserAccount(currentUser.id)
      setShowDeleteModal(false)
      showToast?.('Account and trips permanently deleted from database.')
      onLogout()
    } catch (err) {
      console.error('Account deletion error:', err)
      showToast?.('Could not delete account. Please try again.')
      setIsDeletingAccount(false)
    }
  }

  // Abort ongoing generation
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('user_cancel')
    }
    try {
      sessionStorage.removeItem('tripmind_active_job')
    } catch (_) {}
    setActiveJobId(null)
    setPlannerLoading(false)
  }

  // Poll an ongoing background job to completion
  const pollBackgroundJob = async (jobId, formValues, controller, setErrorOnFail = true) => {
    const dest = formValues.destination
    const maxPollDuration = 35000 // 35s maximum before falling back to direct route
    const pollStart = Date.now()
    let consecutiveQueued = 0

    while (Date.now() - pollStart < maxPollDuration) {
      if (controller.signal.aborted) {
        throw new Error('USER_CANCELLED')
      }

      await new Promise(r => setTimeout(r, 1200))

      if (controller.signal.aborted) {
        throw new Error('USER_CANCELLED')
      }

      try {
        const pollRes = await fetch(`/api/jobs/${jobId}`, { signal: controller.signal })
        if (!pollRes.ok) continue
        const jobData = await pollRes.json()

        if (typeof jobData.progress === 'number') {
          setJobProgress(jobData.progress)
        }
        if (jobData.stage) {
          setJobStage(jobData.stage)
          setLiveAnnouncement(jobData.stage)
        }

        if (jobData.status === 'completed' && jobData.result) {
          try {
            sessionStorage.removeItem('tripmind_active_job')
          } catch (_) {}
          setActiveJobId(null)

          const targetUserId = currentUser?.id || 'guest'
          const saved = saveUserTrip(targetUserId, {
            ...jobData.result,
            id: `trip_${Date.now()}`,
            startDate: formValues.startDate,
            status: 'Upcoming',
            formSnapshot: { ...formValues }
          })

          setUserTrips(saved)
          setSelectedTrip(saved[0])
          setShowGuestSavePrompt(true)
          setActiveTab('trips')
          setLiveAnnouncement(`Your itinerary for ${dest} is ready!`)
          showToast?.(`✨ Plan for ${dest} is ready!`)
          return true
        }

        if (jobData.status === 'failed') {
          try {
            sessionStorage.removeItem('tripmind_active_job')
          } catch (_) {}
          setActiveJobId(null)
          if (setErrorOnFail) {
            setPlannerError({
              type: 'ai_error',
              message: jobData.error || 'The AI planner was unable to generate day-by-day activities. Please try again.',
              canRetry: true
            })
            setLiveAnnouncement('Trip planning failed. Please try again.')
          }
          return false
        }

        if (jobData.status === 'queued') {
          consecutiveQueued++
          // If queued for > 8 polls (~10 seconds) without progress, fall through to direct route
          if (consecutiveQueued >= 8) {
            console.log('Background queue idle; transitioning to direct generation route...')
            return false
          }
        } else {
          consecutiveQueued = 0
        }
      } catch (pollErr) {
        if (pollErr.name === 'AbortError' || controller.signal.aborted) {
          throw pollErr
        }
      }
    }

    // Polling window exceeded
    try {
      sessionStorage.removeItem('tripmind_active_job')
    } catch (_) {}
    setActiveJobId(null)
    if (setErrorOnFail) {
      setPlannerError({
        type: 'timeout',
        message: 'Trip planning is taking longer than expected. Your destination and preferences are saved below—click Try again to continue.',
        canRetry: true
      })
      setLiveAnnouncement('Planning took longer than expected.')
    }
    return false
  }

  // Resume an active job from storage on page load
  const handleResumeJob = async (jobId, formValues) => {
    setPlannerLoading(true)
    setPlannerError(null)
    setJobProgress(20)
    setJobStage('Resuming itinerary generation...')
    setActiveJobId(jobId)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await pollBackgroundJob(jobId, formValues, controller)
    } catch (err) {
      if (controller.signal.aborted || err.message === 'USER_CANCELLED') {
        showToast?.('Trip generation was cancelled.')
      }
    } finally {
      setPlannerLoading(false)
      abortControllerRef.current = null
    }
  }

  // Handle generating a new trip directly inside their individual dashboard
  const handleGenerateDashboardTrip = async (e) => {
    e?.preventDefault()

    const dest = (dashboardForm.destination || '').trim()
    if (!dest) {
      setPlannerError({
        type: 'validation',
        message: 'Please enter a destination to begin planning your trip.',
        canRetry: false
      })
      setLiveAnnouncement('Please enter a destination.')
      return
    }

    if (dest.length > 100) {
      setPlannerError({
        type: 'validation',
        message: 'Destination name must be 100 characters or less.',
        canRetry: false
      })
      setLiveAnnouncement('Destination name is too long.')
      return
    }

    setPlannerLoading(true)
    setPlannerError(null)
    setJobProgress(10)
    setJobStage('Connecting to AI travel concierge...')
    setLiveAnnouncement(`Starting itinerary generation for ${dest}...`)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      // 1. Attempt background job execution for fast dispatch & realtime progress
      let jobResponse = null
      try {
        const jobReq = await fetch('/api/jobs/itinerary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dashboardForm),
          signal: controller.signal
        })

        if (jobReq.status === 202) {
          jobResponse = await jobReq.json()
        } else if (jobReq.status === 429) {
          const errData = await jobReq.json().catch(() => ({}))
          setPlannerError({
            type: 'rate_limit',
            message: errData.error || "You've reached the free generation limit for this hour. Please take a break, explore your saved trips, or sign in to continue planning.",
            canRetry: false
          })
          setLiveAnnouncement("Free generation limit reached for this hour.")
          setPlannerLoading(false)
          return
        }
      } catch (jobErr) {
        console.warn('Background job dispatch skipped, trying direct route:', jobErr.message)
      }

      // If job successfully enqueued, poll it with live progress updates
      if (jobResponse && jobResponse.jobId) {
        const jobId = jobResponse.jobId
        setActiveJobId(jobId)
        try {
          sessionStorage.setItem('tripmind_active_job', JSON.stringify({
            jobId,
            form: dashboardForm,
            startedAt: Date.now()
          }))
        } catch (_) {}

        const success = await pollBackgroundJob(jobId, dashboardForm, controller, false)
        if (success) {
          return
        }
        console.log('Background queue unfulfilled; transitioning to direct generation route...')
      }

      // 2. Direct HTTP generation fallback (with coordinated 45-second timeout)
      setJobStage('Curating authentic experiences...')
      const syncTimeoutId = setTimeout(() => {
        try {
          controller.abort('timeout')
        } catch (_) {}
      }, 45000)

      const resp = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardForm),
        signal: controller.signal
      })
      clearTimeout(syncTimeoutId)

      let data = null
      try {
        data = await resp.json()
      } catch (parseErr) {
        throw new Error('MALFORMED_RESPONSE')
      }

      if (!resp.ok) {
        if (resp.status === 429) {
          setPlannerError({
            type: 'rate_limit',
            message: data?.error || "You've reached the free generation limit for this hour. Please take a break, explore your saved trips, or sign in to continue planning.",
            canRetry: false
          })
          setLiveAnnouncement("Free generation limit reached for this hour.")
          return
        }

        if (resp.status === 400) {
          setPlannerError({
            type: 'validation',
            message: data?.error || 'Please check your trip details and try again.',
            canRetry: false
          })
          setLiveAnnouncement(data?.error || 'Invalid trip details.')
          return
        }

        if (resp.status === 502) {
          setPlannerError({
            type: 'ai_error',
            message: data?.error || 'The AI service returned an incomplete response. Please try again.',
            canRetry: true
          })
          setLiveAnnouncement('Incomplete response from AI service.')
          return
        }

        if (resp.status === 503) {
          setPlannerError({
            type: 'ai_error',
            message: data?.error || 'The AI travel concierge is currently experiencing high demand. Please try again in a moment.',
            canRetry: true
          })
          setLiveAnnouncement('AI travel service is currently experiencing high demand.')
          return
        }

        setPlannerError({
          type: 'generic',
          message: data?.error || 'We were unable to generate your itinerary right now. Please try again.',
          canRetry: true
        })
        setLiveAnnouncement('Unable to generate itinerary right now.')
        return
      }

      if (!data || !Array.isArray(data.days) || data.days.length === 0) {
        setPlannerError({
          type: 'ai_error',
          message: 'The AI planner was unable to generate day-by-day activities. Please try again.',
          canRetry: true
        })
        setLiveAnnouncement('Incomplete itinerary received.')
        return
      }

      // Direct generation succeeded!
      const targetUserId = currentUser?.id || 'guest'
      const saved = saveUserTrip(targetUserId, {
        ...data,
        id: `trip_${Date.now()}`,
        startDate: dashboardForm.startDate,
        status: 'Upcoming',
        formSnapshot: { ...dashboardForm }
      })

      setUserTrips(saved)
      setSelectedTrip(saved[0])
      setShowGuestSavePrompt(true)
      setActiveTab('trips')
      setLiveAnnouncement(`Your itinerary for ${dest} is ready!`)
      showToast?.(`✨ Plan for ${dest} is ready!`)

    } catch (err) {
      if (controller.signal.aborted || err.name === 'AbortError' || err === 'timeout' || err.message === 'USER_CANCELLED') {
        if (controller.signal.reason === 'timeout' || err === 'timeout') {
          setPlannerError({
            type: 'timeout',
            message: 'Trip planning took longer than expected. Your destination and preferences are saved below—click Try again to continue.',
            canRetry: true
          })
          setLiveAnnouncement('Trip planning timed out.')
        } else {
          // User clicked Cancel
          setPlannerError(null)
          showToast?.('Trip generation was cancelled.')
          setLiveAnnouncement('Trip generation was cancelled.')
        }
      } else if (err.message === 'MALFORMED_RESPONSE') {
        setPlannerError({
          type: 'ai_error',
          message: 'Received an invalid response format from the travel service. Please try again.',
          canRetry: true
        })
        setLiveAnnouncement('Received invalid response from service.')
      } else {
        console.warn('Network / fetch error:', err)
        setPlannerError({
          type: 'network',
          message: 'Could not connect to the travel planner. Please check your internet connection and try again.',
          canRetry: true
        })
        setLiveAnnouncement('Could not connect to server. Please check your connection.')
      }
    } finally {
      setPlannerLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleRetryGeneration = () => {
    handleGenerateDashboardTrip()
  }

  const handleDeleteTrip = (tripId, e) => {
    e?.stopPropagation()
    if (window.confirm('Are you sure you want to remove this itinerary from your dashboard?')) {
      const targetUserId = currentUser?.id || 'guest'
      const updated = deleteUserTrip(targetUserId, tripId)
      setUserTrips(updated)
      if (selectedTrip?.id === tripId) {
        setSelectedTrip(null)
      }
      showToast?.('Itinerary removed from your dashboard.')
    }
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    if (!currentUser) {
      onNavigateLogin?.()
      return
    }
    if (!profileName.trim()) {
      showToast?.('Please enter your display name.')
      return
    }
    const updated = updateUserProfile(currentUser.id, {
      name: profileName.trim(),
      travelVibe: profileVibe,
      defaultBudget: profileBudget,
      defaultTravelers: Number(profileTravelers)
    })
    onUserUpdated?.(updated)
    showToast?.('✨ Travel profile preferences saved to database!')
  }

  const copyTripMarkdown = (trip) => {
    let text = `# ${trip.destination} Itinerary (${trip.days?.length || 4} Days)\n`
    text += `*Planned for ${currentUser?.name || 'Curious Traveler'} · Status: ${trip.status}*\n\n`
    if (trip.summary) text += `${trip.summary}\n\n`
    if (trip.travelTip) text += `> Travel Tip: ${trip.travelTip}\n\n`
    trip.days?.forEach((d) => {
      text += `## Day ${d.day}: ${d.title}\n`
      d.activities?.forEach(act => {
        text += `- **${act.time}** - ${act.title} (${act.category}) [Est. $${act.cost}]\n  ${act.description}\n`
      })
      text += '\n'
    })
    text += `\n*Prices, timings, and availability are AI-generated estimates. Please verify before booking.*\n`
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
              <img src="/tripmind-icon.svg?v=3" alt="Planora" />
            </span>
            <span>
              planora
            </span>
          </button>
          <span className="dashboard-tag">Personal Workspace</span>
        </div>

        <div className="dashboard-top-actions">
          <button
            type="button"
            className="theme-quick-toggle-btn"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {currentUser ? (
            <>
              <div
                className="user-profile-badge"
                onClick={() => setActiveTab('profile')}
                style={{ cursor: 'pointer' }}
                title="Manage DP, name, theme & settings"
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="user-badge-avatar"
                  />
                ) : (
                  <span className="user-badge-initials">{dynamicInitials || currentUser.initials || 'U'}</span>
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
            </>
          ) : (
            <button
              type="button"
              className="button button-dark"
              onClick={onNavigateLogin}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <LogIn size={15} />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <div className="dashboard-hero-banner section-container">
        <div className="dashboard-welcome">
          <div className="dashboard-eyebrow">
            <Sparkles size={14} /> INDIVIDUAL TRAVEL CONCIERGE
          </div>
          <h1>
            {currentUser ? (
              <>Welcome back, <span>{currentUser.name}</span>.</>
            ) : (
              <>Your trip, <span>thoughtfully planned</span>.</>
            )}
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
          <Sparkles size={17} />
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
          <Settings size={17} />
          <span>Account & Settings</span>
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
                  <FolderHeart size={44} className="empty-state-icon" aria-hidden="true" />
                  <h3>No trips saved in your dashboard yet</h3>
                  <p>Ready for your next journey? Plan an itinerary and keep it organized right here.</p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => setActiveTab('planner')}
                    >
                      <span>Plan Your First Trip</span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setJoinByLinkOpen(true)}
                      title="Paste an invite link to join a group trip"
                    >
                      <Link2 size={15} />
                      <span>Join with link</span>
                    </button>
                  </div>
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
                      aria-pressed={dashboardForm.destination === item.name}
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
                    <label className="field-label" htmlFor="quick-planner-dest">Destination</label>
                    <DestinationAutocomplete
                      id="quick-planner-dest"
                      value={dashboardForm.destination}
                      onChange={(val) => setDashboardForm(p => ({ ...p, destination: val, destinationMetadata: null }))}
                      onSelect={(item) => setDashboardForm(p => ({ ...p, destination: item.label, destinationMetadata: item }))}
                      placeholder="e.g. Bergen, Norway or Kyoto"
                      required
                    />
                    {dashboardForm.destination.trim() && plannerCurrency && (
                      <div className="currency-detector-pill" style={{ marginTop: '8px' }}>
                        <Globe size={13} />
                        {plannerCurrency.isUnknown ? (
                          <span className="currency-unconfirmed-label">
                            Currency: <em>Unconfirmed</em> · Defaults to <strong>USD ($)</strong>
                          </span>
                        ) : (
                          <span>Currency: <strong>{plannerCurrency.flag} {plannerCurrency.code} ({plannerCurrency.symbol})</strong></span>
                        )}
                        {(() => {
                          const rate = plannerCurrency.rateFromUsd ?? plannerCurrency.rateToUsd ?? 1;
                          return (
                            <span className="currency-rate-hint">
                              1 USD ≈ {rate >= 10 ? Math.round(rate).toLocaleString() : Number(rate).toFixed(2)} {plannerCurrency.code}
                            </span>
                          );
                        })()}
                        <select
                          className="currency-select-inline"
                          aria-label="Select currency override"
                          value={customCurrencyCode || plannerCurrency.code}
                          onChange={(e) => setCustomCurrencyCode(e.target.value)}
                        >
                          {Object.keys(CURRENCIES).map(code => (
                            <option key={code} value={code}>
                              {CURRENCIES[code].flag} {code} ({CURRENCIES[code].symbol})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label className="field-label" htmlFor="quick-planner-duration">Duration</label>
                      <div className="select-wrap">
                        <select
                          id="quick-planner-duration"
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
                      <label className="field-label" htmlFor="quick-planner-budget">Budget</label>
                      <div className="select-wrap">
                        <select
                          id="quick-planner-budget"
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

                  <div className="quick-planner-actions">
                    <button
                      type="submit"
                      className="button button-dark full-width"
                      disabled={plannerLoading}
                    >
                      {plannerLoading ? (
                        <>
                          <span className="spinner-dot" aria-hidden="true" />
                          <span>Curating Itinerary...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Generate &amp; Save to Dashboard</span>
                        </>
                      )}
                    </button>
                    {plannerLoading && (
                      <button
                        type="button"
                        className="button button-secondary-outline full-width cancel-btn"
                        onClick={handleCancelGeneration}
                        style={{ marginTop: '8px' }}
                        aria-label="Cancel trip generation"
                      >
                        <X size={15} />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Recent Saved Itineraries Mini List */}
              <div className="recent-trips-card">
                <div className="recent-header">
                  <h4>My Recent Plans</h4>
                  <button
                    type="button"
                    className="ghost-text-btn"
                    onClick={() => setActiveTab('trips')}
                    disabled={userTrips.length === 0}
                    aria-label={userTrips.length === 0 ? "No saved plans" : `View all ${userTrips.length} saved plans`}
                  >
                    {userTrips.length === 0 ? 'View all' : `View all (${userTrips.length})`}
                  </button>
                </div>

                {userTrips.length === 0 ? (
                  <p className="no-trips-hint">No trips created yet.</p>
                ) : (
                  <div className="recent-list">
                    {userTrips.slice(0, 3).map(trip => (
                      <button
                        key={trip.id}
                        type="button"
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
                        <ChevronRight size={16} color="#7e9b7a" aria-hidden="true" />
                      </button>
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
                Tell us where you want to go. Planora crafts an unhurried, day-by-day plan
                with neighborhood spots, estimated costs, and morning coffee recommendations.
              </p>
            </div>

            <div className="planner-card studio-card">
              <form onSubmit={handleGenerateDashboardTrip}>
                {plannerError && (
                  <div className="planner-error-box" role="alert">
                    <div className="error-icon-col">
                      {plannerError.type === 'rate_limit' ? (
                        <Clock size={20} className="error-icon rate-limit" />
                      ) : (
                        <AlertCircle size={20} className="error-icon" />
                      )}
                    </div>
                    <div className="error-body-col">
                      <strong>
                        {plannerError.type === 'rate_limit' && 'Hourly Free Limit Reached'}
                        {plannerError.type === 'timeout' && 'Trip Planning Timed Out'}
                        {plannerError.type === 'network' && 'Network Connection Issue'}
                        {plannerError.type === 'ai_error' && 'AI Service Busy'}
                        {plannerError.type === 'validation' && 'Check Your Details'}
                        {(!plannerError.type || plannerError.type === 'generic') && 'Something went wrong'}
                      </strong>
                      <p>{plannerError.message || plannerError}</p>
                      <div className="error-actions">
                        {plannerError.canRetry && (
                          <button
                            type="button"
                            className="button button-dark btn-sm retry-btn"
                            onClick={handleRetryGeneration}
                          >
                            <RefreshCw size={14} />
                            <span>Try again</span>
                          </button>
                        )}
                        {plannerError.type === 'rate_limit' && !currentUser && (
                          <button
                            type="button"
                            className="button button-dark btn-sm"
                            onClick={onNavigateLogin}
                          >
                            <LogIn size={14} />
                            <span>Sign In for Unlimited Trips</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="field">
                  <label className="field-label" htmlFor="planner-studio-dest">Where do you want to explore?</label>
                  <DestinationAutocomplete
                    id="planner-studio-dest"
                    value={dashboardForm.destination}
                    onChange={(val) => setDashboardForm(p => ({ ...p, destination: val, destinationMetadata: null }))}
                    onSelect={(item) => setDashboardForm(p => ({ ...p, destination: item.label, destinationMetadata: item }))}
                    placeholder="e.g. Kyoto, Japan or Florence, Italy"
                    required
                  />
                  {dashboardForm.destination.trim() && plannerCurrency && (
                    <div className="currency-detector-pill" style={{ marginTop: '10px' }}>
                      <Globe size={14} />
                      {plannerCurrency.isUnknown ? (
                        <span>
                          Local Currency: <span className="currency-unconfirmed-tag">Unconfirmed</span> · Defaulting to <strong>{plannerCurrency.code} ({plannerCurrency.symbol})</strong>
                        </span>
                      ) : (
                        <span>
                          Local Currency: <strong>{plannerCurrency.flag} {plannerCurrency.code} ({plannerCurrency.symbol})</strong> · {plannerCurrency.name}
                        </span>
                      )}
                      {(() => {
                        const rate = plannerCurrency.rateFromUsd ?? plannerCurrency.rateToUsd ?? 1;
                        return (
                          <span className="currency-rate-hint">
                            1 USD ≈ {rate >= 10 ? Math.round(rate).toLocaleString() : Number(rate).toFixed(2)} {plannerCurrency.code}
                          </span>
                        );
                      })()}
                      <select
                        className="currency-select-inline"
                        aria-label="Change currency override"
                        title="Change local currency"
                        value={customCurrencyCode || plannerCurrency.code}
                        onChange={(e) => setCustomCurrencyCode(e.target.value)}
                      >
                        {Object.keys(CURRENCIES).map(code => (
                          <option key={code} value={code}>
                            {CURRENCIES[code].flag} {code} ({CURRENCIES[code].symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="field">
                    <label className="field-label" htmlFor="planner-studio-start">Target Start Date (Optional)</label>
                    <div className="input-wrap">
                      <CalendarDays size={18} />
                      <input
                        id="planner-studio-start"
                        type="date"
                        value={dashboardForm.startDate}
                        onChange={(e) =>
                          setDashboardForm(p => ({ ...p, startDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="planner-studio-days">Trip Length (Days)</label>
                    <div className="select-wrap">
                      <select
                        id="planner-studio-days"
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
                    <label className="field-label" htmlFor="planner-studio-budget">Budget Pacing</label>
                    <div className="select-wrap">
                      <select
                        id="planner-studio-budget"
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
                    <label className="field-label" htmlFor="planner-studio-travelers">Travelers</label>
                    <div className="select-wrap">
                      <select
                        id="planner-studio-travelers"
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
                  <div className="interest-header-row">
                    <label className="field-label">Select your travel interests:</label>
                    {interestSavedFeedback && (
                      <span className="interests-saved-badge">
                        <Check size={12} /> Saved to profile in database!
                      </span>
                    )}
                  </div>
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
                          aria-pressed={active}
                          onClick={() => toggleInterest(interest)}
                        >
                          {active && <Check size={14} aria-hidden="true" />}
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
                      <>
                        <span className="spinner-dot" aria-hidden="true" />
                        <span>Curating Itinerary...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        <span>Generate Itinerary &amp; Save to Dashboard</span>
                      </>
                    )}
                  </button>

                  {plannerLoading && (
                    <button
                      type="button"
                      className="button button-secondary-outline cancel-btn"
                      onClick={handleCancelGeneration}
                      aria-label="Cancel trip generation"
                    >
                      <X size={15} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </form>

              {/* Screen reader live announcements */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {plannerLoading ? LOADING_MESSAGES[loadingMsgIndex] : liveAnnouncement}
              </div>

              {/* Loading Skeleton View with Progressive Status */}
              {plannerLoading && (
                <div className="planner-skeleton-container" aria-hidden="true">
                  <div className="planner-loading-status-bar">
                    <div className="loading-status-spinner" />
                    <div className="loading-status-text">
                      <div className="status-badge-row">
                        <span className="status-badge">AI Concierge at work</span>
                        {jobProgress > 0 && <span className="progress-pct-badge">{jobProgress}%</span>}
                      </div>
                      <p className="status-message">{jobStage || LOADING_MESSAGES[loadingMsgIndex]}</p>
                      {jobProgress > 0 && (
                        <div className="planner-progress-track">
                          <div className="planner-progress-fill" style={{ width: `${jobProgress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="skeleton-trip-card">
                    <div className="skeleton-header">
                      <div className="skeleton-line skeleton-tag" />
                      <div className="skeleton-line skeleton-title" />
                      <div className="skeleton-line skeleton-p1" />
                      <div className="skeleton-line skeleton-p2" />
                    </div>

                    <div className="skeleton-budget-strip">
                      <div className="skeleton-line skeleton-pill" />
                      <div className="skeleton-line skeleton-pill" />
                      <div className="skeleton-line skeleton-pill" />
                    </div>

                    <div className="skeleton-days-grid">
                      {[1, 2, 3].map(d => (
                        <div key={d} className="skeleton-day-card">
                          <div className="skeleton-line skeleton-day-title" />
                          <div className="skeleton-slot">
                            <div className="skeleton-line skeleton-time" />
                            <div className="skeleton-line skeleton-desc" />
                          </div>
                          <div className="skeleton-slot">
                            <div className="skeleton-line skeleton-time" />
                            <div className="skeleton-line skeleton-desc" />
                          </div>
                          <div className="skeleton-slot">
                            <div className="skeleton-line skeleton-time" />
                            <div className="skeleton-line skeleton-desc" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
                <label htmlFor="saved-trips-search" className="sr-only">
                  Search saved itineraries
                </label>
                <input
                  id="saved-trips-search"
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
                    aria-pressed={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All Trips' : status}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setJoinByLinkOpen(true)}
                  title="Paste an invite link to join a group trip"
                >
                  <Link2 size={15} />
                  <span>Join with link</span>
                </button>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => setActiveTab('planner')}
                >
                  <Plus size={16} />
                  <span>New Trip</span>
                </button>
              </div>
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
                    <div className="workspace-secondary-group trip-actions-group">
                      <button
                        type="button"
                        className={`button ${tripViewTab === 'chat' ? 'button-dark' : 'button-secondary'}`}
                        onClick={() => setTripViewTab(tripViewTab === 'chat' ? 'itinerary' : 'chat')}
                        title="Chat with your itinerary using AI"
                      >
                        <MessageSquare size={15} />
                        <span>{tripViewTab === 'chat' ? 'View Itinerary' : 'Chat with Trip'}</span>
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={handleOpenShare}
                        title="Create or manage public share link"
                      >
                        <Share2 size={15} />
                        <span>Share</span>
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setGroupModalOpen(true)}
                        title="Invite travelers and collaborate on this group trip"
                      >
                        <Users size={15} />
                        <span>Group Trip</span>
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setCalendarSyncOpen(true)}
                        title="Add to Google Calendar or export .ics"
                      >
                        <Calendar size={15} />
                        <span>Add to calendar</span>
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={handlePrint}
                        title="Print PDF of itinerary"
                      >
                        <Printer size={15} />
                        <span>Print PDF</span>
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => copyTripMarkdown(selectedTrip)}
                        title="Copy itinerary as Markdown"
                      >
                        <Download size={15} />
                        <span>Copy Markdown</span>
                      </button>
                    </div>
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
                      aria-label="Delete this itinerary"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Non-blocking dismissible prompt for visitors trying TripMind without logging in */}
                {!currentUser && showGuestSavePrompt && (
                  <div className="guest-save-banner" role="region" aria-label="Save your trip">
                    <div className="guest-save-content">
                      <Sparkles size={18} className="guest-save-icon" />
                      <div>
                        <strong>Sign in to save this trip</strong>
                        <p>Save this itinerary permanently to your dashboard, customize activities, and access it anytime from any device.</p>
                      </div>
                    </div>
                    <div className="guest-save-actions">
                      <button
                        type="button"
                        className="button button-dark btn-sm"
                        onClick={onNavigateLogin}
                      >
                        <span>Sign In to Save</span>
                        <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        className="guest-save-dismiss"
                        onClick={() => setShowGuestSavePrompt(false)}
                        aria-label="Dismiss save notice"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Conflict Notice if Updated by Another Member */}
                {conflictNotice && (
                  <div className="trip-conflict-banner" role="alert">
                    <AlertCircle size={16} />
                    <span>This itinerary was recently updated by a travel companion.</span>
                    <button
                      type="button"
                      className="button button-dark btn-sm"
                      onClick={async () => {
                        const collab = await fetchTripCollaboration(selectedTrip.id, currentUser?.token)
                        if (collab?.trip) {
                          setSelectedTrip(collab.trip)
                          setConflictNotice(false)
                          showToast?.('Itinerary reloaded with latest group changes! ✨')
                        }
                      }}
                    >
                      <span>Reload latest plan</span>
                    </button>
                  </div>
                )}

                {/* Itinerary Preview in Dashboard */}
                <div className="trip-sheet-card">
                  <div className="trip-sheet-top">
                    <span className="destination-tag">
                      {upper(selectedTrip?.destination, 'TRIP')} · {upper(selectedTrip?.status, 'SAVED')}
                    </span>
                    <h2>{selectedTrip?.destination || 'Curated Itinerary'}</h2>
                    <p className="trip-sheet-summary">{selectedTrip?.summary || ''}</p>
                    {selectedTrip.travelTip && (
                      <div className="trip-sheet-tip">
                        <strong>✳ Local Secret:</strong> {selectedTrip.travelTip}
                      </div>
                    )}
                    <div className="trip-sheet-disclaimer" role="note" aria-label="AI Disclaimer">
                      <AlertCircle size={15} aria-hidden="true" />
                      <span>Prices, timings, and availability are AI-generated estimates. Please verify before booking.</span>
                    </div>
                  </div>

                  {/* Phase 3: Trip Countdown Card */}
                  <CountdownCard
                    trip={selectedTrip}
                    onOpenChecklist={() => setTripViewTab('checklist')}
                  />

                  {/* Phase 3: Destination Weather Widget (Open-Meteo) */}
                  <WeatherWidget
                    destination={selectedTrip.destination}
                    startDate={selectedTrip.startDate}
                    coordinates={selectedTrip.coordinates}
                  />

                  {/* Budget breakdown mini banner */}
                  {selectedTrip.budgetBreakdown && (
                    <div className="budget-summary-strip">
                      <div className="budget-currency-row">
                        <div className="budget-currency-detected">
                          <Globe size={14} aria-hidden="true" />
                          <span>Destination Currency: <strong>{selectedTripCurrency.flag} {selectedTripCurrency.code} ({selectedTripCurrency.symbol})</strong></span>
                        </div>
                        <div className="currency-toggle-wrapper">
                          <button
                            type="button"
                            className={`currency-toggle-btn ${tripSheetCurrencyMode === 'local' ? 'active' : ''}`}
                            aria-pressed={tripSheetCurrencyMode === 'local'}
                            onClick={() => setTripSheetCurrencyMode('local')}
                            title={`Display amounts in ${selectedTripCurrency.name}`}
                          >
                            {selectedTripCurrency.flag} {selectedTripCurrency.code} ({selectedTripCurrency.symbol})
                          </button>
                          <button
                            type="button"
                            className={`currency-toggle-btn ${tripSheetCurrencyMode === 'usd' ? 'active' : ''}`}
                            aria-pressed={tripSheetCurrencyMode === 'usd'}
                            onClick={() => setTripSheetCurrencyMode('usd')}
                            title="Display amounts in USD"
                          >
                            💵 USD ($)
                          </button>
                          <button
                            type="button"
                            className="currency-calc-trigger-btn"
                            onClick={() => setCurrencyCalcOpen(true)}
                            title="Open live currency converter"
                          >
                            <Calculator size={13} />
                            <span>Convert</span>
                          </button>
                          <span className="currency-updated-hint">Rates updated {ratesUpdated}</span>
                        </div>
                      </div>

                      <div className="budget-strip-item">
                        <small>Total Estimated ({tripSheetCurrencyMode === 'local' ? selectedTripCurrency.code : 'USD'})</small>
                        <strong>
                          {tripSheetCurrencyMode === 'local' && selectedTripCurrency.code !== 'USD'
                            ? `${formatLocal(selectedTrip.budgetBreakdown?.totalEstimatedUsd, selectedTripCurrency.code)} ${selectedTripCurrency.code} (~$${(selectedTrip.budgetBreakdown?.totalEstimatedUsd || 0).toLocaleString()} USD)`
                            : `${formatLocal(selectedTrip.budgetBreakdown?.totalEstimatedUsd, 'USD')} USD`
                          }
                        </strong>
                      </div>
                      <div className="budget-strip-item">
                        <small>Daily per person</small>
                        <strong>
                          {tripSheetCurrencyMode === 'local' && selectedTripCurrency.code !== 'USD'
                            ? `${formatLocal(selectedTrip.budgetBreakdown?.dailyPerPersonUsd, selectedTripCurrency.code)} / day`
                            : `${formatLocal(selectedTrip.budgetBreakdown?.dailyPerPersonUsd, 'USD')} / day`
                          }
                        </strong>
                      </div>
                      {selectedTrip.budgetBreakdown?.categories && (
                        <div className="budget-strip-breakdown">
                          <span>
                            🏨 Stay: {formatLocal(selectedTrip.budgetBreakdown.categories.accommodation)}
                          </span>
                          <span>
                            🍽 Food: {formatLocal(selectedTrip.budgetBreakdown.categories.dining)}
                          </span>
                          <span>
                            🎟 Activities: {formatLocal(selectedTrip.budgetBreakdown.categories.activities)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Trip View Tabs: Today Companion vs Itinerary vs Map View vs Real Budget */}
                  <div className="trip-view-segmented-tabs print-hide">
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'today' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('today')}
                    >
                      <Compass size={15} />
                      <span>Today's Live</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'itinerary' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('itinerary')}
                    >
                      <Clock size={15} />
                      <span>Itinerary</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'map' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('map')}
                    >
                      <Map size={15} />
                      <span>Map View</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'budget' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('budget')}
                    >
                      <Wallet size={15} />
                      <span>Budget</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'chat' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('chat')}
                    >
                      <MessageSquare size={15} />
                      <span>AI Assistant</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'checklist' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('checklist')}
                    >
                      <CheckSquare size={15} />
                      <span>Checklist</span>
                    </button>
                    <button
                      type="button"
                      className={`trip-seg-btn ${tripViewTab === 'reviews' ? 'active' : ''}`}
                      onClick={() => setTripViewTab('reviews')}
                    >
                      <Star size={15} />
                      <span>Reviews & Photos</span>
                    </button>
                  </div>

                  {tripViewTab === 'today' ? (
                    <TodayCompanionView
                      trip={selectedTrip}
                      checkedActivities={checkedActivities}
                      onToggleActivity={toggleActivity}
                      onQuickLogExpense={(prefill) => {
                        handleAddExpense({
                          amount: prefill.amount || 15,
                          currency: selectedTripCurrency?.code || 'USD',
                          category: prefill.category || 'activities',
                          note: prefill.note || 'Activity expense',
                          date: selectedTrip?.startDate || new Date().toISOString().split('T')[0],
                          paidBy: tripTravelers[0] || 'You',
                          splitBetween: tripTravelers,
                          splitType: 'equal'
                        })
                      }}
                      onAskAssistant={(prompt) => {
                        setChatInitialPrompt(prompt)
                        setTripViewTab('chat')
                        showToast?.('Switched to AI Assistant with context! ✨')
                      }}
                      formatLocal={formatLocal}
                      tripSheetCurrencyMode={tripSheetCurrencyMode}
                      selectedTripCurrency={selectedTripCurrency}
                    />
                  ) : tripViewTab === 'checklist' ? (
                    <ChecklistView
                      trip={selectedTrip}
                      currentUser={currentUser}
                      showToast={showToast}
                    />
                  ) : tripViewTab === 'chat' ? (
                    <TripChatPanel
                      trip={selectedTrip}
                      currentUser={currentUser}
                      onTripUpdated={handleTripUpdatedByAssistant}
                      formatLocal={formatLocal}
                      showToast={showToast}
                      initialMessage={chatInitialPrompt}
                      onClearInitialMessage={() => setChatInitialPrompt('')}
                    />
                  ) : tripViewTab === 'map' ? (
                    <Suspense fallback={<div className="map-loading-placeholder"><div className="spinner-dot" /><span>Loading map...</span></div>}>
                      <MapView
                        trip={selectedTrip}
                        selectedCurrencyMode={tripSheetCurrencyMode}
                        selectedTripCurrency={selectedTripCurrency}
                        formatLocal={formatLocal}
                      />
                    </Suspense>
                  ) : tripViewTab === 'budget' ? (
                    <BudgetView
                      trip={selectedTrip}
                      expenses={tripExpenses}
                      travelers={tripTravelers}
                      selectedCurrencyMode={tripSheetCurrencyMode}
                      selectedTripCurrency={selectedTripCurrency}
                      formatLocal={formatLocal}
                      onAddExpense={handleAddExpense}
                      onUpdateExpense={handleUpdateExpense}
                      onDeleteExpense={handleDeleteExpense}
                      onUpdateTravelers={handleUpdateTravelers}
                    />
                  ) : tripViewTab === 'reviews' ? (
                    <TripReviewsView
                      trip={selectedTrip}
                      currentUser={currentUser}
                    />
                  ) : (
                    /* Day-by-Day Accordion */
                    <div className="trip-days-list">
                      {(selectedTrip?.days ?? []).map(d => (
                        <div key={d.day} className="dashboard-day-card">
                          <div className="day-card-header">
                            <span className="day-badge">Day 0{d.day}</span>
                            <h4>{d.title}</h4>
                          </div>

                          {/* Phase 4: Group Activity Proposals */}
                          <ActivityProposalsList
                            proposals={selectedTrip?.activityProposals || []}
                            dayNum={d.day}
                            isOwner={selectedTrip?.userMemberRole === 'owner' || selectedTrip?.userId === currentUser?.id}
                            confirmThreshold={selectedTrip?.confirmThreshold || 'owner'}
                            totalMembers={(selectedTrip?.travelers || []).length || 1}
                            onConfirm={handleConfirmProposal}
                            onDismiss={handleDismissProposal}
                            onOpenPropose={() => {
                              setProposeDayNum(d.day)
                              setProposeModalOpen(true)
                            }}
                          />

                          <div className="day-activities-grid">
                            {(d?.activities ?? []).map((act, actIdx) => {
                              const IconComponent = getCategoryIcon(act.category)
                              const actKey = `${selectedTrip?.id || selectedTrip?.destination || 'trip'}_d${d.day}_${actIdx}`
                              const isChecked = Boolean(checkedActivities[actKey])
                              return (
                                <div
                                  key={actIdx}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={isChecked}
                                  className={`day-activity-row ${isChecked ? 'completed' : ''}`}
                                  onClick={() => toggleActivity(actKey)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      toggleActivity(actKey)
                                    }
                                  }}
                                  style={{ cursor: 'pointer' }}
                                  title={isChecked ? 'Mark activity as pending' : 'Mark activity as completed'}
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
                                    {/* Phase 4: Group Activity Voting & Comments */}
                                    <ActivityCollaboration
                                      tripId={selectedTrip.id}
                                      activityKey={actKey}
                                      votes={selectedTrip.activityVotes?.[actKey] || { up: [], down: [] }}
                                      comments={selectedTrip.activityComments || []}
                                      currentUser={currentUser}
                                      onVote={handleActivityVote}
                                      onAddComment={handleActivityComment}
                                      onDeleteComment={handleDeleteActivityComment}
                                    />
                                  </div>
                                  {act.cost !== undefined && (
                                    <div className="activity-cost-tag">
                                      {act.cost === 0
                                        ? 'Free'
                                        : tripSheetCurrencyMode === 'local' && selectedTripCurrency.code !== 'USD'
                                          ? `${formatLocal(act.cost, selectedTripCurrency.code)} (~$${act.cost})`
                                          : formatLocal(act.cost, 'USD')
                                      }
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
                  )}
                </div>
              </div>
            ) : (
              /* Grid of All Saved Trips */
              <div className="trips-cards-grid">
                {filteredTrips.length === 0 ? (
                  <div className="empty-trips-state">
                    <FolderHeart size={44} className="empty-state-icon" aria-hidden="true" />
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
                      role="button"
                      tabIndex={0}
                      className="user-trip-card"
                      onClick={() => setSelectedTrip(trip)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          setSelectedTrip(trip)
                        }
                      }}
                    >
                      <div className="trip-card-header">
                        <span className="trip-status-chip">{trip.status || 'Upcoming'}</span>
                        {(() => {
                          const cd = calculateTripCountdown(trip.startDate, new Date(), trip.days?.length || 1);
                          return cd.hasDate && cd.status !== 'completed' ? (
                            <span className={`trip-countdown-pill ${cd.status}`}>
                              <Clock size={11} aria-hidden="true" />
                              <span>{cd.badgeText}</span>
                            </span>
                          ) : null;
                        })()}
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

        {/* TAB 4: ACCOUNT & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="settings-workspace-layout">
            <div className="settings-header-banner">
              <div className="eyebrow">
                <Settings size={14} /> ACCOUNT & WORKSPACE
              </div>
              <h2>Personal Account & Settings</h2>
              <p>
                Manage your profile picture, display name, visual theme, and account settings.
                All changes are saved to your account in the database.
              </p>
            </div>

            {!currentUser ? (
              <div className="settings-card" style={{ maxWidth: '540px', margin: '30px auto', textAlign: 'center', padding: '40px 30px' }}>
                <Sparkles size={32} style={{ color: 'var(--green)', margin: '0 auto 16px' }} />
                <h3 style={{ marginBottom: '10px' }}>Save your trips &amp; preferences</h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                  Sign in or create a free account to personalize your profile, set default travel styles, and sync all your itineraries across devices.
                </p>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={onNavigateLogin}
                  style={{ display: 'inline-flex', margin: '0 auto' }}
                >
                  <LogIn size={16} />
                  <span>Sign In or Register</span>
                </button>
              </div>
            ) : (
              <div className="settings-grid-layout">
              {/* LEFT COLUMN: Identity & DP, Danger Zone */}
              <div className="settings-col-left">
                {/* 1. DP & Identity Card */}
                <div className="settings-card dp-identity-card">
                  <div
                    className="dp-initials-circle"
                    title={avatarPreview ? 'Custom Profile Photo' : `Name Initials: ${dynamicInitials}`}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt={`${currentUser?.name || 'User'}'s profile picture`} onError={() => setAvatarPreview('')} />
                    ) : (
                      <span>{dynamicInitials}</span>
                    )}
                  </div>

                  <h3 className="dp-name-headline">{profileName || currentUser.name}</h3>
                  <p className="dp-email-sub">{currentUser.email}</p>
                  <span className="dp-badge-tag">
                    {currentUser.authProvider === 'google' ? 'Google Account' : 'Email Account'}
                  </span>

                  <div className="dp-controls-group">
                    <label className="dp-upload-btn">
                      <Upload size={14} />
                      <span>Upload Custom Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        aria-label="Upload custom profile photo"
                        onChange={handleAvatarFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {avatarPreview ? (
                      <button
                        type="button"
                        className="dp-reset-btn"
                        onClick={handleUseInitials}
                        title="Reset to name initials badge"
                      >
                        <RefreshCw size={13} />
                        <span>Use Name Initials ({dynamicInitials})</span>
                      </button>
                    ) : null}

                    <div className="dp-url-input-wrap">
                      <label htmlFor="settings-avatar-url" className="sr-only">
                        Avatar image URL
                      </label>
                      <input
                        id="settings-avatar-url"
                        type="url"
                        placeholder="Or paste photo link (https://...)"
                        value={customAvatarInput}
                        onChange={(e) => setCustomAvatarInput(e.target.value)}
                      />
                      {customAvatarInput.trim() && (
                        <button
                          type="button"
                          className="button button-dark"
                          onClick={() => handleSaveAvatar(customAvatarInput.trim())}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Danger Zone Card */}
                <div className="settings-card danger-zone-card">
                  <div className="settings-card-header">
                    <h3>
                      <AlertTriangle size={18} color="#dc3545" />
                      <span>Danger Zone</span>
                    </h3>
                    <p>Irreversible account deletion.</p>
                  </div>
                  <div className="danger-action-row">
                    <div className="danger-copy">
                      <p>
                        Permanently delete your account and all saved itineraries from the Neon PostgreSQL database.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="delete-account-btn"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 size={15} />
                      <span>Delete Account & Trips</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Profile Name, Preferences & Theme */}
              <div className="settings-col-right">
                {/* 3. Name & Preferences Card */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <h3>Profile & Traveler Persona</h3>
                    <p>Update your full name and journey preferences.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="profile-form">
                    <div className="field">
                      <label className="field-label" htmlFor="settings-fullname">Full Name</label>
                      <div className="input-wrap">
                        <input
                          id="settings-fullname"
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="e.g. Sai Reddy"
                          required
                        />
                      </div>
                      <small style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '5px', display: 'block' }}>
                        Your initials badge displays: <strong>{dynamicInitials}</strong> (first letter of name & surname)
                      </small>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="settings-vibe">Traveler Persona & Rhythm</label>
                      <div className="select-wrap">
                        <select
                          id="settings-vibe"
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
                        <label className="field-label" htmlFor="settings-budget">Default Budget Level</label>
                        <div className="select-wrap">
                          <select
                            id="settings-budget"
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
                        <label className="field-label" htmlFor="settings-travelers">Default Traveling Party</label>
                        <div className="select-wrap">
                          <select
                            id="settings-travelers"
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
                        <span>Save Profile Changes to Database</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 4. Trip Countdown & Email Reminders Card */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bell size={18} color="var(--primary)" aria-hidden="true" />
                      <h3 style={{ margin: 0 }}>Trip Countdown & Reminders</h3>
                    </div>
                    <p>Configure automated countdown milestone notifications and optional email reminders.</p>
                  </div>

                  <form onSubmit={handleSaveReminderSettings} className="reminders-settings-form">
                    <div className="field">
                      <label className="field-label">Countdown Notification Milestones</label>
                      <span className="field-hint" style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                        Planora will alert you as your departure date approaches:
                      </span>
                      <div className="reminder-checkboxes-row">
                        {[
                          { days: 7, label: '7 days before departure' },
                          { days: 3, label: '3 days before departure' },
                          { days: 1, label: '1 day before departure (Eve)' }
                        ].map(({ days, label }) => {
                          const isChecked = reminderDays.includes(days)
                          return (
                            <label key={days} className="reminder-checkbox-label">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleReminderThreshold(days)}
                              />
                              <span>{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div className="field" style={{ marginTop: '16px' }}>
                      <label className="field-label">Email Reminders (via Resend)</label>
                      <label className="email-reminders-toggle-row">
                        <input
                          type="checkbox"
                          checked={emailRemindersEnabled}
                          onChange={(e) => setEmailRemindersEnabled(e.target.checked)}
                        />
                        <span>Send countdown reminder emails to <strong>{currentUser?.email || 'your account email'}</strong></span>
                      </label>
                      <div className="settings-resend-note">
                        <small>
                          ✳ <strong>Opt-in Note:</strong> In-app notifications are always active. Email reminders are strictly opt-in and include an instant unsubscribe link. Note: Emailing users other than the verified account address in Resend requires a verified sending domain. Planora automatically falls back to in-app notifications if email dispatch is unavailable.
                        </small>
                      </div>
                    </div>

                    <div className="profile-save-row" style={{ marginTop: '16px' }}>
                      <button type="submit" className="button button-dark" disabled={savingReminders}>
                        <span>{savingReminders ? 'Saving...' : 'Save Reminder Preferences'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 5. Theme Selection Card */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <h3>Workspace Aesthetic</h3>
                    <p>Choose your workspace theme. Strictly Light (default natural paper) and Dark (high-contrast emerald obsidian).</p>
                  </div>

                  <div className="theme-options-grid">
                    <button
                      type="button"
                      className={`theme-card-option ${theme === 'light' ? 'active' : ''}`}
                      aria-pressed={theme === 'light'}
                      onClick={() => handleSelectTheme('light')}
                    >
                      <div className="theme-card-header">
                        <div className="theme-card-title">
                          <Sun size={18} color="#244a3a" aria-hidden="true" />
                          <span>Light Mode</span>
                        </div>
                        <div className="theme-check-circle">
                          {theme === 'light' && <Check size={12} aria-hidden="true" />}
                        </div>
                      </div>
                      <div className="theme-card-preview theme-preview-light">
                        <span style={{ fontWeight: 800 }}>Aa</span>
                        <span>Natural Paper & Green</span>
                      </div>
                      <p className="theme-card-desc">
                        Original daylight canvas with calming natural paper and forest green ink.
                      </p>
                    </button>

                    <button
                      type="button"
                      className={`theme-card-option ${theme === 'dark' ? 'active' : ''}`}
                      aria-pressed={theme === 'dark'}
                      onClick={() => handleSelectTheme('dark')}
                    >
                      <div className="theme-card-header">
                        <div className="theme-card-title">
                          <Moon size={18} color="#38a373" aria-hidden="true" />
                          <span>Dark Mode</span>
                        </div>
                        <div className="theme-check-circle">
                          {theme === 'dark' && <Check size={12} aria-hidden="true" />}
                        </div>
                      </div>
                      <div className="theme-card-preview theme-preview-dark">
                        <span style={{ fontWeight: 800 }}>Aa</span>
                        <span>Emerald Obsidian</span>
                      </div>
                      <p className="theme-card-desc">
                        Deep obsidian backdrop with emerald green accents and maximum contrast.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* DELETE ACCOUNT CONFIRMATION MODAL */}
        {showDeleteModal && (
          <div
            className="delete-modal-overlay"
            role="presentation"
            onClick={() => !isDeletingAccount && setShowDeleteModal(false)}
          >
            <div
              className="delete-modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-desc"
              ref={deleteModalRef}
              onClick={e => e.stopPropagation()}
            >
              <div className="delete-modal-icon-badge" aria-hidden="true">
                <AlertTriangle size={28} />
              </div>
              <h4 id="delete-dialog-title">Permanently Delete Your Account?</h4>
              <p id="delete-dialog-desc">
                Are you sure you want to delete <strong>{currentUser?.email}</strong>?
                This will execute a permanent deletion in the Neon PostgreSQL database, removing your profile and all your saved trips forever.
              </p>
              <div className="delete-modal-warning-list" role="alert">
                ⚠️ All itineraries, preferences, and database records will be erased immediately.
              </div>
              <div className="delete-modal-actions">
                <button
                  type="button"
                  ref={cancelDeleteBtnRef}
                  className="modal-cancel-btn"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-delete-confirm-btn"
                  disabled={isDeletingAccount}
                  onClick={handleConfirmDeleteAccount}
                >
                  {isDeletingAccount ? (
                    <span>Purging from Database...</span>
                  ) : (
                    <>
                      <Trash2 size={15} aria-hidden="true" />
                      <span>Yes, Delete Everything</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHARE TRIP MODAL */}
        {shareModalOpen && selectedTrip && (
          <div className="share-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
            <div className="share-modal-box">
              <div className="share-modal-header">
                <div className="share-modal-title-wrap">
                  <Share2 size={20} className="share-modal-icon" />
                  <h3 id="share-modal-title">Share Itinerary</h3>
                </div>
                <button
                  type="button"
                  className="share-modal-close"
                  onClick={() => setShareModalOpen(false)}
                  aria-label="Close share dialog"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="share-modal-body">
                <p className="share-modal-desc">
                  Share <strong>{selectedTrip.destination}</strong> with a public read-only link. Anyone with the link can view your curated itinerary, budget, and map. Private user details like your email and name are never shown.
                </p>

                {!currentUser ? (
                  <div className="share-auth-required">
                    <AlertCircle size={18} color="#b35a38" />
                    <div>
                      <strong>Sign in to share itineraries</strong>
                      <p>Sign in to save this trip to Neon DB and generate an unguessable public link.</p>
                      <button
                        type="button"
                        className="button button-dark btn-sm"
                        style={{ marginTop: '10px' }}
                        onClick={() => {
                          setShareModalOpen(false)
                          onNavigateLogin?.()
                        }}
                      >
                        <LogIn size={14} />
                        <span>Sign In</span>
                      </button>
                    </div>
                  </div>
                ) : selectedTrip.isShared && selectedTrip.shareId ? (
                  <div className="share-active-section">
                    <div className="share-status-pill active">
                      <CheckCircle2 size={14} />
                      <span>Public sharing is ON</span>
                    </div>

                    <label className="share-url-label" htmlFor="share-url-input">
                      Public Link
                    </label>
                    <div className="share-url-copy-row">
                      <input
                        id="share-url-input"
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/t/${selectedTrip.shareId}`}
                        className="share-url-input"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="button button-dark"
                        onClick={() => handleCopyShareUrl(`${window.location.origin}/t/${selectedTrip.shareId}`)}
                      >
                        {shareCopySuccess ? <Check size={16} /> : <Copy size={16} />}
                        <span>{shareCopySuccess ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="share-revoke-wrap">
                      <button
                        type="button"
                        className="share-revoke-btn"
                        onClick={handleRevokeShareLink}
                        disabled={sharingLoading}
                      >
                        <EyeOff size={15} />
                        <span>{sharingLoading ? 'Updating...' : 'Turn sharing off (revoke link)'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="share-inactive-section">
                    <p className="share-inactive-note">
                      This trip is currently private and only visible in your personal account.
                    </p>
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={handleCreateShareLink}
                      disabled={sharingLoading}
                    >
                      <Link2 size={16} />
                      <span>{sharingLoading ? 'Creating link...' : 'Create Public Link'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: GROUP INVITE & COLLABORATION MODAL */}
        {groupModalOpen && selectedTrip && (
          <GroupInviteModal
            trip={selectedTrip}
            currentUser={currentUser}
            onClose={() => setGroupModalOpen(false)}
            onOpenJoinByLink={() => {
              setGroupModalOpen(false)
              setJoinByLinkOpen(true)
            }}
            showToast={showToast}
            onMembersUpdated={(newMembers) => {
              if (Array.isArray(newMembers)) {
                const names = newMembers.map(m => m.name || m.user_name).filter(Boolean)
                if (names.length > 0) {
                  setSelectedTrip(prev => ({ ...prev, travelers: names }))
                  setTripTravelers(names)
                }
              }
            }}
          />
        )}

        {/* JOIN BY INVITE LINK MODAL */}
        <JoinByLinkModal
          isOpen={joinByLinkOpen}
          currentUser={currentUser}
          existingTripIds={(userTrips ?? []).map(t => t?.id).filter(Boolean)}
          onClose={() => setJoinByLinkOpen(false)}
          onJoinSuccess={(joinedTrip) => {
            setJoinByLinkOpen(false)
            let tripObj = null
            if (joinedTrip && typeof joinedTrip === 'object') {
              tripObj = joinedTrip
            } else if (typeof joinedTrip === 'string') {
              tripObj = userTrips.find(t => t?.id === joinedTrip) || {
                id: joinedTrip,
                destination: 'Group Trip',
                status: 'Upcoming',
                days: []
              }
            }

            if (currentUser?.id) {
              syncTripsFromNeon(currentUser.id).then(trips => {
                if (Array.isArray(trips)) {
                  setUserTrips(trips)
                  if (tripObj?.id) {
                    const fresh = trips.find(t => t?.id === tripObj.id)
                    if (fresh) setSelectedTrip(fresh)
                  }
                }
              })
            } else {
              setUserTrips(getUserTrips('guest'))
            }

            if (tripObj) {
              setSelectedTrip(tripObj)
              setTripViewTab('itinerary')
            }
          }}
          onNavigateLogin={onNavigateLogin}
          showToast={showToast}
        />

        {/* GOOGLE CALENDAR & ICS SYNC MODAL */}
        <CalendarSyncModal
          isOpen={calendarSyncOpen}
          trip={selectedTrip}
          currentUser={currentUser}
          onClose={() => setCalendarSyncOpen(false)}
          showToast={showToast}
        />

        {/* Phase 4: PROPOSE ACTIVITY MODAL */}
        {proposeModalOpen && selectedTrip && (
          <ProposeActivityModal
            isOpen={proposeModalOpen}
            dayNum={proposeDayNum}
            destination={selectedTrip.destination}
            tripCurrency={selectedTripCurrency}
            onOpenCurrencyCalc={() => setCurrencyCalcOpen(true)}
            onClose={() => setProposeModalOpen(false)}
            onSubmit={handleProposeActivitySubmit}
          />
        )}

        {/* Live Currency Calculator Modal */}
        <CurrencyCalculatorModal
          isOpen={currencyCalcOpen}
          onClose={() => setCurrencyCalcOpen(false)}
          defaultFrom="USD"
          defaultTo={selectedTripCurrency?.code || 'JPY'}
        />

        {/* Reachable Footer across Dashboard View */}
        <AppFooter onNavigate={onNavigateExplore} currentView="dashboard" />
      </main>
    </div>
  )
}
