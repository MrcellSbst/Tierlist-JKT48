import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    insertCoin,
    myPlayer,
    isHost,
    setState,
    getRoomCode,
    RPC,
    useMultiplayerState,
    usePlayersList,
    useIsHost,
} from 'playroomkit';
import * as memberData from './data/memberData';
import './GuessWho.css';

// ─── Name formatter (exact same logic as Tierlist.jsx) ───────────────────────
const formatMemberName = (filename) => {
    if (!filename || typeof filename !== 'string') return '';
    const baseName = filename.split('/').pop().split('.')[0];
    const parts = baseName.split('_').filter(Boolean);
    const firstPart = parts[0] || '';
    if (/^jkt48vgen\d+$/i.test(firstPart))
        return parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    if (firstPart.toUpperCase() === 'JKT48V') {
        const rest = parts.slice(1);
        const afterGen = rest[0]?.toLowerCase().startsWith('gen') ? rest.slice(1) : rest;
        return afterGen.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    if (parts[0]?.toLowerCase().startsWith('gen'))
        return parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const getGenNumber = (filename) => {
    const base = filename.split('/').pop();
    if (/^jkt48vgen(\d+)_/i.test(base)) return `vgen${base.match(/^jkt48vgen(\d+)_/i)[1]}`;
    if (/^JKT48V_Gen(\d+)_/i.test(base)) return `vgen${base.match(/^JKT48V_Gen(\d+)_/i)[1]}`;
    if (/^Gen(\d+)_/i.test(base)) return `gen${base.match(/^Gen(\d+)_/i)[1]}`;
    return 'unknown';
};

const getGenLabel = (filename) => {
    const base = filename.split('/').pop();
    if (/^jkt48vgen(\d+)_/i.test(base)) return `V-Gen ${base.match(/^jkt48vgen(\d+)_/i)[1]}`;
    if (/^JKT48V_Gen(\d+)_/i.test(base)) return `V-Gen ${base.match(/^JKT48V_Gen(\d+)_/i)[1]}`;
    if (/^Gen(\d+)_/i.test(base)) return `Gen ${base.match(/^Gen(\d+)_/i)[1]}`;
    return '?';
};

const getTeamForFile = (filename) => {
    const base = filename.split('/').pop().toLowerCase();
    if ((memberData.tim_love || []).some(f => f.toLowerCase() === base)) return 'Tim Love';
    if ((memberData.tim_dream || []).some(f => f.toLowerCase() === base)) return 'Tim Dream';
    if ((memberData.tim_passion || []).some(f => f.toLowerCase() === base)) return 'Tim Passion';
    return null;
};

const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const buildMemberPool = ({ memberStatus, generation, team }) => {
    let pool = [];
    if (memberStatus === 'active' || memberStatus === 'all')
        (memberData.activeMemberFiles || []).forEach(f =>
            pool.push({ filename: f, isActive: true, src: `/asset/member_active/${f}` }));
    if (memberStatus === 'ex' || memberStatus === 'all')
        (memberData.exMemberFiles || []).forEach(f =>
            pool.push({ filename: f, isActive: false, src: `/asset/exmember/${f.replace(/\\/g, '/')}` }));
    if (generation !== 'all')
        pool = pool.filter(m => getGenNumber(m.filename) === generation);
    if (team && team !== 'all') {
        if (team === 'no-team') pool = pool.filter(m => !getTeamForFile(m.filename));
        else {
            const label = { tim_love: 'Tim Love', tim_dream: 'Tim Dream', tim_passion: 'Tim Passion' }[team];
            pool = pool.filter(m => getTeamForFile(m.filename) === label);
        }
    }
    return pool.map(m => ({
        ...m,
        name: formatMemberName(m.filename),
        generation: getGenLabel(m.filename),
        genKey: getGenNumber(m.filename),
        team: getTeamForFile(m.filename),
    }));
};

const GEN_OPTIONS = [
    { value: 'all', label: 'All Generations' },
    ...Array.from({ length: 14 }, (_, i) => ({ value: `gen${i + 1}`, label: `Gen ${i + 1}` })),
    { value: 'vgen1', label: 'V-Gen 1' }, { value: 'vgen2', label: 'V-Gen 2' },
];

const TEAM_OPTIONS = [
    { value: 'all', label: 'All Teams' },
    { value: 'tim_love', label: 'Tim Love' },
    { value: 'tim_dream', label: 'Tim Dream' },
    { value: 'tim_passion', label: 'Tim Passion' },
    { value: 'no-team', label: 'No Team' },
];

// ────────────────────────────────────────────────────────────────────────────
// ROOT
// ────────────────────────────────────────────────────────────────────────────
export default function GuessWho() {
    const [screen, setScreen] = useState('menu');
    const [filters, setFilters] = useState({ memberStatus: 'active', generation: 'all', team: 'all' });

    return (
        <div className="gw-root">
            <div className="gw-bg" />
            {screen === 'menu' && <MenuScreen onPick={s => setScreen(s)} />}
            {screen === 'setup-single' && (
                <SetupScreen title="⚡ Single Player" filters={filters} setFilters={setFilters}
                    onBack={() => setScreen('menu')} onStart={() => setScreen('single')} />
            )}
            {screen === 'setup-multi' && (
                <SetupScreen title="🌐 Online Multiplayer" filters={filters} setFilters={setFilters}
                    onBack={() => setScreen('menu')} onStart={() => setScreen('multi')} isMulti />
            )}
            {screen === 'single' && <SingleGame filters={filters} onBack={() => setScreen('menu')} />}
            {screen === 'multi' && <MultiLobby filters={filters} onBack={() => setScreen('menu')} />}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MENU
// ────────────────────────────────────────────────────────────────────────────
function MenuScreen({ onPick }) {
    return (
        <div className="gw-screen gw-menu">
            <div className="gw-logo-wrap">
                <div className="gw-logo-board">
                    {['🙂', '😎', '😊', '🤔', '😄', '😃'].map((e, i) => (
                        <div key={i} className="gw-logo-card">{e}</div>
                    ))}
                </div>
                <h1 className="gw-logo-title">
                    <span className="gw-logo-jkt">JKT48</span>
                    <span className="gw-logo-gw">Guess Who?</span>
                </h1>
                <p className="gw-logo-sub">The classic face-off game — JKT48 edition!</p>
            </div>
            <div className="gw-menu-cards">
                <button className="gw-menu-card" id="btn-single" onClick={() => onPick('setup-single')}>
                    <div className="gw-menu-card-icon">⚡</div>
                    <div className="gw-menu-card-label">Single Player</div>
                    <div className="gw-menu-card-desc">Flip cards, ask yourself yes/no questions, and guess the secret member!</div>
                </button>
                <button className="gw-menu-card" id="btn-multi" onClick={() => onPick('setup-multi')}>
                    <div className="gw-menu-card-icon">🌐</div>
                    <div className="gw-menu-card-label">Online Multiplayer</div>
                    <div className="gw-menu-card-desc">Play with friends online via a room code. Chat, flip cards, guess the host's secret!</div>
                </button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// SETUP
// ────────────────────────────────────────────────────────────────────────────
function SetupScreen({ title, filters, setFilters, onBack, onStart, isMulti }) {
    const pool = buildMemberPool(filters);
    return (
        <div className="gw-screen gw-setup">
            <button className="gw-btn-back" onClick={onBack}>← Back</button>
            <h2 className="gw-setup-title">{title} — Setup</h2>
            <div className="gw-setup-card">
                <div className="gw-filter-section">
                    <div className="gw-filter-group">
                        <label className="gw-filter-label">Member Status</label>
                        <div className="gw-pills">
                            {[['active', '✨ Active'], ['ex', '🎓 Ex-Member'], ['all', '🌟 All']].map(([v, l]) => (
                                <button key={v} className={`gw-pill ${filters.memberStatus === v ? 'gw-pill-on' : ''}`}
                                    onClick={() => setFilters(f => ({ ...f, memberStatus: v }))}>{l}</button>
                            ))}
                        </div>
                    </div>
                    <div className="gw-filter-row">
                        <div className="gw-filter-group">
                            <label className="gw-filter-label">Generation</label>
                            <select className="gw-select" value={filters.generation}
                                onChange={e => setFilters(f => ({ ...f, generation: e.target.value }))}>
                                {GEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="gw-filter-group">
                            <label className="gw-filter-label">Team</label>
                            <select className="gw-select" value={filters.team}
                                onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}>
                                {TEAM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="gw-pool-info">
                    <span className="gw-pool-num">{pool.length}</span> members in pool
                    {pool.length < 4 && <span className="gw-pool-warn"> — need at least 4</span>}
                </div>
                {isMulti && (
                    <div className="gw-setup-note">
                        <span className="gw-note-icon">🌐</span>
                        A room will be created. Share the <strong>room code</strong> with friends to join!
                        The host secretly picks a member — everyone else guesses through chat.
                    </div>
                )}
            </div>
            <button className="gw-btn-start" disabled={pool.length < 4} onClick={onStart}>
                {isMulti ? 'Create Room 🚀' : 'Start Game 🚀'}
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MEMBER CARD
// ────────────────────────────────────────────────────────────────────────────
function MemberCard({ member, eliminated, onClick, highlight }) {
    return (
        <div className={`gw-card ${eliminated ? 'gw-card-out' : ''} ${highlight ? 'gw-card-secret' : ''}`}
            onClick={onClick} title={eliminated ? 'Eliminated' : member.name}>
            <div className="gw-card-inner">
                <div className="gw-card-front">
                    <div className="gw-card-frame">
                        <div className="gw-card-photo-wrap">
                            <img className="gw-card-photo" src={member.src} alt={member.name}
                                draggable={false} loading="lazy"
                                onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                        <div className="gw-card-name">{member.name}</div>
                    </div>
                </div>
                <div className="gw-card-back"><div className="gw-card-back-inner">❌</div></div>
            </div>
            {highlight && <div className="gw-card-secret-badge">SECRET</div>}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// BOARD
// ────────────────────────────────────────────────────────────────────────────
function Board({ members, eliminated, onToggle, revealedFilename }) {
    return (
        <div className="gw-board">
            <div className="gw-board-frame">
                <div className="gw-board-grid">
                    {members.map(m => (
                        <MemberCard key={m.filename} member={m}
                            eliminated={eliminated.has(m.filename)}
                            onClick={() => onToggle(m.filename)}
                            highlight={revealedFilename === m.filename} />
                    ))}
                </div>
                <div className="gw-board-trays">
                    {[0, 1, 2, 3].map(i => <div key={i} className="gw-board-tray" />)}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// SECRET PEEK CARD
// ────────────────────────────────────────────────────────────────────────────
function SecretCard({ member, revealed }) {
    return (
        <div className={`gw-secret-wrap ${revealed ? 'gw-secret-revealed' : ''}`}>
            <div className="gw-secret-label">Your Secret Member</div>
            <div className="gw-secret-card">
                {revealed ? (
                    <>
                        <div className="gw-secret-frame">
                            <img className="gw-secret-photo" src={member.src} alt={member.name}
                                onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                        <div className="gw-secret-name">{member.name}</div>
                        <div className="gw-secret-meta">{member.generation}{member.team ? ` • ${member.team}` : ''}</div>
                    </>
                ) : (
                    <div className="gw-secret-hidden">
                        <div className="gw-secret-qmark">?</div>
                        <div className="gw-secret-tap">Hover / tap to peek</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// SINGLE PLAYER
// ────────────────────────────────────────────────────────────────────────────
function SingleGame({ filters, onBack }) {
    const [pool] = useState(() => shuffle(buildMemberPool(filters)).slice(0, 24));
    const [secretMember] = useState(() => {
        const p = buildMemberPool(filters);
        return p[Math.floor(Math.random() * p.length)];
    });
    const [eliminated, setEliminated] = useState(new Set());
    const [guessInput, setGuessInput] = useState('');
    const [phase, setPhase] = useState('play');
    const [revealSecret, setRevealSecret] = useState(false);
    const [peekOpen, setPeekOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [guessHistory, setGuessHistory] = useState([]);

    const toggle = (filename) => {
        if (phase !== 'play') return;
        setEliminated(prev => {
            const next = new Set(prev);
            if (next.has(filename)) next.delete(filename); else next.add(filename);
            return next;
        });
    };

    const handleGuess = () => {
        const g = guessInput.trim();
        if (!g) return;
        const isCorrect = g.toLowerCase() === secretMember.name.toLowerCase();
        setGuessHistory(h => [{ guess: g, correct: isCorrect }, ...h]);
        setGuessInput('');
        if (isCorrect) { setPhase('won'); setRevealSecret(true); setMessage(`🎉 Correct! The secret member was ${secretMember.name}!`); }
        else setMessage(`❌ "${g}" is wrong — keep eliminating!`);
    };

    return (
        <div className="gw-screen gw-game-screen">
            <div className="gw-topbar">
                <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                <div className="gw-topbar-center">
                    <div className="gw-stat-pill">🃏 {pool.length - eliminated.size} remaining</div>
                    {eliminated.size > 0 && <div className="gw-stat-pill gw-stat-elim">❌ {eliminated.size} out</div>}
                </div>
                <button className="gw-btn-reveal" onClick={() => { setPhase('revealed'); setRevealSecret(true); setMessage(`The secret was ${secretMember.name}!`); }}
                    disabled={phase !== 'play'}>Give Up 🏳️</button>
            </div>
            {message && <div className={`gw-message-banner ${phase === 'won' ? 'gw-msg-win' : phase === 'revealed' ? 'gw-msg-reveal' : 'gw-msg-wrong'}`}>{message}</div>}
            <div className="gw-game-layout">
                <div className="gw-board-col">
                    <div className="gw-board-instructions">Click a card to fold it down (eliminate). Guess who the secret member is!</div>
                    <Board members={pool} eliminated={eliminated} onToggle={toggle} revealedFilename={revealSecret ? secretMember.filename : null} />
                </div>
                <div className="gw-sidebar">
                    <div onMouseEnter={() => setPeekOpen(true)} onMouseLeave={() => setPeekOpen(false)} onClick={() => setPeekOpen(p => !p)} style={{ cursor: 'pointer' }}>
                        <SecretCard member={secretMember} revealed={peekOpen || revealSecret} />
                    </div>
                    {phase === 'play' && (
                        <div className="gw-guess-form">
                            <div className="gw-guess-label">Make your final guess:</div>
                            <div className="gw-guess-row">
                                <input className="gw-guess-input" placeholder="Type member name..." value={guessInput}
                                    onChange={e => setGuessInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGuess()}
                                    list="gw-member-list-sp" />
                                <datalist id="gw-member-list-sp">{pool.map(m => <option key={m.filename} value={m.name} />)}</datalist>
                                <button className="gw-btn-guess" onClick={handleGuess}>Guess!</button>
                            </div>
                        </div>
                    )}
                    <div className="gw-hint-guide">
                        <div className="gw-guide-title">💡 How to Play</div>
                        <ul className="gw-guide-list">
                            <li>Peek at your <strong>secret member</strong></li>
                            <li>Ask yourself yes/no questions about her traits</li>
                            <li><strong>Click cards</strong> to fold down members that don't match</li>
                            <li>When confident — type her name and guess!</li>
                        </ul>
                    </div>
                    <div className="gw-question-ideas">
                        <div className="gw-guide-title">❓ Question Ideas</div>
                        <div className="gw-q-chips">
                            <span className="gw-q-chip">Active member?</span>
                            <span className="gw-q-chip">Gen {secretMember?.generation?.replace('Gen ', '')}?</span>
                            {secretMember?.team && <span className="gw-q-chip">{secretMember.team}?</span>}
                        </div>
                    </div>
                    {guessHistory.length > 0 && (
                        <div className="gw-guess-history">
                            <div className="gw-guide-title">📋 Guess Log</div>
                            {guessHistory.map((h, i) => (
                                <div key={i} className={`gw-guess-log-item ${h.correct ? 'correct' : 'wrong'}`}>{h.correct ? '✅' : '❌'} {h.guess}</div>
                            ))}
                        </div>
                    )}
                    {(phase === 'won' || phase === 'revealed') && (
                        <button className="gw-btn-start gw-btn-again" onClick={() => window.location.reload()}>Play Again 🔄</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE MULTIPLAYER — LOBBY INIT
// ────────────────────────────────────────────────────────────────────────────
function MultiLobby({ filters, onBack }) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    const pool = useMemo(() => shuffle(buildMemberPool(filters)).slice(0, 24), []);

    useEffect(() => {
        insertCoin({
            gameId: 'JKT48GuessWho',
            maxPlayersPerRoom: 8,
        })
            .then(() => {
                // Host sets the pool order so all clients use same ordering
                if (isHost()) {
                    setState('poolOrder', pool.map(m => m.filename), true);
                    setState('phase', 'picking', true);
                }
                setReady(true);
            })
            .catch(err => setError(err?.message || 'Connection failed'));
    }, []);

    if (error) return (
        <div className="gw-screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="gw-error-card">
                <div className="gw-error-icon">⚠️</div>
                <div className="gw-error-text">{error}</div>
                <button className="gw-btn-back" onClick={onBack}>← Back to Menu</button>
            </div>
        </div>
    );

    if (!ready) return (
        <div className="gw-screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="gw-connecting">
                <div className="gw-connecting-spinner" />
                <div className="gw-connecting-text">Connecting to room…</div>
            </div>
        </div>
    );

    return <OnlineGame allPool={pool} filters={filters} onBack={onBack} />;
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE GAME — main game room
// Game design:
//   • Host picks a secret member (stored locally only — never in shared state)
//   • All players get the same board (24 cards, ordered by host's poolOrder)
//   • Players ask questions in chat → host answers YES / NO via buttons
//   • Any player can submit a "FINAL GUESS" message via special chat format
//   • Host sees Confirm / Deny buttons for guess messages
//   • Correct guess → host reveals secret via setState → game ends
// ────────────────────────────────────────────────────────────────────────────
function OnlineGame({ allPool, filters, onBack }) {
    const amHost = useIsHost();
    const players = usePlayersList();
    const me = myPlayer();

    // ── Shared State ──
    const [phase, setPhase] = useMultiplayerState('phase', 'picking');
    const [poolOrder] = useMultiplayerState('poolOrder', []);
    const [revealedFilename, setRevealedFilename] = useMultiplayerState('revealedFilename', null);
    const [winnerId, setWinnerId] = useMultiplayerState('winnerId', null);
    const [messages, setMessages] = useMultiplayerState('messages', []);

    // ── Local State ──
    const [mySecret, setMySecret] = useState(null);   // host's secret (local only)
    const [eliminated, setEliminated] = useState(new Set());
    const [chatInput, setChatInput] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [copied, setCopied] = useState(false);
    const chatEndRef = useRef(null);

    // Build ordered pool from host's poolOrder
    const pool = useMemo(() => {
        if (!poolOrder || poolOrder.length === 0) return allPool.slice(0, 24);
        return poolOrder.map(fn => allPool.find(m => m.filename === fn)).filter(Boolean);
    }, [poolOrder, allPool]);

    const revealedMember = useMemo(() => pool.find(m => m.filename === revealedFilename), [pool, revealedFilename]);
    const winner = useMemo(() => players.find(p => p.id === winnerId), [players, winnerId]);

    // Get room code
    useEffect(() => {
        try { setRoomCode(getRoomCode() || ''); } catch { }
    }, []);

    // Scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Register RPC for incoming chat messages (reliably delivered to all)
    useEffect(() => {
        RPC.register('newMsg', (data) => {
            setMessages(prev => {
                // Avoid duplicate messages by id
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
        });
    }, []);

    const sendMsg = useCallback((text, type = 'chat', extra = {}) => {
        const profile = me?.getProfile() || {};
        const msg = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2),
            playerId: me?.id,
            player: profile.name || 'Unknown',
            color: profile.color?.hexString || '#ffffff',
            text,
            type,
            ts: Date.now(),
            ...extra,
        };
        RPC.call('newMsg', msg, RPC.Mode.ALL);
    }, [me]);

    // Build the full join URL so remote players go directly to the right room
    const joinUrl = roomCode
        ? `${window.location.protocol}//${window.location.host}${window.location.pathname}?r=${roomCode}`
        : '';

    const copyJoinUrl = () => {
        if (!joinUrl) return;
        const doCopy = (text) => {
            // Modern async clipboard API (works on HTTPS + localhost)
            if (navigator.clipboard?.writeText) {
                return navigator.clipboard.writeText(text)
                    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
                    .catch(() => legacyCopy(text));
            }
            legacyCopy(text);
        };
        const legacyCopy = (text) => {
            // Fallback: works on http:// and insecure contexts
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); }
            catch (e) { console.warn('Copy failed:', e); }
            document.body.removeChild(ta);
        };
        doCopy(joinUrl);
    };

    // ── Phase: picking ────────────────────────────────────────────────────────
    if (phase === 'picking') {
        if (!amHost) {
            return (
                <div className="gw-screen gw-online-wait">
                    <div className="gw-wait-card">
                        <div className="gw-wait-spinner" />
                        <h2 className="gw-wait-title">Waiting for host…</h2>
                        <p className="gw-wait-sub">The host is picking a secret member. Get ready!</p>
                        <div className="gw-players-joined">
                            {players.map(p => {
                                const prof = p.getProfile();
                                return (
                                    <div key={p.id} className="gw-player-chip"
                                        style={{ borderColor: prof.color?.hexString || '#555' }}>
                                        <span className="gw-player-chip-dot" style={{ background: prof.color?.hexString || '#555' }} />
                                        {prof.name}
                                    </div>
                                );
                            })}
                        </div>
                        {roomCode && (
                            <div className="gw-share-block">
                                <div className="gw-room-code-display">
                                    Code: <span className="gw-room-code-val">{roomCode}</span>
                                    <button className="gw-copy-btn" onClick={copyJoinUrl}>{copied ? '✓ Copied!' : 'Copy Link'}</button>
                                </div>
                                {window.location.hostname === 'localhost' && (
                                    <div className="gw-local-warn">⚠️ On localhost — others can't join via QR. Share the link above manually, or open via your network IP.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Host picks the secret
        return (
            <div className="gw-screen gw-pick-screen">
                <div className="gw-pick-header">
                    <div className="gw-pick-crown">👑</div>
                    <h2 className="gw-pick-title">You are the Host — Pick the Secret!</h2>
                    <p className="gw-pick-hint">Only you will see this. Everyone else will try to guess it through chat!</p>
                    {roomCode && (
                        <div className="gw-share-block">
                            <div className="gw-room-code-display">
                                Code: <span className="gw-room-code-val">{roomCode}</span>
                                <button className="gw-copy-btn" onClick={copyJoinUrl}>{copied ? '✓ Link Copied!' : '🔗 Copy Join Link'}</button>
                                <span className="gw-players-count">👥 {players.length} joined</span>
                            </div>
                            <div className="gw-join-url-row">
                                <span className="gw-join-url-label">Join URL:</span>
                                <span className="gw-join-url-val">{joinUrl}</span>
                            </div>
                            {window.location.hostname === 'localhost' && (
                                <div className="gw-local-warn">⚠️ You're on localhost — phones can't reach this URL. Open the app via <strong>http://192.168.x.x:5173/guess-who</strong> so friends can join via QR/link.</div>
                            )}
                        </div>
                    )}
                </div>
                <div className="gw-pick-board-grid">
                    {pool.map(m => (
                        <div key={m.filename} className="gw-pick-card" onClick={() => {
                            setMySecret(m);
                            setPhase('play');
                            sendMsg(`🎮 Game started! I've picked a secret member. Ask me yes/no questions!`, 'system');
                        }}>
                            <div className="gw-pick-frame">
                                <img className="gw-pick-photo" src={m.src} alt={m.name}
                                    onError={e => { e.target.style.display = 'none'; }} />
                            </div>
                            <div className="gw-pick-name">{m.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Phase: done ───────────────────────────────────────────────────────────
    if (phase === 'done') {
        return (
            <div className="gw-screen gw-done-screen">
                <div className="gw-done-card">
                    <div className="gw-done-trophy">🏆</div>
                    <h2 className="gw-done-title">
                        {winner ? `${winner.getProfile().name} Wins!` : 'Game Over!'}
                    </h2>
                    {revealedMember && (
                        <div className="gw-done-reveal-item">
                            <div className="gw-done-reveal-label">The secret member was:</div>
                            <div className="gw-done-reveal-card">
                                <img src={revealedMember.src} alt={revealedMember.name}
                                    className="gw-done-photo"
                                    onError={e => { e.target.style.display = 'none'; }} />
                                <div className="gw-done-name">{revealedMember.name}</div>
                            </div>
                            <div className="gw-done-reveal-meta">
                                {revealedMember.generation}{revealedMember.team ? ` • ${revealedMember.team}` : ''}
                                {' • '}{revealedMember.isActive ? '✨ Active' : '🎓 Ex-Member'}
                            </div>
                        </div>
                    )}
                    <div className="gw-done-chat-log">
                        <div className="gw-guide-title">📋 Game Chat</div>
                        <div className="gw-done-messages">
                            {messages.slice(-12).map(msg => (
                                <div key={msg.id} className={`gw-msg gw-msg-${msg.type}`}>
                                    {msg.type !== 'system' && <span className="gw-msg-player" style={{ color: msg.color }}>{msg.player}: </span>}
                                    <span className="gw-msg-text">{msg.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="gw-btn-back" onClick={onBack}>← Back to Menu</button>
                </div>
            </div>
        );
    }

    // ── Phase: play ───────────────────────────────────────────────────────────
    const toggle = (filename) => {
        setEliminated(prev => {
            const next = new Set(prev);
            if (next.has(filename)) next.delete(filename); else next.add(filename);
            return next;
        });
    };

    const handleSendChat = () => {
        if (!chatInput.trim()) return;
        sendMsg(chatInput.trim());
        setChatInput('');
    };

    const handleFinalGuess = () => {
        if (!guessInput.trim()) return;
        sendMsg(`🎯 FINAL GUESS: "${guessInput.trim()}"`, 'guess', { guessText: guessInput.trim() });
        setGuessInput('');
    };

    // Host confirms/denies a guess
    const confirmGuess = (msg, correct) => {
        if (!amHost || !mySecret) return;
        if (correct) {
            sendMsg(`✅ ${msg.player} guessed correctly! The secret was ${mySecret.name}!`, 'system');
            setRevealedFilename(mySecret.filename);
            setWinnerId(msg.playerId);
            setPhase('done');
        } else {
            sendMsg(`❌ "${msg.guessText}" is wrong! Keep asking questions!`, 'system');
        }
    };

    const hostAnswerYes = () => sendMsg('✅ YES!', 'answer');
    const hostAnswerNo = () => sendMsg('❌ NO!', 'answer');

    return (
        <div className="gw-screen gw-game-screen gw-online-game">
            {/* Top bar */}
            <div className="gw-topbar">
                <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                <div className="gw-topbar-center">
                    <div className="gw-stat-pill">🃏 {pool.length - eliminated.size} left</div>
                    {eliminated.size > 0 && <div className="gw-stat-pill gw-stat-elim">❌ {eliminated.size} out</div>}
                    {roomCode && (
                        <div className="gw-room-code-pill" onClick={copyJoinUrl} title="Click to copy join link">
                            🔑 {roomCode} {copied ? '✓' : '📋'}
                        </div>
                    )}
                </div>
                <div className="gw-players-pills">
                    {players.map(p => {
                        const prof = p.getProfile();
                        return (
                            <div key={p.id} className="gw-player-dot" title={prof.name}
                                style={{ background: prof.color?.hexString || '#888' }}>
                                {prof.name?.charAt(0)}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="gw-game-layout">
                {/* Board */}
                <div className="gw-board-col">
                    <div className="gw-board-instructions">
                        {amHost
                            ? '👑 You are the host. Flip cards to help yourself answer. Answer questions below!'
                            : 'Flip cards to eliminate members. Ask yes/no questions in chat!'}
                    </div>
                    <Board members={pool} eliminated={eliminated} onToggle={toggle} revealedFilename={null} />
                </div>

                {/* Sidebar */}
                <div className="gw-sidebar">
                    {/* Host-only secret panel */}
                    {amHost && mySecret && (
                        <div className="gw-host-secret-panel">
                            <div className="gw-guide-title">🔒 Your Secret (Only You See This)</div>
                            <div className="gw-host-secret-card">
                                <div className="gw-host-secret-frame">
                                    <img className="gw-host-secret-photo" src={mySecret.src} alt={mySecret.name}
                                        onError={e => { e.target.style.display = 'none'; }} />
                                </div>
                                <div className="gw-host-secret-info">
                                    <div className="gw-host-secret-name">{mySecret.name}</div>
                                    <div className="gw-host-secret-meta">
                                        {mySecret.generation}{mySecret.team ? ` • ${mySecret.team}` : ''}
                                    </div>
                                    <div className={`gw-host-status ${mySecret.isActive ? 'active' : 'ex'}`}>
                                        {mySecret.isActive ? '✨ Active' : '🎓 Ex-Member'}
                                    </div>
                                </div>
                            </div>
                            {/* Quick answer buttons */}
                            <div className="gw-answer-btns">
                                <div className="gw-answer-label">Quick Answer:</div>
                                <button className="gw-answer-yes" onClick={hostAnswerYes}>✅ YES</button>
                                <button className="gw-answer-no" onClick={hostAnswerNo}>❌ NO</button>
                            </div>
                        </div>
                    )}

                    {/* Chat box */}
                    <div className="gw-chat-box">
                        <div className="gw-chat-header">
                            💬 Game Chat
                            <span className="gw-chat-hint">{amHost ? 'Answer questions' : 'Ask yes/no questions'}</span>
                        </div>
                        <div className="gw-chat-messages">
                            {messages.length === 0 && (
                                <div className="gw-chat-empty">No messages yet. Ask yes/no questions!</div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} className={`gw-msg gw-msg-${msg.type}`}>
                                    {msg.type !== 'system' && (
                                        <span className="gw-msg-player" style={{ color: msg.color }}>
                                            {msg.player}:
                                        </span>
                                    )}
                                    <span className="gw-msg-text">{msg.text}</span>
                                    {/* Host sees confirm/deny for final guesses */}
                                    {amHost && msg.type === 'guess' && msg.playerId !== me?.id && (
                                        <div className="gw-confirm-row">
                                            <button className="gw-confirm-yes" onClick={() => confirmGuess(msg, true)}>✅ Correct</button>
                                            <button className="gw-confirm-no" onClick={() => confirmGuess(msg, false)}>❌ Wrong</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="gw-chat-input-wrap">
                            <input className="gw-chat-input" placeholder="Ask a yes/no question…"
                                value={chatInput} onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendChat()} />
                            <button className="gw-send-btn" onClick={handleSendChat}>→</button>
                        </div>
                    </div>

                    {/* Final guess (non-host only) */}
                    {!amHost && (
                        <div className="gw-guess-form">
                            <div className="gw-guess-label">🎯 Final Guess:</div>
                            <div className="gw-guess-row">
                                <input className="gw-guess-input" placeholder="Type member name…"
                                    value={guessInput} onChange={e => setGuessInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFinalGuess()}
                                    list="gw-ml-online" />
                                <datalist id="gw-ml-online">
                                    {pool.map(m => <option key={m.filename} value={m.name} />)}
                                </datalist>
                                <button className="gw-btn-guess" onClick={handleFinalGuess}>Guess!</button>
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    <div className="gw-hint-guide">
                        <div className="gw-guide-title">💡 How to Play</div>
                        <ul className="gw-guide-list">
                            {amHost ? (
                                <>
                                    <li>Answer questions with <strong>YES ✅ / NO ❌</strong> buttons</li>
                                    <li>Confirm or deny players' final guesses</li>
                                    <li>Flip cards to help track what you've answered</li>
                                </>
                            ) : (
                                <>
                                    <li>Ask yes/no questions in chat</li>
                                    <li>Flip cards to eliminate members</li>
                                    <li>When ready, submit a <strong>Final Guess</strong></li>
                                    <li>Host will confirm if you're correct!</li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
