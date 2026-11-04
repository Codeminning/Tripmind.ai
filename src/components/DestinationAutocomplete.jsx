import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2, Navigation } from 'lucide-react'

export function DestinationAutocomplete({
  id = 'destination-input',
  value = '',
  onChange,
  onSelect,
  placeholder = 'e.g. Kyoto, Japan or Florence, Italy',
  required = false,
  autoFocus = false,
  className = ''
}) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [hasSearched, setHasSearched] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // Fetch suggestions with debouncing and aborting stale requests
  const fetchSuggestions = useCallback((query) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!query || query.trim().length < 2) {
      setSuggestions([])
      setLoading(false)
      setIsOpen(false)
      setHasSearched(false)
      setHighlightedIndex(-1)
      return
    }

    setLoading(true)
    setHasSearched(false)

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(query.trim())}`, {
          signal: abortControllerRef.current.signal
        })

        if (!res.ok) {
          setLoading(false)
          return
        }

        const data = await res.json()
        const items = Array.isArray(data) ? data : []
        setSuggestions(items)
        setIsOpen(true)
        setHasSearched(true)
        setHighlightedIndex(-1)

        if (items.length > 0) {
          setLiveMessage(`${items.length} destination suggestion${items.length > 1 ? 's' : ''} available. Use up and down arrow keys to navigate.`)
        } else {
          setLiveMessage('No destination suggestions found. You can still plan with your custom destination.')
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([])
          setHasSearched(true)
        }
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    onChange?.(val)
    fetchSuggestions(val)
  }

  const handleSelect = (item) => {
    if (!item) return
    const chosenLabel = item.label || item.name || value
    onChange?.(chosenLabel)
    onSelect?.(item)
    setIsOpen(false)
    setSuggestions([])
    setHighlightedIndex(-1)
    setLiveMessage(`Selected destination: ${chosenLabel}`)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault()
        handleSelect(suggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  // Dismiss dropdown on outside clicks
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  return (
    <div className={`destination-autocomplete-wrap ${className}`} ref={containerRef}>
      <div className="input-wrap">
        <MapPin size={18} className="destination-input-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true)
            } else if (value && value.trim().length >= 2) {
              fetchSuggestions(value)
            }
          }}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${id}-suggestions-list`}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined
          }
          className="destination-autocomplete-input"
        />
        {loading && (
          <div className="destination-spinner" title="Searching places..." aria-hidden="true">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
      </div>

      {/* Screen-reader announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <ul
          id={`${id}-suggestions-list`}
          role="listbox"
          className="destination-suggestions-list"
          aria-label="Destination suggestions"
        >
          {suggestions.length > 0 ? (
            suggestions.map((item, index) => {
              const isHighlighted = index === highlightedIndex
              return (
                <li
                  key={item.id || `${item.label}_${index}`}
                  id={`${id}-opt-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`destination-suggestion-item ${isHighlighted ? 'highlighted' : ''}`}
                  onMouseDown={(e) => {
                    // Prevent blur before click executes
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <Navigation size={14} className="suggestion-icon" aria-hidden="true" />
                  <div className="suggestion-text-wrap">
                    <span className="suggestion-primary">
                      {item.name || item.label}
                    </span>
                    {(item.state || item.country) && (
                      <span className="suggestion-secondary">
                        {[item.district, item.city !== item.name ? item.city : null, item.state, item.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                  {item.countryCode && (
                    <span className="suggestion-badge" aria-hidden="true">
                      {item.countryCode}
                    </span>
                  )}
                </li>
              )
            })
          ) : hasSearched && !loading ? (
            <li className="destination-no-results" role="status">
              <span>No matching places found. You can still plan with your typed destination.</span>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

