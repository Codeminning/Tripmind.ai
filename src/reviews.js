// Private Trip Reviews & Photo Memories API Client

const REVIEWS_STORAGE_KEY_PREFIX = 'tripmind_reviews_'

/**
 * Client-side image compression to convert large camera photos (3MB-10MB)
 * into lightweight, web-optimized JPEG Data URLs (~80KB - 150KB).
 */
export async function compressPhoto(fileOrDataUrl, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
  if (typeof window === 'undefined') return fileOrDataUrl

  return new Promise((resolve) => {
    const handleLoadedImage = (img) => {
      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '')
        return
      }

      // Smooth downsampling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed)
    }

    if (typeof fileOrDataUrl === 'string') {
      if (!fileOrDataUrl.startsWith('data:image')) {
        // Plain URL, return as-is
        resolve(fileOrDataUrl)
        return
      }
      const img = new Image()
      img.onload = () => handleLoadedImage(img)
      img.onerror = () => resolve(fileOrDataUrl)
      img.src = fileOrDataUrl
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => handleLoadedImage(img)
        img.onerror = () => resolve(e.target?.result || '')
        img.src = e.target?.result
      }
      reader.onerror = () => resolve('')
      reader.readAsDataURL(fileOrDataUrl)
    } else {
      resolve('')
    }
  })
}

function buildAuthHeaders({ token, userId, userName }) {
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (userId) headers['x-user-id'] = userId
  if (userName) headers['x-user-name'] = encodeURIComponent(userName)
  return headers
}

export async function fetchTripReviews({ tripId, token, userId, userName }) {
  if (!tripId) return []

  try {
    const headers = buildAuthHeaders({ token, userId, userName })
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/reviews`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`, JSON.stringify(data))
          } catch (e) {
            console.warn('[Reviews] LocalStorage write failed:', e.message)
          }
        }
        return data
      }
    }
  } catch (err) {
    console.warn('[Reviews] Falling back to local storage cache:', err.message)
  }

  // Fallback to local storage
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(`${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`)
      if (cached) return JSON.parse(cached)
    } catch (e) {}
  }
  return []
}

export async function saveTripReview({ tripId, review, token, userId, userName }) {
  if (!tripId) throw new Error('Trip ID is required')

  const headers = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders({ token, userId: userId || review.userId, userName: userName || review.userName })
  }

  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(review)
    })

    if (res.ok) {
      const saved = await res.json()
      // Update local storage
      if (typeof localStorage !== 'undefined') {
        try {
          const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
          const current = JSON.parse(localStorage.getItem(key) || '[]')
          const updated = [saved, ...current.filter(r => r.id !== saved.id)]
          localStorage.setItem(key, JSON.stringify(updated))
        } catch (e) {}
      }
      return saved
    }
  } catch (err) {
    console.warn('[Reviews] Offline fallback for saving review:', err.message)
  }

  // Offline fallback creation
  const offlineReview = {
    id: review.id || `rev_local_${Date.now()}`,
    trip_id: tripId,
    user_id: userId || review.userId || 'user_guest',
    user_name: review.userName || userName || 'You',
    user_avatar: review.userAvatar || null,
    rating: review.rating || 5,
    title: review.title || 'Trip Memory',
    content: review.content,
    photos: review.photos || [],
    visited_at: review.visitedAt || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
      const current = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([offlineReview, ...current.filter(r => r.id !== offlineReview.id)]))
    } catch (e) {}
  }

  return offlineReview
}

export async function updateTripReview({ tripId, reviewId, review, token, userId, userName }) {
  if (!tripId || !reviewId) throw new Error('Trip ID and Review ID are required')

  const headers = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders({ token, userId: userId || review.userId, userName: userName || review.userName })
  }

  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(review)
    })

    if (res.ok) {
      const updated = await res.json()
      if (typeof localStorage !== 'undefined') {
        try {
          const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
          const current = JSON.parse(localStorage.getItem(key) || '[]')
          const list = current.map(r => r.id === reviewId ? updated : r)
          localStorage.setItem(key, JSON.stringify(list))
        } catch (e) {}
      }
      return updated
    }
  } catch (err) {
    console.warn('[Reviews] Offline fallback for updating review:', err.message)
  }

  // Local storage update fallback
  let localUpdated = null
  if (typeof localStorage !== 'undefined') {
    try {
      const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
      const current = JSON.parse(localStorage.getItem(key) || '[]')
      const target = current.find(r => r.id === reviewId)
      if (target) {
        localUpdated = {
          ...target,
          ...review,
          updated_at: new Date().toISOString()
        }
        localStorage.setItem(key, JSON.stringify(current.map(r => r.id === reviewId ? localUpdated : r)))
      }
    } catch (e) {}
  }

  return localUpdated || { ...review, id: reviewId, trip_id: tripId, updated_at: new Date().toISOString() }
}

export async function deleteTripReview({ tripId, reviewId, token, userId }) {
  if (!tripId || !reviewId) return false

  try {
    const headers = buildAuthHeaders({ token, userId })
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers
    })
    if (res.ok) {
      if (typeof localStorage !== 'undefined') {
        try {
          const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
          const current = JSON.parse(localStorage.getItem(key) || '[]')
          localStorage.setItem(key, JSON.stringify(current.filter(r => r.id !== reviewId)))
        } catch (e) {}
      }
      return true
    }
  } catch (err) {
    console.warn('[Reviews] Offline delete fallback:', err.message)
  }

  // Fallback
  if (typeof localStorage !== 'undefined') {
    try {
      const key = `${REVIEWS_STORAGE_KEY_PREFIX}${tripId}`
      const current = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify(current.filter(r => r.id !== reviewId)))
      return true
    } catch (e) {}
  }
  return false
}
