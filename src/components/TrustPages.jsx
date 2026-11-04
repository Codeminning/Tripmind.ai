import React, { useState } from 'react'
import {
  ArrowLeft,
  Mail,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Compass,
  MessageSquare,
  Send,
  Lock,
  ExternalLink,
  Trash2,
  Database
} from 'lucide-react'

import { AppFooter } from './AppFooter'

// Common Legal / Trust Navigation Header
function TrustHeader({ tag, title, meta, onBack }) {
  return (
    <header className="legal-header">
      <div className="legal-back-row">
        <button type="button" className="legal-back-btn" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Planora</span>
        </button>
      </div>
      <span className="legal-tag">{tag}</span>
      <h1>{title}</h1>
      {meta && <span className="legal-meta">{meta}</span>}
    </header>
  )
}

// 1. ABOUT PAGE COMPONENT
export function AboutPage({ onBack, onStartPlanning, onNavigate }) {
  return (
    <div className="legal-page-shell">
      <div className="legal-container">
        <TrustHeader
          tag="About Planora"
          title="Slow travel, thoughtfully planned."
          meta="Published October 2026"
          onBack={onBack}
        />

        <div className="legal-content">
          <section className="legal-section">
            <h2>What Planora Does</h2>
            <p>
              Planora is an intelligent travel concierge designed for travelers who prefer slow, immersive exploration
              over cookie-cutter tourist checklists. We rescue travelers from 30 open browser tabs, spreadsheet chaos, and
              unreliable review blogs.
            </p>
            <p>
              Tell us where you want to go, and Planora crafts an unhurried, day-by-day plan with neighborhood cafes,
              cultural gems, transparent local budget estimates, and custom packing checklists.
            </p>
            <ul>
              <li>
                <strong>Rhythmic Itineraries:</strong> Morning, afternoon, and golden-hour plans clustered geographically so you wander instead of sitting in transit.
              </li>
              <li>
                <strong>Transparent Budgets:</strong> Real-time conversion between your home currency (USD, EUR, GBP) and destination local currencies (e.g. INR, JPY, IDR).
              </li>
              <li>
                <strong>Season-Aware Packing:</strong> Packing suggestions tuned to the climate and cultural modesty standards of your destination.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Who Built It</h2>
            <p>
              Planora was created by a traveler and software engineer who believes travel tools should feel calm,
              editorial, and honest.
            </p>
            <div className="legal-highlight-box founder-card">
              <div className="founder-name"><strong>DHYANESH VISAKAN</strong></div>
              <div className="founder-title">FOUNDER</div>
              <div className="founder-email">
                <a href="mailto:planora.coresupport@gmail.com">planora.coresupport@gmail.com</a>
              </div>
            </div>
            <p style={{ marginTop: '14px' }}>
              We never take commercial kickbacks or sponsored placements from hotels or venues. All recommendations are
              generated strictly for local quality, walkability, and character.
            </p>
          </section>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              type="button"
              className="button button-dark"
              onClick={onStartPlanning}
              style={{ margin: '0 auto' }}
            >
              <Compass size={16} aria-hidden="true" />
              <span>Start Planning a Trip</span>
            </button>
          </div>
        </div>
      </div>
      <AppFooter onNavigate={onNavigate || onBack} />
    </div>
  )
}

// 2. PRIVACY POLICY COMPONENT
export function PrivacyPage({ onBack, onNavigate }) {
  return (
    <div className="legal-page-shell">
      <div className="legal-container">
        <TrustHeader
          tag="Privacy & Legal"
          title="Privacy Policy"
          meta="Last updated: October 2026 Â· Plain-language policy"
          onBack={onBack}
        />

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Our Commitment: We Do Not Sell Your Data</h2>
            <p>
              At Planora, we respect your privacy. <strong>We do not sell, rent, monetize, or trade your personal data or travel plans with third-party data brokers or advertisers.</strong>
            </p>
          </section>

          <section className="legal-section">
            <h2>2. What Information We Collect & Where It Is Stored</h2>
            <ul>
              <li>
                <strong>Account Data (Stored in Neon PostgreSQL):</strong> When you create an account or sign in with Google, we store your full name, email address, avatar photo, and travel preferences in an encrypted serverless PostgreSQL database hosted on Neon. Passwords are encrypted using salted bcrypt hashes.
              </li>
              <li>
                <strong>Saved Itineraries & Group Planning:</strong> Itineraries you create while signed in are safely saved to your Neon database account. For collaborative trips, group membership, member display names, and activity votes are stored securely in Neon. Member email addresses are never revealed to other group members.
              </li>
              <li>
                <strong>Expenses & Budget Split:</strong> Expense entries, payment records, currency preferences, and traveler split allocations are stored in Neon for logged-in accounts, and stored strictly in browser local storage for guest travelers.
              </li>
              <li>
                <strong>Local Storage (`localStorage`):</strong> If you use Planora in guest mode, your planned itineraries and budget logs are stored only in your local browser storage (`localStorage`). We also store your light/dark theme preference locally. Guest data is never transmitted to our database unless you sign in or create an account to save them.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. AI Processing & Third-Party Integrations</h2>
            <p>
              Planora integrates with privacy-focused third-party services to deliver an intelligent travel experience:
            </p>
            <ul>
              <li>
                <strong>Google Gemini AI (Itineraries & Chat Assistant):</strong> Trip generation inputs (destination, dates, pacing, interests) and conversational chat messages sent to refine your itinerary are securely processed by Google Gemini models. We <strong>never</strong> send financial credentials, payment card details, or account passwords to Gemini.
              </li>
              <li>
                <strong>Weather Forecasts (Open-Meteo):</strong> Destination coordinate lookups for weather forecasts are requested anonymously from Open-Meteo without transmitting any personal user information.
              </li>
              <li>
                <strong>Travel Reminders & Contact (Resend):</strong> If you opt in to trip countdown reminders or send a support message through our Contact page, transactional emails are dispatched via Resend. You can opt out or unsubscribe from reminder emails at any time.
              </li>
            </ul>
            <div className="legal-highlight-box">
              <strong>Important AI Privacy Commitments:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                <li>Your trip prompts and chat inquiries are processed securely according to enterprise cloud AI safety standards.</li>
                <li>Prices, timings, and venue availability are AI-generated estimates. Please verify details before booking.</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. Web Analytics</h2>
            <p>
              We use <strong>Vercel Web Analytics</strong> to measure general site traffic, page load performance, and error diagnostics. Vercel Web Analytics is privacy-friendly, does not track you across other sites, and does not use invasive third-party tracking cookies.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. How to Delete Your Account and All Data</h2>
            <p>
              You maintain complete ownership and control of your data. You can permanently delete your account and all associated itineraries at any time:
            </p>
            <ul>
              <li>Open your <strong>Dashboard &gt; Settings</strong> tab.</li>
              <li>Under the <strong>Danger Zone</strong> card, click the <strong>Delete Account & Trips</strong> button.</li>
              <li>Upon confirmation, your profile, credentials, and every itinerary saved in the Neon PostgreSQL database are permanently erased immediately.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Legal & Support Contacts</h2>
            <div className="legal-highlight-box">
              <p style={{ margin: '0 0 8px' }}><strong>Official contact & policy governance:</strong></p>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li><strong>Contact & Privacy Email:</strong> <a href="mailto:planora.coresupport@gmail.com">planora.coresupport@gmail.com</a></li>
                <li><strong>Data Retention Period:</strong> 12 months from last login activity for inactive accounts; active accounts retain trips until manually deleted in Settings.</li>
                <li><strong>Governing Jurisdiction:</strong> Republic of India and applicable data privacy frameworks.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
      <AppFooter onNavigate={onNavigate || onBack} />
    </div>
  )
}

// 3. CONTACT PAGE COMPONENT
export function ContactPage({ onBack, onNavigate }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'General Feedback',
    message: '',
    website: '' // honeypot
  })
  const [status, setStatus] = useState('idle') // idle | sending | success | error
  const [statusMessage, setStatusMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    setStatusMessage('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.topic,
          message: formData.message,
          website: formData.website
        })
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setStatus('success')
        setStatusMessage(`Message sent. We'll reply soon.`)
        setFormData({ name: '', email: '', topic: 'General Feedback', message: '', website: '' })
      } else {
        setStatus('error')
        setStatusMessage(
          data.error || 'Something went wrong. Please email us directly at planora.coresupport@gmail.com.'
        )
      }
    } catch (err) {
      setStatus('error')
      setStatusMessage(
        'Network error. Please email us directly at planora.coresupport@gmail.com.'
      )
    }
  }

  return (
    <div className="legal-page-shell">
      <div className="legal-container">
        <TrustHeader
          tag="Get in Touch"
          title="Contact the Planora Team"
          meta="We'd love to hear from you."
          onBack={onBack}
        />

        <div className="contact-grid">
          {/* Contact Details Card */}
          <div className="contact-info-card">
            <div className="contact-channel">
              <div className="contact-channel-icon" aria-hidden="true">
                <Mail size={18} />
              </div>
              <div>
                <h3>Direct Email Support</h3>
                <p style={{ marginBottom: '6px' }}>Click to email our team directly:</p>
                <a
                  href="mailto:planora.coresupport@gmail.com"
                  className="contact-mailto-link"
                  style={{ color: 'var(--green, #2b5143)', fontWeight: 700, fontSize: '15px', textDecoration: 'underline' }}
                >
                  planora.coresupport@gmail.com
                </a>
              </div>
            </div>

            <div className="contact-channel">
              <div className="contact-channel-icon" aria-hidden="true">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3>Privacy Inquiries</h3>
                <p>For data export or policy requests:</p>
                <a href="mailto:planora.coresupport@gmail.com" style={{ color: 'var(--green, #2b5143)', fontWeight: 600 }}>
                  planora.coresupport@gmail.com
                </a>
              </div>
            </div>

            <div className="legal-highlight-box" style={{ marginTop: 'auto', fontSize: '13px' }}>
              <strong>AI Disclaimer:</strong> Prices, timings, and availability are AI-generated estimates. Please verify before booking.
            </div>
          </div>

          {/* Interactive Contact Form */}
          <div className="contact-form-card">
            {status === 'success' ? (
              <div className="contact-success-banner" role="status" aria-live="polite">
                <CheckCircle2 size={24} aria-hidden="true" />
                <div>
                  <strong>Message sent. We'll reply soon.</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                    Thank you for reaching out. We'll get back to you as soon as possible.
                  </p>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => {
                      setStatus('idle')
                      setStatusMessage('')
                    }}
                    style={{ marginTop: '16px' }}
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form" noValidate>
                {/* Honeypot — visually hidden, bots fill it */}
                <div className="contact-hp-field" aria-hidden="true">
                  <label htmlFor="contact-form-website">Website</label>
                  <input
                    id="contact-form-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-form-name">
                    Your Full Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-form-name"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Alex Morgan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-form-email">
                    Email Address <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-form-email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="you@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-form-topic">Subject or Topic</label>
                  <select
                    id="contact-form-topic"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  >
                    <option value="General Feedback">General Feedback &amp; Ideas</option>
                    <option value="Destination Suggestion">Destination or Currency Suggestion</option>
                    <option value="Bug Report">Technical Bug or Issue</option>
                    <option value="Privacy / Account">Privacy or Account Request</option>
                    <option value="Partnership">Partnerships &amp; Collaborations</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-form-message">
                    Your Message <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="contact-form-message"
                    required
                    rows={4}
                    maxLength={3000}
                    placeholder="Tell us what's on your mind..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                {/* Status announcements (error / rate limit) */}
                {status === 'error' && statusMessage && (
                  <div className="contact-error-banner" role="alert" aria-live="assertive">
                    {statusMessage}
                  </div>
                )}

                <button
                  type="submit"
                  className="button button-dark"
                  style={{ marginTop: '8px' }}
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} aria-hidden="true" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <AppFooter onNavigate={onNavigate || onBack} />
    </div>
  )
}