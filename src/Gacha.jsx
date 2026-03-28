import React, { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CARDS, ALL_CARDS, RARITY_CONFIG } from './data/gachaCards'
import './styles/Gacha.css'

// ─── Constants ─────────────────────────────────────────────────────────────
const UR_PITY_LIMIT = 5
const LS_KEY_PITY   = 'gacha_ur_pity'
const LS_KEY_OWNED  = 'gacha_owned_urs'

// ─── Gacha Engine ──────────────────────────────────────────────────────────
function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function rollNonGuaranteed() {
  const roll = Math.random() * 90
  if (roll < 2)  return 'ultraRare'
  if (roll < 12) return 'rare'
  if (roll < 32) return 'uncommon'
  return 'common'
}

function buildPack(packsWithoutUR, ownedURs = new Set()) {
  const usedIds  = new Set()
  const slots    = []
  const urForced = (packsWithoutUR + 1) >= UR_PITY_LIMIT

  const pickUR = () => {
    // 1. Try to get un-owned UR
    let pool = CARDS.ultraRare.filter(c => !usedIds.has(c.id) && !ownedURs.has(c.id))
    // 2. If user owns all URs, fallback to picking any available UR to prevent crash
    if (pool.length === 0) {
      pool = CARDS.ultraRare.filter(c => !usedIds.has(c.id))
    }
    return pickRandom(pool)
  }

  // Slot 0: Rare guarantee (upgraded to UR on pity or lucky roll)
  if (urForced) {
    const card = pickUR()
    usedIds.add(card.id)
    slots.push(card)
  } else {
    const rarity = Math.random() < 0.02 ? 'ultraRare' : 'rare'
    const card = rarity === 'ultraRare' 
      ? pickUR() 
      : pickRandom(CARDS[rarity].filter(c => !usedIds.has(c.id)))
    usedIds.add(card.id)
    slots.push(card)
  }

  // Remaining 4 slots: standard weighted pull
  while (slots.length < 5) {
    let rarity = rollNonGuaranteed()
    let card = null

    if (rarity === 'ultraRare') {
      card = pickUR()
    } else {
      let pool = CARDS[rarity].filter(c => !usedIds.has(c.id))
      // Absolute fallback just in case we run out of a specific rarity pool
      if (pool.length === 0) pool = ALL_CARDS.filter(c => !usedIds.has(c.id))
      card = pickRandom(pool)
    }
    
    usedIds.add(card.id)
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
  return (
    <div className="odds-panel">
      <h3 className="odds-title">Pack Odds</h3>
      <div className="odds-list">
        {Object.entries(RARITY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="odds-row">
            <span className="odds-dot" style={{ background: cfg.color }} />
            <span className="odds-label">{cfg.label}</span>
            <span className="odds-pct">{cfg.weight}%</span>
          </div>
        ))}
      </div>
      <div className="odds-guarantees">
        <p className="odds-guarantee-item">
          <span className="guarantee-icon rare-icon">R</span>
          Rare guaranteed every pack
        </p>
        <p className="odds-guarantee-item">
          <span className="guarantee-icon ur-icon">UR</span>
          Ultra Rare guaranteed every {UR_PITY_LIMIT} packs
        </p>
      </div>
      <p className="odds-note">5 cards per pack · No duplicates</p>
    </div>
  )
}

function PityCounter({ packsWithoutUR }) {
  const remaining = UR_PITY_LIMIT - packsWithoutUR
  const pct = (packsWithoutUR / UR_PITY_LIMIT) * 100
  return (
    <div className="pity-counter">
      <div className="pity-header">
        <span className="pity-label">UR Pity</span>
        <span className="pity-value" style={{ color: remaining === 1 ? '#DF0A81' : '#00A4A5' }}>
          {remaining === 0 ? '⚡ GUARANTEED NEXT!' : `${remaining} pack${remaining !== 1 ? 's' : ''} left`}
        </span>
      </div>
      <div className="pity-bar-bg">
        <div
          className="pity-bar-fill"
          style={{
            width: `${pct}%`,
            background: pct >= 80
              ? 'linear-gradient(90deg, #DF0A81, #F79321)'
              : 'linear-gradient(90deg, #216D94, #00A4A5)',
          }}
        />
      </div>
      <p className="pity-sub">{packsWithoutUR}/{UR_PITY_LIMIT} packs opened</p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Gacha() {
  const [packsWithoutUR, setPacksWithoutUR] = useState(() => {
    try { return parseInt(localStorage.getItem(LS_KEY_PITY) || '0', 10) }
    catch { return 0 }
  })
  
  const [ownedURs, setOwnedURs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY_OWNED) || '[]')) }
    catch { return new Set() }
  })

  const [phase,        setPhase]        = useState('idle') // idle | cutting | opening
  const [pack,         setPack]         = useState([])
  const [cardIndex,    setCardIndex]    = useState(0)      // card currently on screen
  const [revealedSet,  setRevealedSet]  = useState(new Set()) // which indices are flipped
  const [history,      setHistory]      = useState([])
  const [gotUR,        setGotUR]        = useState(false)
  const [packRotY,     setPackRotY]     = useState(0)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_PITY, String(packsWithoutUR)) }
    catch {}
  }, [packsWithoutUR])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_OWNED, JSON.stringify([...ownedURs])) }
    catch {}
  }, [ownedURs])

  // Click the pack to open it -> trigger cutting phase
  const handlePackClick = useCallback(() => {
    if (phase !== 'idle') return

    const newPack = buildPack(packsWithoutUR, ownedURs)
    const hasUR   = newPack.some(c => c.rarity === 'ultraRare')

    setPack(newPack)
    setCardIndex(0)
    setRevealedSet(new Set())
    setGotUR(hasUR)
    setPacksWithoutUR(hasUR ? 0 : packsWithoutUR + 1)
    
    if (hasUR) {
      // Record any newly pulled URs so they don't roll again
      const pulledURs = newPack.filter(c => c.rarity === 'ultraRare').map(c => c.id)
      setOwnedURs(prev => new Set([...prev, ...pulledURs]))
    }
    
    // Play cutting animation, then transition to opening
    setPackRotY(0)
    setPhase('cutting')
    setTimeout(() => {
      setPhase('opening')
    }, 1200) // Duration of CSS cutting animation
  }, [packsWithoutUR, phase])

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
    setHistory(prev => [pack, ...prev].slice(0, 10))
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

  return (
    <div className="gacha-page">
      {/* ── Header ── */}
      <header className="gacha-header">
        <div className="gacha-header-bg" />
        <div className="gacha-header-content">
          <div className="back-btn-container">
            <Link to="/" className="btn-back-home">&#8592; Back to Home</Link>
          </div>
          <p className="gacha-eyebrow">JKT48 Trading Card Game</p>
          <h1 className="gacha-title">Pack Opening</h1>
          <p className="gacha-subtitle">Pull your favorite JKT48 members in card form</p>
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
              {phase === 'idle' && <span className="pack-click-hint">Click to open</span>}
            </div>

            <PityCounter packsWithoutUR={packsWithoutUR} />
            <RarityOdds />

            {history.length > 0 && (
              <div className="history-section">
                <h3 className="history-title">Recent Pulls</h3>
                <div className="history-list">
                  {history.map((h, hi) => {
                    const stats = getRarityStats(h)
                    return (
                      <div key={hi} className="history-item">
                        <span className="history-num">Pack {history.length - hi}</span>
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
              </div>
            )}
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
                    key={c.id}
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
    </div>
  )
}
