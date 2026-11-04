import React, { useState, useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Clock,
  MapPin,
  DollarSign,
  Tag,
  Navigation,
  Layers,
  Locate,
  Footprints,
  Car,
  Bike
} from 'lucide-react'

// Color palette for day badges matching TripMind's terracotta and sage theme
const DAY_COLORS = [
  '#2b5143', // Deep Sage
  '#b35a38', // Terracotta
  '#3f6b5b', // Forest Pine
  '#8c4d2d', // Warm Clay
  '#254b42', // Evergreen
  '#d97746', // Sunlit Ochre
  '#4a5548', // Earth
]

// Haversine formula to compute distance in km
function computeHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapView({ trip, selectedCurrencyMode = 'usd', selectedTripCurrency = null, formatLocal }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const userLocationMarkerRef = useRef(null)

  const [selectedDayFilter, setSelectedDayFilter] = useState('all') // 'all' | 1 | 2 | 3 ...
  const [activeActivityKey, setActiveActivityKey] = useState(null)
  const [travelMode, setTravelMode] = useState('walking') // 'walking' | 'bicycling' | 'driving'
  const [showRoutes, setShowRoutes] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationStatus, setLocationStatus] = useState(null) // null | 'denied' | 'unavailable' | 'active'
  const listItemsRef = useRef({})

  const days = Array.isArray(trip?.days) ? trip.days : []

  // Flatten all activities with day numbers, global index, and unique keys
  const allActivities = useMemo(() => {
    const list = []
    days.forEach(d => {
      const dayNum = Number(d.day) || 1
      const acts = Array.isArray(d.activities) ? d.activities : []
      acts.forEach((act, idx) => {
        const key = `d${dayNum}_a${idx}`
        list.push({
          ...act,
          dayNum,
          actIndex: idx + 1,
          key,
          dayTitle: d.title || `Day ${dayNum}`
        })
      })
    })
    return list
  }, [days])

  // Filter activities based on selectedDayFilter
  const visibleActivities = useMemo(() => {
    if (selectedDayFilter === 'all') return allActivities
    const targetDay = Number(selectedDayFilter)
    return allActivities.filter(a => a.dayNum === targetDay)
  }, [allActivities, selectedDayFilter])

  // Activities with valid coordinates
  const mappedActivities = useMemo(() => {
    return visibleActivities.filter(a => {
      const lat = Number(a.latitude)
      const lng = Number(a.longitude)
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)
    })
  }, [visibleActivities])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Avoid duplicate initialization
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    // Default center (or world view if no coordinates)
    const initialCenter = mappedActivities.length > 0
      ? [mappedActivities[0].latitude, mappedActivities[0].longitude]
      : [20, 0]
    const initialZoom = mappedActivities.length > 0 ? 13 : 2

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      scrollWheelZoom: true
    })

    // OpenStreetMap tile layer with mandatory attribution
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map)

    mapInstanceRef.current = map

    // Ensure map tiles render properly after container dimensions settle
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(timer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // Mount only once

  // Update Markers whenever filtered activities change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear previous markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (mappedActivities.length === 0) return

    const bounds = L.latLngBounds()

    mappedActivities.forEach((act) => {
      const lat = Number(act.latitude)
      const lng = Number(act.longitude)
      const color = DAY_COLORS[(act.dayNum - 1) % DAY_COLORS.length]

      // Custom numbered HTML DivIcon matching TripMind styling
      const customIcon = L.divIcon({
        className: 'tripmind-leaflet-marker',
        html: `
          <div class="map-marker-pin" style="--pin-color: ${color};" title="Day ${act.dayNum} · #${act.actIndex}: ${act.title}">
            <span class="marker-day">D${act.dayNum}</span>
            <span class="marker-number">${act.actIndex}</span>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
        popupAnchor: [0, -42]
      })

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map)

      // Rich popup content
      const formattedCost = act.cost === 0
        ? 'Free'
        : (formatLocal && selectedTripCurrency
            ? formatLocal(act.cost, selectedCurrencyMode === 'usd' ? 'USD' : selectedTripCurrency.code)
            : `$${act.cost}`)

      const costHtml = act.cost !== undefined
        ? `<div class="marker-popup-cost"><strong>Cost:</strong> ${formattedCost}</div>`
        : ''

      const popupHtml = `
        <div class="tripmind-map-popup">
          <div class="marker-popup-badge" style="background: ${color}; color: #fff;">
            Day 0${act.dayNum} · Stop ${act.actIndex}
          </div>
          <h4 class="marker-popup-title">${act.title}</h4>
          <div class="marker-popup-meta">
            ${act.time ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${act.time}</span>` : ''}
            ${act.category ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${act.category}</span>` : ''}
          </div>
          ${act.description ? `<p class="marker-popup-desc">${act.description}</p>` : ''}
          ${costHtml}
        </div>
      `

      marker.bindPopup(popupHtml, {
        closeButton: true,
        className: 'tripmind-popup-wrapper'
      })

      // Marker click -> sync and highlight corresponding list item
      marker.on('click', () => {
        setActiveActivityKey(act.key)
        const element = listItemsRef.current[act.key]
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })

      marker.activityKey = act.key
      markersRef.current.push(marker)
      bounds.extend([lat, lng])
    })

    // Clear previous polylines
    polylinesRef.current.forEach(p => p.remove())
    polylinesRef.current = []

    // Draw route polylines connecting sequential stops if enabled
    if (showRoutes && mappedActivities.length > 1) {
      // Group mapped activities by day
      const dayGroups = {}
      mappedActivities.forEach(act => {
        if (!dayGroups[act.dayNum]) dayGroups[act.dayNum] = []
        dayGroups[act.dayNum].push(act)
      })

      Object.entries(dayGroups).forEach(([dNum, acts]) => {
        if (acts.length < 2) return
        const latLngs = acts.map(a => [Number(a.latitude), Number(a.longitude)])
        const color = DAY_COLORS[(Number(dNum) - 1) % DAY_COLORS.length]
        const polyline = L.polyline(latLngs, {
          color,
          weight: 4,
          opacity: 0.8,
          dashArray: travelMode === 'walking' ? '6, 8' : (travelMode === 'bicycling' ? '10, 8' : null),
          lineJoin: 'round'
        }).addTo(map)

        polylinesRef.current.push(polyline)
      })
    }

    // Fit map bounds to show all markers
    if (mappedActivities.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else if (mappedActivities.length === 1) {
      map.setView([mappedActivities[0].latitude, mappedActivities[0].longitude], 14)
    }

    // Re-invalidate size in case layout adjusted
    map.invalidateSize()
  }, [mappedActivities, showRoutes, travelMode])

  // Contextual Location Permission Handler
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    setLocating(true)
    setLocationStatus(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(coords)
        setLocationStatus('active')

        const map = mapInstanceRef.current
        if (map) {
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove()
          }

          const userIcon = L.divIcon({
            className: 'user-live-location-marker',
            html: `
              <div class="user-location-pulse-ring">
                <div class="user-location-inner-dot"></div>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })

          const uMarker = L.marker([coords.lat, coords.lng], { icon: userIcon }).addTo(map)
          uMarker.bindPopup(`
            <div class="user-location-popup">
              <strong>Your Current Location</strong>
              <p>Opt-in browser location</p>
            </div>
          `).openPopup()

          userLocationMarkerRef.current = uMarker
          map.flyTo([coords.lat, coords.lng], 14, { duration: 1 })
        }
      },
      (err) => {
        setLocating(false)
        console.warn('Location permission error:', err)
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // Focus a specific activity from list click
  const handleSelectActivity = (act) => {
    setActiveActivityKey(act.key)
    const map = mapInstanceRef.current
    if (!map) return

    const lat = Number(act.latitude)
    const lng = Number(act.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    map.flyTo([lat, lng], 15, { duration: 0.8 })

    // Find and open marker popup
    const marker = markersRef.current.find(m => m.activityKey === act.key)
    if (marker) {
      marker.openPopup()
    }
  }

  return (
    <div className="tripmind-map-view-container">
      {/* Day Filter Bar */}
      <div className="map-view-toolbar">
        <div className="map-filter-group">
          <span className="filter-label">
            <Layers size={14} /> Filter Day:
          </span>
          <button
            type="button"
            className={`map-filter-chip ${selectedDayFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedDayFilter('all')}
          >
            All Days ({allActivities.length})
          </button>
          {days.map(d => (
            <button
              key={d.day}
              type="button"
              className={`map-filter-chip ${selectedDayFilter === d.day ? 'active' : ''}`}
              onClick={() => setSelectedDayFilter(d.day)}
            >
              Day {d.day}
            </button>
          ))}
        </div>

        <div className="map-toolbar-right">
          {/* Mode Switcher */}
          <div className="travel-mode-switcher" role="radiogroup" aria-label="Travel Mode">
            <button
              type="button"
              className={`travel-mode-btn ${travelMode === 'walking' ? 'active' : ''}`}
              onClick={() => setTravelMode('walking')}
              aria-label="Walking travel mode"
              title="Walking speed (~4.5 km/h)"
            >
              <Footprints size={14} />
              <span>Walk</span>
            </button>
            <button
              type="button"
              className={`travel-mode-btn ${travelMode === 'bicycling' ? 'active' : ''}`}
              onClick={() => setTravelMode('bicycling')}
              aria-label="Bicycling travel mode"
              title="Bicycle speed (~15 km/h)"
            >
              <Bike size={14} />
              <span>Bike</span>
            </button>
            <button
              type="button"
              className={`travel-mode-btn ${travelMode === 'driving' ? 'active' : ''}`}
              onClick={() => setTravelMode('driving')}
              aria-label="Driving travel mode"
              title="Driving / Transit (~30 km/h avg)"
            >
              <Car size={14} />
              <span>Drive</span>
            </button>
          </div>

          {/* Location button */}
          <button
            type="button"
            className={`map-locate-btn ${locating ? 'loading' : ''} ${locationStatus === 'active' ? 'active' : ''}`}
            onClick={handleLocateUser}
            disabled={locating}
            aria-label="Locate me on map"
            title={
              locationStatus === 'denied'
                ? 'Location permission denied by browser'
                : 'Locate your current position on map'
            }
          >
            <Locate size={14} />
            <span>{locating ? 'Locating...' : 'Locate Me'}</span>
          </button>
        </div>
      </div>

      {/* Split View: Map + Synced Activity List */}
      <div className="map-split-workspace">
        {/* Leaflet Map Box */}
        <div className="map-canvas-wrapper">
          <div ref={mapContainerRef} className="leaflet-map-host" />
          {mappedActivities.length === 0 && (
            <div className="map-empty-overlay">
              <MapPin size={32} color="#b35a38" />
              <h4>Coordinates not available</h4>
              <p>Locations for this itinerary do not have coordinates yet.</p>
            </div>
          )}
        </div>

        {/* Synced Activities Sidebar */}
        <div className="map-activities-sidebar">
          <div className="sidebar-header">
            <h4>
              {selectedDayFilter === 'all' ? 'All Itinerary Stops' : `Day ${selectedDayFilter} Itinerary`}
            </h4>
            <small>Click any activity to focus on map</small>
          </div>

          <div className="sidebar-activities-scroll">
            {visibleActivities.length === 0 ? (
              <div className="sidebar-empty">No activities for this day.</div>
            ) : (
              visibleActivities.map((act, idx) => {
                const isSelected = activeActivityKey === act.key
                const hasCoords = Number.isFinite(Number(act.latitude)) && Number.isFinite(Number(act.longitude))
                const color = DAY_COLORS[(act.dayNum - 1) % DAY_COLORS.length]

                // Calculate distance from previous activity if both have valid coordinates
                let transitInfo = null
                if (idx > 0 && hasCoords) {
                  const prevAct = visibleActivities[idx - 1]
                  if (Number.isFinite(Number(prevAct.latitude)) && Number.isFinite(Number(prevAct.longitude)) && prevAct.dayNum === act.dayNum) {
                    const distKm = computeHaversineDistanceKm(
                      Number(prevAct.latitude),
                      Number(prevAct.longitude),
                      Number(act.latitude),
                      Number(act.longitude)
                    )

                    // Estimate duration based on travel mode
                    // Walking: 4.5 km/h, Bicycling: 15 km/h, Driving: 30 km/h (city)
                    let speedKmH = 4.5
                    if (travelMode === 'bicycling') speedKmH = 15
                    if (travelMode === 'driving') speedKmH = 30

                    const mins = Math.max(1, Math.round((distKm / speedKmH) * 60))
                    transitInfo = {
                      dist: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
                      time: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`
                    }
                  }
                }

                return (
                  <div key={act.key} className="map-activity-item-wrapper">
                    {transitInfo && (
                      <div className="transit-leg-badge">
                        {travelMode === 'walking' && <Footprints size={12} />}
                        {travelMode === 'bicycling' && <Bike size={12} />}
                        {travelMode === 'driving' && <Car size={12} />}
                        <span>{transitInfo.dist} · ~{transitInfo.time}</span>
                      </div>
                    )}

                    <div
                      ref={el => listItemsRef.current[act.key] = el}
                      role="button"
                      tabIndex={0}
                      className={`map-activity-item ${isSelected ? 'active' : ''} ${!hasCoords ? 'disabled-coords' : ''}`}
                      onClick={() => handleSelectActivity(act)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectActivity(act)
                        }
                      }}
                    >
                      <div className="item-badge-pill" style={{ backgroundColor: color }}>
                        <span>D0{act.dayNum}</span>
                        <small>#{act.actIndex}</small>
                      </div>

                      <div className="item-content">
                        <div className="item-top-row">
                          <span className="item-time">
                            <Clock size={11} /> {act.time || 'Flexible'}
                          </span>
                          {act.cost !== undefined && (
                            <span className="item-cost">
                              {act.cost === 0
                                ? 'Free'
                                : (formatLocal && selectedTripCurrency
                                    ? formatLocal(act.cost, selectedCurrencyMode === 'usd' ? 'USD' : selectedTripCurrency.code)
                                    : `$${act.cost}`
                                  )
                              }
                            </span>
                          )}
                        </div>
                        <h5 className="item-title">{act.title}</h5>
                        {act.description && <p className="item-desc">{act.description}</p>}
                        {hasCoords ? (
                          <div className="item-nav-hint">
                            <Navigation size={11} />
                            <span>View on map</span>
                          </div>
                        ) : (
                          <div className="item-unmapped-badge">
                            <span>No coordinates</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

