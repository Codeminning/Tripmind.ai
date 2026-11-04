// TripMind AI — Static Pre-rendering (SSG) Script
// Injects the fully rendered static Landing Page HTML into dist/index.html
// so search engines, social crawlers, and "View Page Source" have immediate access
// to hero text, meta tags, sample itineraries, and trust links before JS runs.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distHtmlPath = path.resolve(rootDir, 'dist', 'index.html')

async function prerender() {
  console.log('🌿 [TripMind SSG] Starting static pre-rendering...')

  if (!fs.existsSync(distHtmlPath)) {
    throw new Error(`dist/index.html not found. Run 'vite build' first.`)
  }

  const template = fs.readFileSync(distHtmlPath, 'utf8')

  // Spin up lightweight internal Vite server to load and transform JSX for Node SSR
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    root: rootDir,
    optimizeDeps: {
      noDiscovery: true, // skip the automatic dependency scan entirely
      include: [], // nothing needs pre-bundling for a single SSR load
    },
  })

  try {
    const mainMod = await vite.ssrLoadModule('/src/main.jsx')
    const App = mainMod.default

    if (!App) {
      throw new Error('Default export App not found in /src/main.jsx')
    }

    // Render static markup of the landing page
    const appHtml = renderToString(React.createElement(App))

    // Inject into <div id="root"></div>
    const prerenderedHtml = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    )

    fs.writeFileSync(distHtmlPath, prerenderedHtml, 'utf8')

    console.log(`✅ [TripMind SSG] Successfully pre-rendered landing page (${appHtml.length.toLocaleString()} bytes injected).`)

    // Verify key search & social crawler expectations
    const verifyHero = prerenderedHtml.includes('Your trip') && prerenderedHtml.includes('thoughtfully planned')
    const verifySubheadline = prerenderedHtml.includes('day-by-day itinerary')
    const verifySample = prerenderedHtml.includes('Jaipur') || prerenderedHtml.includes('Johari Bazaar')
    const verifyMeta = prerenderedHtml.includes('og:title') && prerenderedHtml.includes('description')

    console.log(`🔍 [TripMind SSG Verification]:`)
    console.log(`   - Hero Title in raw HTML: ${verifyHero ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`   - Subheadline in raw HTML: ${verifySubheadline ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`   - Sample Itinerary in raw HTML: ${verifySample ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`   - Meta Tags in raw HTML: ${verifyMeta ? '✅ PASS' : '❌ FAIL'}`)

    if (!verifyHero || !verifySubheadline || !verifyMeta) {
      throw new Error('Static pre-rendering verification failed — content missing in raw HTML.')
    }
  } finally {
    await vite.close()
  }
}

prerender().catch(err => {
  console.error('❌ [TripMind SSG Error]:', err)
  process.exit(1)
})

