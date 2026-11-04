// TripMind AI — Calendar Export Engine (.ics / iCalendar RFC 5545)
// Exports all trip activities as individual calendar events.
// Supports destination timezones or floating local time, with proper local date part arithmetic.

const DESTINATION_TIMEZONES = {
  // Asia
  japan: 'Asia/Tokyo',
  kyoto: 'Asia/Tokyo',
  tokyo: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  hokkaido: 'Asia/Tokyo',
  bali: 'Asia/Makassar',
  ubud: 'Asia/Makassar',
  jakarta: 'Asia/Jakarta',
  indonesia: 'Asia/Makassar',
  india: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  mumbai: 'Asia/Kolkata',
  jaipur: 'Asia/Kolkata',
  goa: 'Asia/Kolkata',
  kerala: 'Asia/Kolkata',
  madurai: 'Asia/Kolkata',
  chennai: 'Asia/Kolkata',
  'tamil nadu': 'Asia/Kolkata',
  tamilnadu: 'Asia/Kolkata',
  bangkok: 'Asia/Bangkok',
  phuket: 'Asia/Bangkok',
  thailand: 'Asia/Bangkok',
  singapore: 'Asia/Singapore',
  seoul: 'Asia/Seoul',
  korea: 'Asia/Seoul',
  dubai: 'Asia/Dubai',
  uae: 'Asia/Dubai',

  // Europe
  paris: 'Europe/Paris',
  france: 'Europe/Paris',
  italy: 'Europe/Rome',
  amalfi: 'Europe/Rome',
  positano: 'Europe/Rome',
  rome: 'Europe/Rome',
  florence: 'Europe/Rome',
  venice: 'Europe/Rome',
  london: 'Europe/London',
  uk: 'Europe/London',
  'united kingdom': 'Europe/London',
  scotland: 'Europe/London',
  edinburgh: 'Europe/London',
  lisbon: 'Europe/Lisbon',
  portugal: 'Europe/Lisbon',
  porto: 'Europe/Lisbon',
  spain: 'Europe/Madrid',
  barcelona: 'Europe/Madrid',
  madrid: 'Europe/Madrid',
  germany: 'Europe/Berlin',
  berlin: 'Europe/Berlin',
  netherlands: 'Europe/Amsterdam',
  amsterdam: 'Europe/Amsterdam',
  switzerland: 'Europe/Zurich',
  zurich: 'Europe/Zurich',
  geneva: 'Europe/Zurich',
  greece: 'Europe/Athens',
  athens: 'Europe/Athens',
  santorini: 'Europe/Athens',
  iceland: 'Atlantic/Reykjavik',
  reykjavik: 'Atlantic/Reykjavik',

  // Americas
  mexico: 'America/Mexico_City',
  oaxaca: 'America/Mexico_City',
  cancun: 'America/Cancun',
  cdmx: 'America/Mexico_City',
  brazil: 'America/Sao_Paulo',
  rio: 'America/Sao_Paulo',
  'new york': 'America/New_York',
  toronto: 'America/Toronto',
  canada: 'America/Toronto',
  vancouver: 'America/Vancouver',

  // Australia
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  australia: 'Australia/Sydney'
}

export function detectDestinationTimezone(destination) {
  if (!destination || typeof destination !== 'string') return null
  const d = destination.toLowerCase().trim()
  for (const [key, tz] of Object.entries(DESTINATION_TIMEZONES)) {
    if (d.includes(key)) return tz
  }
  return null
}

// Parses start date using local date parts (never toISOString()) to prevent timezone shift bugs
export function parseLocalTripStartDate(startDateStr) {
  if (startDateStr && typeof startDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr.trim())) {
    const parts = startDateStr.trim().split('-')
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    return new Date(y, m, d)
  }
  // Fallback: upcoming Saturday in local calendar time
  const now = new Date()
  const day = now.getDay()
  const daysUntilSat = day === 6 ? 7 : (6 - day)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat)
}

// Computes local date parts for Day N (1-indexed) from base start date
export function getDayLocalDate(baseDate, dayIndex) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + (dayIndex - 1))
  return {
    year: String(d.getFullYear()).padStart(4, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    day: String(d.getDate()).padStart(2, '0')
  }
}

function parseTime(timeStr, defaultHour = 9, defaultMinute = 0) {
  if (timeStr && typeof timeStr === 'string') {
    const parts = timeStr.trim().split(':')
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10)
      const min = parseInt(parts[1], 10)
      if (!isNaN(h) && !isNaN(min) && h >= 0 && h < 24 && min >= 0 && min < 60) {
        return { hour: h, minute: min }
      }
    }
  }
  return { hour: defaultHour, minute: defaultMinute }
}

function formatIcsDateTime(dateParts, time, tzId) {
  const y = dateParts.year
  const m = dateParts.month
  const d = dateParts.day
  const hh = String(time.hour).padStart(2, '0')
  const mm = String(time.minute).padStart(2, '0')
  const dtStr = `${y}${m}${d}T${hh}${mm}00`

  // Use destination timezone if identified; otherwise floating local time per RFC 5545
  if (tzId) {
    return `;TZID=${tzId}:${dtStr}`
  }
  return `:${dtStr}`
}

function escapeIcs(text) {
  if (!text) return ''
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function generateTripIcs(trip) {
  if (!trip || !Array.isArray(trip.days)) return ''

  const tzId = detectDestinationTimezone(trip.destination)
  const baseStartDate = parseLocalTripStartDate(trip.startDate)
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planora//Travel Concierge//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(trip.destination)} Itinerary`
  ]

  if (tzId) {
    lines.push(`X-WR-TIMEZONE:${tzId}`)
  }

  let eventCounter = 0
  trip.days.forEach(dayObj => {
    const dayNum = Number(dayObj.day) || 1
    const dateParts = getDayLocalDate(baseStartDate, dayNum)
    const activities = Array.isArray(dayObj.activities) ? dayObj.activities : []

    activities.forEach((act, actIdx) => {
      eventCounter++
      const startTime = parseTime(act.time, 9 + actIdx * 2, 0)
      let endHour = startTime.hour + 1
      let endMinute = startTime.minute + 30
      if (endMinute >= 60) {
        endHour += 1
        endMinute -= 60
      }
      if (endHour >= 24) endHour = 23
      const endTime = { hour: endHour, minute: endMinute }

      const uid = `tripmind-${trip.id || 'trip'}-d${dayNum}-a${actIdx}-${eventCounter}@tripmind.ai`
      const summary = act.title || `Day ${dayNum} Activity`
      let desc = act.description || ''
      if (act.category) desc += `\nCategory: ${act.category}`
      if (act.cost !== undefined) desc += `\nEstimated Cost: $${act.cost} USD`
      if (trip.travelTip && actIdx === 0) desc += `\nLocal Secret: ${trip.travelTip}`

      const location = act.location ? `${act.location}, ${trip.destination}` : trip.destination

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART${formatIcsDateTime(dateParts, startTime, tzId)}`)
      lines.push(`DTEND${formatIcsDateTime(dateParts, endTime, tzId)}`)
      lines.push(`SUMMARY:${escapeIcs(summary)}`)
      lines.push(`DESCRIPTION:${escapeIcs(desc)}`)
      lines.push(`LOCATION:${escapeIcs(location)}`)
      lines.push('STATUS:CONFIRMED')
      lines.push('END:VEVENT')
    })
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadTripIcs(trip) {
  const icsData = generateTripIcs(trip)
  if (!icsData) return false

  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' })
  const cleanDest = (trip.destination || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const filename = `${cleanDest}-itinerary.ics`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/**
 * Generates an official Google Calendar 1-click Web Intent URL.
 * Opens Google Calendar with the trip dates and rich itinerary pre-filled.
 */
export function createGoogleCalendarWebUrl(trip) {
  if (!trip) return ''

  const baseDate = parseLocalTripStartDate(trip.startDate)
  const daysCount = Array.isArray(trip.days) && trip.days.length > 0 ? trip.days.length : 3

  const startYear = baseDate.getFullYear()
  const startMonth = String(baseDate.getMonth() + 1).padStart(2, '0')
  const startDay = String(baseDate.getDate()).padStart(2, '0')
  const startDateStr = `${startYear}${startMonth}${startDay}`

  const endDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + daysCount)
  const endYear = endDate.getFullYear()
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')
  const endDay = String(endDate.getDate()).padStart(2, '0')
  const endDateStr = `${endYear}${endMonth}${endDay}`

  const title = `✈️ Trip to ${trip.destination || 'Destination'}`
  
  let details = `${trip.summary || `Personalized trip to ${trip.destination}`}\n\n`
  if (trip.travelTip) {
    details += `💡 Local Tip: ${trip.travelTip}\n\n`
  }

  if (Array.isArray(trip.days)) {
    details += `📅 Daily Schedule Overview:\n`
    trip.days.forEach(day => {
      details += `\nDay ${day.day || 1}: ${day.title || 'Explorations'}\n`
      if (Array.isArray(day.activities)) {
        day.activities.forEach(act => {
          details += `• ${act.time || '09:00'} - ${act.title || 'Activity'}`
          if (act.location) details += ` (${act.location})`
          if (act.cost !== undefined && act.cost > 0) details += ` [~$${act.cost}]`
          details += `\n`
        })
      }
    })
  }

  details += `\nCurated with Planora`

  const location = trip.destination || ''
  const datesParam = `${startDateStr}/${endDateStr}`

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${datesParam}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`
}

/**
 * Formats full trip events into Google Calendar REST API payload format.
 * Returns an array of events: 1 multi-day overview event + individual activity events.
 */
export function formatTripEventsForGoogleApi(trip) {
  if (!trip) return []

  const tzId = detectDestinationTimezone(trip.destination) || 'UTC'
  const baseStartDate = parseLocalTripStartDate(trip.startDate)
  const daysCount = Array.isArray(trip.days) && trip.days.length > 0 ? trip.days.length : 3

  const startYear = baseStartDate.getFullYear()
  const startMonth = String(baseStartDate.getMonth() + 1).padStart(2, '0')
  const startDay = String(baseStartDate.getDate()).padStart(2, '0')
  const startDateIso = `${startYear}-${startMonth}-${startDay}`

  const endDate = new Date(baseStartDate.getFullYear(), baseStartDate.getMonth(), baseStartDate.getDate() + daysCount)
  const endYear = endDate.getFullYear()
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')
  const endDay = String(endDate.getDate()).padStart(2, '0')
  const endDateIso = `${endYear}-${endMonth}-${endDay}`

  const events = []

  // 1. All-Day Multi-day trip container event
  events.push({
    idPrefix: `overview_${trip.id || 'trip'}`,
    summary: `✈️ Trip to ${trip.destination}`,
    description: `${trip.summary || ''}\n\n${trip.travelTip ? `Local Tip: ${trip.travelTip}\n` : ''}Planned with Planora`,
    location: trip.destination,
    start: { date: startDateIso },
    end: { date: endDateIso },
    transparency: 'transparent'
  })

  // 2. Individual day activities
  if (Array.isArray(trip.days)) {
    trip.days.forEach(dayObj => {
      const dayNum = Number(dayObj.day) || 1
      const dateParts = getDayLocalDate(baseStartDate, dayNum)
      const dayDateIso = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
      const activities = Array.isArray(dayObj.activities) ? dayObj.activities : []

      activities.forEach((act, actIdx) => {
        const startTime = parseTime(act.time, 9 + actIdx * 2, 0)
        let endHour = startTime.hour + 1
        let endMinute = startTime.minute + 30
        if (endMinute >= 60) {
          endHour += 1
          endMinute -= 60
        }
        if (endHour >= 24) endHour = 23
        const endTime = { hour: endHour, minute: endMinute }

        const startDateTimeIso = `${dayDateIso}T${String(startTime.hour).padStart(2, '0')}:${String(startTime.minute).padStart(2, '0')}:00`
        const endDateTimeIso = `${dayDateIso}T${String(endTime.hour).padStart(2, '0')}:${String(endTime.minute).padStart(2, '0')}:00`

        let desc = act.description || ''
        if (act.category) desc += `\nCategory: ${act.category}`
        if (act.cost !== undefined) desc += `\nEstimated Cost: $${act.cost} USD`
        if (trip.travelTip && actIdx === 0) desc += `\nInsider Tip: ${trip.travelTip}`

        events.push({
          idPrefix: `act_${trip.id || 'trip'}_d${dayNum}_a${actIdx}`,
          summary: act.title || `Day ${dayNum} Activity`,
          description: desc,
          location: act.location ? `${act.location}, ${trip.destination}` : trip.destination,
          start: {
            dateTime: startDateTimeIso,
            timeZone: tzId
          },
          end: {
            dateTime: endDateTimeIso,
            timeZone: tzId
          }
        })
      })
    })
  }

  return events
}

