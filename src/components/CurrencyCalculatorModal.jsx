import React, { useState, useEffect } from 'react'
import { X, ArrowRightLeft, RefreshCw, Calculator, DollarSign, TrendingUp } from 'lucide-react'
import { CURRENCIES, getRatesLastUpdated } from '../currency'

export function CurrencyCalculatorModal({
  isOpen,
  onClose,
  defaultFrom = 'USD',
  defaultTo = 'JPY',
  initialAmount = 100
}) {
  const [fromCode, setFromCode] = useState(defaultFrom || 'USD')
  const [toCode, setToCode] = useState(defaultTo || 'JPY')
  const [amount, setAmount] = useState(String(initialAmount || 100))

  useEffect(() => {
    if (defaultFrom && CURRENCIES[defaultFrom]) setFromCode(defaultFrom)
    if (defaultTo && CURRENCIES[defaultTo]) setToCode(defaultTo)
  }, [defaultFrom, defaultTo])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const fromCurr = CURRENCIES[fromCode] || CURRENCIES.USD
  const toCurr = CURRENCIES[toCode] || CURRENCIES.USD

  const numAmount = parseFloat(amount) || 0
  const rateFrom = fromCurr.rateFromUsd || 1
  const rateTo = toCurr.rateFromUsd || 1
  const unitRate = rateTo / rateFrom
  const convertedAmount = numAmount * unitRate

  const handleSwap = () => {
    setFromCode(toCode)
    setToCode(fromCode)
  }

  const formatResult = (val) => {
    if (!Number.isFinite(val)) return '0.00'
    if (val >= 1000) {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val)
    }
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }

  const lastUpdated = getRatesLastUpdated()

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="calc-modal-title" onClick={onClose}>
      <div className="modal-card currency-calc-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="currency-calc-title-wrap">
            <div className="currency-icon-badge">
              <Calculator size={18} />
            </div>
            <div>
              <h3 id="calc-modal-title">Live Currency Converter</h3>
              <p className="modal-subtitle">Real-time exchange rates for your travels</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={onClose}
            aria-label="Close currency converter"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-scroll-body currency-calc-body">
          {/* Amount and From Currency */}
          <div className="calc-inputs-grid">
            <div className="field">
              <label className="field-label" htmlFor="calc-amount">Amount</label>
              <div className="calc-input-wrap">
                <span className="calc-curr-symbol">{fromCurr.symbol}</span>
                <input
                  id="calc-amount"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="calc-from-curr">From</label>
              <select
                id="calc-from-curr"
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
              >
                {Object.values(CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Button Divider */}
          <div className="calc-swap-row">
            <div className="calc-swap-line" />
            <button
              type="button"
              className="calc-swap-btn"
              onClick={handleSwap}
              title="Swap currencies"
              aria-label="Swap from and to currencies"
            >
              <ArrowRightLeft size={15} />
              <span>Swap</span>
            </button>
            <div className="calc-swap-line" />
          </div>

          {/* To Currency Selection */}
          <div className="field">
            <label className="field-label" htmlFor="calc-to-curr">To (Target Currency)</label>
            <select
              id="calc-to-curr"
              value={toCode}
              onChange={(e) => setToCode(e.target.value)}
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Result Card */}
          <div className="calc-result-box">
            <span className="calc-result-label">Converted Total</span>
            <div className="calc-result-val">
              <span className="calc-result-symbol">{toCurr.symbol}</span>
              <span className="calc-result-number">{formatResult(convertedAmount)}</span>
              <span className="calc-result-code">{toCurr.code}</span>
            </div>
            <div className="calc-rate-sub">
              1 {fromCurr.code} = {unitRate.toFixed(4)} {toCurr.code} &nbsp;&bull;&nbsp; 1 {toCurr.code} = {(1 / unitRate).toFixed(4)} {fromCurr.code}
            </div>
          </div>

          {/* Quick Amount Shortcuts */}
          <div className="calc-quick-pills">
            <span className="calc-quick-label">Quick amounts:</span>
            {[10, 25, 50, 100, 250, 500].map((quickVal) => (
              <button
                key={quickVal}
                type="button"
                className={`calc-pill ${numAmount === quickVal ? 'active' : ''}`}
                onClick={() => setAmount(String(quickVal))}
              >
                {fromCurr.symbol}{quickVal}
              </button>
            ))}
          </div>

          {/* Freshness Footer */}
          <div className="calc-freshness-info">
            <RefreshCw size={12} className="spin-slow" />
            <span>Exchange rates updated: <strong>{lastUpdated}</strong> (European Central Bank reference)</span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="button button-dark" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

