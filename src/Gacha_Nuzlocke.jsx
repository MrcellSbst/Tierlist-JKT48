import React, { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CARDS, ALL_CARDS, RARITY_CONFIG } from './data/gachaCards'
import './styles/Gacha.css'

// ─── Constants ─────────────────────────────────────────────────────────────
const LS_KEY_COLLECTION = 'nuzlocke_collection'
const LS_KEY_PACK_TIMESTAMPS = 'nuzlocke_pack_timestamps'
const LS_KEY_HISTORY = 'nuzlocke_history'
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour
const MAX_PACKS = 10

// ─── Gacha Engine (Nuzlocke - Pure Random) ─────────────────────────────────
function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function rollRarity() {
  const roll = Math.random() * 100
  if (roll < 0.5) return 'ultraRare'
  if (roll < 5) return 'rare'
  if (roll < 40) return 'uncommon'
  return 'common'
}

function buildPack() {
  const slots = []
  
  for (let i = 0; i < 5; i++) {
    const rarity = rollRarity()
    const card = pickRandom(CARDS[rarity])
    slots.push(card)
  }

  // Sort lowest → highest rarity (common first, ultraRare last)
  const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, ultraRare: 3 }
  return slots.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function RevealCard({ card, isRevealed, onFlip }) {
  const cfg = RARITY_CONFIG[card.rarity]
  return (
    <div className="reveal-stage">
      {/* Rarity label — hidden by CSS until revealed so layout doesn't shift */}
      <div className={`card-rarity-label ${isRevealed ? 'label-visible' : ''}`} style={{ color: cfg.color }}>
        <span className="card-rarity-dot" style={{ background: cfg.color }} />
        {cfg.label}
      </div>

      <div
        className={`gacha-card single-card ${card.rarity} ${isRevealed ? 'revealed' : ''}`}
        onClick={!isRevealed ? onFlip : undefined}
        style={{ '--glow-color': cfg.glow, '--card-color': cfg.color }}
      >
        <div className="gacha-card-inner">
          {/* Back */}
          <div className="gacha-card-back">
            <img src="/asset/Gacha/Pack and Backsides/Card_Backside.png" className="card-back-img" alt="Card Back" />
            {!isRevealed && <span className="card-tap-hint">Tap to reveal</span>}
          </div>

          {/* Front */}
          <div className="gacha-card-front">
            {card.rarity === 'ultraRare' && (
              <div className="holo-overlay" aria-hidden="true" />
            )}
            <img src={card.img} alt={card.name} className="card-img" />
            <div className="card-name">{card.name}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RarityOdds() {
  const NUZLOCKE_RATES = {
    common: { label: 'Common', color: '#a0a0b0', weight: 60 },
    uncommon: { label: 'Uncommon', color: '#4ade80', weight: 35 },
    rare: { label: 'Rare', color: '#60a5fa', weight: 4.5 },
    ultraRare: { label: 'Ultra Rare', color: '#f59e0b', weight: 0.5 },
  }
  
  return (
    <div className="odds-panel">
      <h3 className="odds-title">Pack Odds</h3>
      <div className="odds-list">
        {Object.entries(NUZLOCKE_RATES).map(([key, cfg]) => (
          <div key={key} className="odds-row">
            <span className="odds-dot" style={{ background: cfg.color }} />
            <span className="odds-label">{cfg.label}</span>
            <span className="odds-pct">{cfg.weight}%</span>
          </div>
        ))}
      </div>
      <div className="odds-guarantees">
        <p className="odds-guarantee-item">
          <span className="guarantee-icon rare-icon">⚠</span>
          No guarantees - pure luck
        </p>
        <p className="odds-guarantee-item">
          <span className="guarantee-icon ur-icon">⚠</span>
          Duplicates allowed in packs
        </p>
      </div>
      <p className="odds-note">5 cards per pack · Hardcore mode</p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GachaNuzlocke() {
  const [cardCollection, setCardCollection] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_COLLECTION) || '{}') }
    catch { return {} }
  })

  const [phase,        setPhase]        = useState('idle')
  const [pack,         setPack]         = useState([])
  const [cardIndex,    setCardIndex]    = useState(0)
  const [revealedSet,  setRevealedSet]  = useState(new Set())
  const [history,      setHistory]      = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_HISTORY) || '[]') }
    catch { return [] }
  })
  const [gotUR,        setGotUR]        = useState(false)
  const [packRotY,     setPackRotY]     = useState(0)
  const [showCollection, setShowCollection] = useState(false)
  const [zoomedCard,     setZoomedCard]     = useState(null)
  const [packTimestamps, setPackTimestamps] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY_PACK_TIMESTAMPS) || '[]')
      const now = Date.now()
      const oldest = Math.min(...stored)
      const elapsed = now - oldest
      const regeneratedPacks = Math.floor(elapsed / COOLDOWN_MS)
      const sorted = [...stored].sort((a, b) => a - b)
      return sorted.slice(regeneratedPacks)
    }
    catch { return [] }
  })
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      setPackTimestamps(prev => {
        if (prev.length === 0) return prev
        const now = Date.now()
        const oldest = Math.min(...prev)
        const elapsed = now - oldest
        const regeneratedPacks = Math.floor(elapsed / COOLDOWN_MS)
        
        if (regeneratedPacks === 0) return prev
        
        const sorted = [...prev].sort((a, b) => a - b)
        const remaining = sorted.slice(regeneratedPacks)
        return remaining.length !== prev.length ? remaining : prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const availablePacks = (() => {
    return MAX_PACKS - packTimestamps.length
  })()

  const nextPackReady = (() => {
    if (packTimestamps.length === 0) return null
    const oldest = Math.min(...packTimestamps)
    return new Date(oldest + COOLDOWN_MS)
  })()

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_COLLECTION, JSON.stringify(cardCollection)) }
    catch {}
  }, [cardCollection])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_PACK_TIMESTAMPS, JSON.stringify(packTimestamps)) }
    catch {}
  }, [packTimestamps])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(history)) }
    catch {}
  }, [history])

  // Click the pack to open it -> trigger cutting phase
  const handlePackClick = useCallback(() => {
    if (phase !== 'idle') return
    if (availablePacks <= 0) return

    const newPack = buildPack()
    const hasUR   = newPack.some(c => c.rarity === 'ultraRare')

    setPack(newPack)
    setCardIndex(0)
    setRevealedSet(new Set())
    setGotUR(hasUR)
    setPackTimestamps(prev => [...prev, Date.now()])

    // Track ALL pulled cards in the collection (duplicates counted)
    setCardCollection(prev => {
      const next = { ...prev }
      newPack.forEach(c => {
        next[c.id] = (next[c.id] || 0) + 1
      })
      return next
    })
    
    // Play cutting animation, then transition to opening
    setPackRotY(0)
    setPhase('cutting')
    setTimeout(() => {
      setPhase('opening')
    }, 1200)
  }, [phase, availablePacks])

  // Mouse move for 3D Pack rotation
  const handlePackHover = useCallback((e) => {
    if (phase !== 'idle') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    // rotate between -35deg to 35deg based on cursor X position
    const rotation = ((x / rect.width) - 0.5) * 70
    setPackRotY(rotation)
  }, [phase])

  const handlePackLeave = useCallback(() => {
    if (phase !== 'idle') return
    setPackRotY(0) // Smoothly reset to default
  }, [phase])

  // Flip the currently shown card
  const handleFlipCurrent = useCallback(() => {
    setRevealedSet(prev => new Set([...prev, cardIndex]))
  }, [cardIndex])

  // Navigate left / right
  const handleNav = useCallback((dir) => {
    setCardIndex(prev => Math.min(4, Math.max(0, prev + dir)))
  }, [])

  const handleDone = useCallback(() => {
    setHistory(prev => [{ cards: pack, timestamp: Date.now() }, ...prev].slice(0, 10))
    setPhase('idle')
  }, [pack])

  const getRarityStats = (p) => {
    const counts = {}
    p.forEach(c => {
      const label = RARITY_CONFIG[c.rarity].label
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }

  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown'
    const date = new Date(ts)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  return (
    <div className="gacha-page gacha-nuzlocke">
      {/* ── Header ── */}
      <header className="gacha-header">
        <div className="gacha-header-bg" />
        <div className="gacha-header-content">
          <div className="back-btn-container">
            <Link to="/gacha" className="btn-back-home">&#8592; Back to Normal Pack</Link>
          </div>
          <p className="gacha-eyebrow">JKT48 Trading Card Game</p>
          <h1 className="gacha-title">Nuzlocke Mode</h1>
          <p className="gacha-subtitle">Hardcore pack opening - no pity, no guarantees</p>
        </div>
      </header>

      <main className="gacha-main">
        {/* ── IDLE / CUTTING Phase ── */}
        {(phase === 'idle' || phase === 'cutting') && (
          <div className="gacha-idle">
            {/* 3D Pack Visual */}
            <div 
              className={`pack-container ${phase === 'cutting' ? 'is-cutting' : ''}`}
              onMouseMove={handlePackHover}
              onMouseLeave={handlePackLeave}
              onClick={phase === 'idle' ? handlePackClick : undefined}
              style={{ '--pack-ry': `${packRotY}deg` }}
            >
              <div className="pack-3d-model">
                {/* Pack Top Half (flies off during cut) */}
                <div className="pack-half pack-top">
                  <img src="/asset/Gacha/Pack and Backsides/Pack_Frontside.png" className="pack-face pack-front" alt="Pack Front Top" />
                  <img src="/asset/Gacha/Pack and Backsides/Pack_Backside.png" className="pack-face pack-back" alt="Pack Back Top" />
                </div>
                {/* Pack Bottom Half */}
                <div className="pack-half pack-bottom">
                  <img src="/asset/Gacha/Pack and Backsides/Pack_Frontside.png" className="pack-face pack-front" alt="Pack Front Bottom" />
                  <img src="/asset/Gacha/Pack and Backsides/Pack_Backside.png" className="pack-face pack-back" alt="Pack Back Bottom" />
                </div>
              </div>
              <div className="pack-slash" aria-hidden="true" />
              {phase === 'idle' && availablePacks > 0 && <span className="pack-click-hint">Click to open</span>}
              {phase === 'idle' && availablePacks <= 0 && <span className="pack-click-hint cooldown-hint">No packs available - wait for cooldown</span>}
            </div>

            <div className="pack-status-panel">
              <div className="pack-status-item">
                <span className="pack-status-label">Available Packs</span>
                <span className="pack-status-value">{availablePacks}/{MAX_PACKS}</span>
              </div>
              {nextPackReady && availablePacks < MAX_PACKS && (
                <div className="pack-status-item">
                  <span className="pack-status-label">Next pack in</span>
                  <span className="pack-status-value countdown">
                    {Math.floor((nextPackReady.getTime() - now) / 60000)}m {Math.floor(((nextPackReady.getTime() - now) % 60000) / 1000)}s
                  </span>
                </div>
              )}
            </div>
            <RarityOdds />

            <div className="history-section">
              <div className="history-section-header">
                <h3 className="history-title">Recent Pulls</h3>
                <button
                  className="btn-collection-open"
                  onClick={() => setShowCollection(true)}
                >
                  OshiDex
                </button>
              </div>
              {history.length > 0 && (
                <div className="history-list">
                  {history.map((h, hi) => {
                    const cards = Array.isArray(h) ? h : h.cards
                    const timestamp = Array.isArray(h) ? null : h.timestamp
                    const stats = getRarityStats(cards)
                    return (
                      <div key={hi} className="history-item">
                        <span className="history-num">{formatTimestamp(timestamp)}</span>
                        <div className="history-badges">
                          {Object.entries(stats).map(([label, count]) => {
                            const cfg = Object.values(RARITY_CONFIG).find(c => c.label === label)
                            return (
                              <span
                                key={label}
                                className="history-badge"
                                style={{
                                  background: cfg?.color + '26',
                                  border: `1px solid ${cfg?.color}`,
                                  color: cfg?.color,
                                }}
                              >
                                {count}× {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── OPENING Phase — one card at a time with nav ── */}
        {phase === 'opening' && (() => {
          const allRevealed = revealedSet.size === 5
          const isRevealed  = revealedSet.has(cardIndex)
          return (
            <div className="gacha-opening">
              {/* Progress dots */}
              <div className="card-progress">
                {pack.map((c, i) => (
                  <span
                    key={`${c.id}-${i}`}
                    className={`progress-dot ${revealedSet.has(i) ? 'dot-revealed' : ''} ${i === cardIndex ? 'dot-current' : ''}`}
                    style={revealedSet.has(i) ? { background: RARITY_CONFIG[c.rarity].color } : {}}
                    onClick={() => setCardIndex(i)}
                    title={`Card ${i + 1}`}
                  />
                ))}
              </div>

              {/* UR banner */}
              {gotUR && allRevealed && (
                <div className="ur-banner">⚡ Ultra Rare Pulled! ⚡</div>
              )}

              {/* Card + left/right nav row */}
              <div className="reveal-row">
                <button
                  className="nav-btn"
                  onClick={() => handleNav(-1)}
                  disabled={cardIndex === 0}
                  aria-label="Previous card"
                >
                  &#8592;
                </button>

                <RevealCard
                  key={cardIndex}
                  card={pack[cardIndex]}
                  isRevealed={isRevealed}
                  onFlip={handleFlipCurrent}
                />

                <button
                  className="nav-btn"
                  onClick={() => handleNav(1)}
                  disabled={cardIndex === 4}
                  style={{ visibility: isRevealed ? 'visible' : 'hidden' }}
                  aria-label="Next card"
                >
                  &#8594;
                </button>
              </div>

              {/* Counter label */}
              <p className="card-counter">{cardIndex + 1} / 5</p>

              {/* Done button once all revealed */}
              {allRevealed && (
                <button className="btn-open-pack" onClick={handleDone}>
                  <span className="btn-shine" />
                  Open Another Pack
                </button>
              )}
            </div>
          )
        })()}
      </main>

      {/* ── Collection Modal ── */}
      {showCollection && (
        <div className="collection-modal-overlay" onClick={() => setShowCollection(false)}>
          <div className="collection-modal" onClick={e => e.stopPropagation()}>
            <div className="collection-modal-header">
              <h2 className="collection-modal-title">OshiDex</h2>
              <button className="collection-modal-close" onClick={() => setShowCollection(false)} aria-label="Close">×</button>
            </div>
            <div className="collection-modal-body">
              {['ultraRare', 'rare', 'uncommon', 'common'].map(rarity => {
                const cfg = RARITY_CONFIG[rarity]
                const allOfRarity = ALL_CARDS.filter(c => c.rarity === rarity)
                const collected = allOfRarity.filter(c => cardCollection[c.id])
                return (
                  <div key={rarity} className="collection-rarity-group">
                    <div className="collection-rarity-label" style={{ color: cfg.color }}>
                      <span className="odds-dot" style={{ background: cfg.color }} />
                      {cfg.label}
                      <span className="collection-rarity-count">{collected.length}/{allOfRarity.length} collected</span>
                    </div>
                    <div className="collection-grid">
                      {allOfRarity.map(card => {
                        const owned = cardCollection[card.id] || 0
                        if (owned === 0) {
                          return (
                            <div key={card.id} className="collection-card collection-card-locked">
                              <div className="collection-card-img-wrap collection-card-locked-wrap">
                                <span className="collection-card-question">?</span>
                              </div>
                              <span className="collection-card-name collection-card-name-locked">???</span>
                            </div>
                          )
                        }
                        return (
                          <div
                            key={card.id}
                            className="collection-card"
                            onClick={() => setZoomedCard({ card, cfg })}
                            title="Click to zoom"
                          >
                            <div className="collection-card-img-wrap" style={{ '--glow': cfg.glow }}>
                              <img src={card.img} alt={card.name} className="collection-card-img" />
                              {owned > 1 && (
                                <span className="collection-count-badge">×{owned}</span>
                              )}
                            </div>
                            <span className="collection-card-name">{card.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Card Zoom Lightbox (inside modal so it layers correctly) ── */}
            {zoomedCard && (
              <div
                className="card-zoom-overlay"
                onClick={() => setZoomedCard(null)}
              >
                <div className="card-zoom-content" onClick={e => e.stopPropagation()}>
                  <div
                    className="card-zoom-img-wrap"
                    style={{ '--glow': zoomedCard.cfg.glow, '--card-color': zoomedCard.cfg.color }}
                  >
                    <img
                      src={zoomedCard.card.img}
                      alt={zoomedCard.card.name}
                      className="card-zoom-img"
                    />
                    {zoomedCard.card.rarity === 'ultraRare' && (
                      <div className="holo-overlay" aria-hidden="true" />
                    )}
                    {cardCollection[zoomedCard.card.id] > 1 && (
                      <span className="collection-count-badge card-zoom-badge">
                        ×{cardCollection[zoomedCard.card.id]} owned
                      </span>
                    )}
                  </div>
                  <p className="card-zoom-name" style={{ color: zoomedCard.cfg.color }}>
                    {zoomedCard.card.name}
                  </p>
                  <p className="card-zoom-rarity">{zoomedCard.cfg.label}</p>
                  <button
                    className="card-zoom-close"
                    onClick={() => setZoomedCard(null)}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
