import React from 'react'

// Shared Footer reachable on every page (Landing, Dashboard, Login, Trust Pages)
export function AppFooter({ onNavigate, currentView }) {
  return (
    <footer className="footer section-container" role="contentinfo">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <a
            className="brand"
            href="#home"
            onClick={(e) => {
              e.preventDefault()
              onNavigate?.('landing')
            }}
            aria-label="TripMind AI Home"
          >
            <span className="brand-mark">
              <img src="/tripmind-icon.svg?v=3" alt="TripMind AI logo" width="32" height="32" />
            </span>
            <span>
              tripmind<span className="brand-ai">.ai</span>
            </span>
          </a>
          <nav className="footer-nav-row" aria-label="Footer Navigation">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('landing')
              }}
            >
              Home
            </a>
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('dashboard')
              }}
            >
              Trip Planner
            </a>
            <a
              href="#/about"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('about')
              }}
            >
              About
            </a>
            <a
              href="#/privacy"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('privacy')
              }}
            >
              Privacy Policy
            </a>
            <a
              href="#/contact"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('contact')
              }}
            >
              Contact
            </a>
          </nav>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid var(--line, #e4e4dc)',
          paddingTop: '16px',
          fontSize: '12.5px',
          color: 'var(--muted, #596055)'
        }}>
          <span>Prices, timings, and availability are AI-generated estimates. Please verify before booking.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="mailto:tripmindaisupport@gmail.com" style={{ color: 'inherit', textDecoration: 'underline' }}>
              tripmindaisupport@gmail.com
            </a>
            <span>DESIGNED TO WANDER © 2026 TRIPMIND AI</span>
          </span>
        </div>
      </div>
    </footer>
  )
}

export default AppFooter

