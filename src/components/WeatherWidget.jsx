import React, { useState, useEffect } from 'react'
import { CloudRain, Sun, Cloud, Thermometer, Wind } from 'lucide-react'
import { fetchTripWeather } from '../tripReminders'

export function WeatherWidget({ destination, startDate, coordinates }) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!destination) return
    setLoading(true)
    fetchTripWeather({
      destination,
      startDate,
      lat: coordinates?.lat,
      lng: coordinates?.lng
    })
      .then(data => {
        setWeather(data)
      })
      .catch(() => {
        setWeather(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [destination, startDate, coordinates?.lat, coordinates?.lng])

  // Requirement: "If unavailable, hide the section instead of showing errors."
  if (loading || !weather || !weather.available) {
    return null
  }

  const isForecast = weather.mode === 'forecast' && Array.isArray(weather.days) && weather.days.length > 0

  return (
    <div className="trip-weather-widget print-hide" role="region" aria-label="Destination Weather">
      <div className="weather-widget-header">
        <div className="weather-widget-title">
          <span className="weather-badge">
            {isForecast ? 'Live Forecast (Open-Meteo)' : 'Typical Seasonal Climate'}
          </span>
          <h4>Weather in {destination}</h4>
        </div>
        {weather.currentTempC !== null && weather.currentTempC !== undefined && (
          <div className="weather-current-temp">
            <span className="temp-value">{weather.currentTempC}°C</span>
            <span className="temp-f">({Math.round(weather.currentTempC * 9/5 + 32)}°F)</span>
          </div>
        )}
      </div>

      {isForecast ? (
        <div className="weather-forecast-days">
          {weather.days.map((day, idx) => {
            const dateObj = new Date(day.date)
            const dayName = isNaN(dateObj.getTime())
              ? day.date
              : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })

            return (
              <div key={idx} className="weather-day-card">
                <span className="weather-day-name">{dayName}</span>
                <span className="weather-day-icon" aria-hidden="true">{day.icon || '⛅'}</span>
                <span className="weather-day-label">{day.label}</span>
                <div className="weather-day-temps">
                  <span className="temp-high">{day.maxTempC}°</span>
                  <span className="temp-divider">/</span>
                  <span className="temp-low">{day.minTempC}°</span>
                </div>
                {day.rainChancePct !== undefined && day.rainChancePct > 0 && (
                  <div className="weather-rain-chance">
                    <CloudRain size={11} />
                    <span>{day.rainChancePct}%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="weather-climate-card">
          <div className="climate-metrics">
            <div className="climate-metric-item">
              <span className="metric-label">Typical High</span>
              <strong className="metric-val">{weather.climate?.typicalHighC}°C ({Math.round((weather.climate?.typicalHighC || 20) * 9/5 + 32)}°F)</strong>
            </div>
            <div className="climate-metric-item">
              <span className="metric-label">Typical Low</span>
              <strong className="metric-val">{weather.climate?.typicalLowC}°C ({Math.round((weather.climate?.typicalLowC || 12) * 9/5 + 32)}°F)</strong>
            </div>
            <div className="climate-metric-item">
              <span className="metric-label">Rain Probability</span>
              <strong className="metric-val">{weather.climate?.rainChancePct}%</strong>
            </div>
          </div>
          <p className="climate-summary">{weather.climate?.summary}</p>
        </div>
      )}
    </div>
  )
}

