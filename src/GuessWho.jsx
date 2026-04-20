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

// Sort by gen number (ascending) then by display name
const sortPool = (pool) => [...pool].sort((a, b) => {
    const aKey = a.genKey.startsWith('gen') ? parseInt(a.genKey.slice(3)) : 999;
    const bKey = b.genKey.startsWith('gen') ? parseInt(b.genKey.slice(3)) : 999;
    if (aKey !== bKey) return aKey - bKey;
    return a.name.localeCompare(b.name);
});

const buildMemberPool = ({ memberStatus, generation, team }) => {
    let pool = [];
    if (memberStatus === 'active' || memberStatus === 'all')
        (memberData.activeMemberFiles || []).forEach(f =>
            pool.push({ filename: f, isActive: true, src: `/asset/member_active/${f}` }));
    if (memberStatus === 'ex' || memberStatus === 'all')
        (memberData.exMemberFiles || []).forEach(f =>
            pool.push({ filename: f, isActive: false, src: `/asset/exmember/${f.replace(/\\/g, '/')}` }));
    // Enrich first so genKey is available for filtering
    pool = pool.map(m => ({
        ...m,
        name: formatMemberName(m.filename),
        generation: getGenLabel(m.filename),
        genKey: getGenNumber(m.filename),
        team: getTeamForFile(m.filename),
    }));
    // Exclude JKT48V (vtuber) members always
    pool = pool.filter(m => !m.genKey.startsWith('vgen'));
    if (generation !== 'all') pool = pool.filter(m => m.genKey === generation);
    if (team && team !== 'all') {
        if (team === 'no-team') pool = pool.filter(m => !m.team);
        else {
            const label = { tim_love: 'Tim Love', tim_dream: 'Tim Dream', tim_passion: 'Tim Passion' }[team];
            pool = pool.filter(m => m.team === label);
        }
    }
    return sortPool(pool);
};

const GEN_OPTIONS = [
    { value: 'all', label: 'All Generations' },
    ...Array.from({ length: 14 }, (_, i) => ({ value: `gen${i + 1}`, label: `Gen ${i + 1}` })),
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
    const [joinCode, setJoinCode] = useState('');

    return (
        <div className="gw-root">
            <div className="gw-bg" />
            {screen === 'menu' && <MenuScreen onPick={s => setScreen(s)} />}

            {/* Single player */}
            {screen === 'setup-single' && (
                <SetupScreen title="⚡ Single Player" filters={filters} setFilters={setFilters}
                    onBack={() => setScreen('menu')} onStart={() => setScreen('single')} />
            )}
            {screen === 'single' && <SingleGame filters={filters} onBack={() => setScreen('menu')} />}

            {/* Online multiplayer */}
            {screen === 'online-lobby' && (
                <OnlineLobbyScreen
                    onBack={() => setScreen('menu')}
                    onCreateRoom={() => setScreen('setup-multi')}
                    onJoinRoom={() => setScreen('join-room')}
                />
            )}
            {screen === 'join-room' && (
                <JoinScreen
                    onBack={() => setScreen('online-lobby')}
                    onJoin={(code) => { setJoinCode(code); setScreen('multi'); }}
                />
            )}
            {screen === 'setup-multi' && (
                <SetupScreen title="👑 Create Room" filters={filters} setFilters={setFilters}
                    onBack={() => setScreen('online-lobby')} onStart={() => setScreen('multi')} isMulti />
            )}
            {screen === 'multi' && (
                <MultiLobby filters={filters} joinCode={joinCode}
                    onBack={() => window.location.reload()} />
            )}
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
                <button className="gw-menu-card" id="btn-multi" onClick={() => onPick('online-lobby')}>
                    <div className="gw-menu-card-icon">🌐</div>
                    <div className="gw-menu-card-label">Online Multiplayer</div>
                    <div className="gw-menu-card-desc">Host a room or join with a code. Chat and guess the secret member!</div>
                </button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE LOBBY (Create vs Join choice)
// ────────────────────────────────────────────────────────────────────────────
function OnlineLobbyScreen({ onBack, onCreateRoom, onJoinRoom }) {
    return (
        <div className="gw-screen gw-menu" style={{ paddingTop: 32 }}>
            <button className="gw-btn-back" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Back</button>
            <div className="gw-logo-wrap" style={{ marginBottom: 4 }}>
                <div className="gw-logo-jkt" style={{ fontSize: '1rem', letterSpacing: '0.35em' }}>Online Multiplayer</div>
                <div className="gw-logo-gw" style={{ fontSize: '2rem' }}>How do you want to play?</div>
            </div>
            <div className="gw-menu-cards">
                <button className="gw-menu-card" onClick={onCreateRoom}>
                    <div className="gw-menu-card-icon">👑</div>
                    <div className="gw-menu-card-label">Create Room</div>
                    <div className="gw-menu-card-desc">Pick filters, create a room, and share the <strong style={{color:'#f5c518'}}>room code</strong> with your friend.</div>
                </button>
                <button className="gw-menu-card" onClick={onJoinRoom}>
                    <div className="gw-menu-card-icon">🎮</div>
                    <div className="gw-menu-card-label">Join Room</div>
                    <div className="gw-menu-card-desc">Enter the room code your host shared to jump straight into the game.</div>
                </button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// JOIN SCREEN — just a code input
// ────────────────────────────────────────────────────────────────────────────
function JoinScreen({ onBack, onJoin }) {
    const [code, setCode] = useState('');

    const handleJoin = () => {
        const c = code.trim().toUpperCase();
        if (!c) return;
        onJoin(c);
    };

    return (
        <div className="gw-screen" style={{ justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            <button className="gw-btn-back" style={{ alignSelf: 'flex-start', marginBottom: 8 }} onClick={onBack}>← Back</button>
            <div className="gw-join-card">
                <div className="gw-join-icon">🎮</div>
                <h2 className="gw-join-title">Join a Room</h2>
                <p className="gw-join-sub">Type the code your host shared with you</p>
                <input
                    id="join-code-input"
                    className="gw-code-input"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    placeholder="e.g. ABCD"
                    maxLength={12}
                    autoFocus
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
                <button className="gw-btn-start" onClick={handleJoin} disabled={!code.trim()}>
                    Join Room →
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
                        A room will be created. Share the <strong>room code</strong> with your friend to join!
                        Both players secretly pick a member — then try to guess each other's!
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
    const [pool] = useState(() => buildMemberPool(filters));
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
function MultiLobby({ filters, joinCode, onBack }) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    const pool = useMemo(() => buildMemberPool(filters), []);

    useEffect(() => {
        const opts = {
            gameId: 'JKT48GuessWho',
            maxPlayersPerRoom: 2,
            skipLobby: true,
        };
        if (joinCode) opts.roomCode = joinCode;

        insertCoin(opts)
            .then(() => {
                if (isHost()) {
                    setState('poolOrder', pool.map(m => m.filename), true);
                    setState('phase', 'picking', true);
                }
                setReady(true);
            })
            .catch(err => setError(err?.message || 'Connection failed. Check the room code and try again.'));
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
                <div className="gw-connecting-text">
                    {joinCode ? `Joining room ${joinCode}…` : 'Creating room…'}
                </div>
            </div>
        </div>
    );

    return <OnlineGame allPool={pool} filters={filters} onBack={onBack} />;
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE GAME — 2-player symmetric Guess Who
// Both players pick a secret. Both ask questions and answer about their own
// secret. Either player can submit a Final Guess targeting the OTHER player.
// The target player confirms/denies. First correct guess wins.
// ────────────────────────────────────────────────────────────────────────────
function OnlineGame({ allPool, filters, onBack }) {
    const amHost = useIsHost();
    const players = usePlayersList();
    const me = myPlayer();
    const other = useMemo(() => players.find(p => p.id !== me?.id), [players, me]);

    // ── Shared State ──
    const [phase, setPhase] = useMultiplayerState('phase', 'picking');
    const [poolOrder] = useMultiplayerState('poolOrder', []);
    const [pickedPlayers, setPickedPlayers] = useMultiplayerState('pickedPlayers', {});
    const [winnerId, setWinnerId] = useMultiplayerState('winnerId', null);
    const [revealedSecrets, setRevealedSecrets] = useMultiplayerState('revealedSecrets', {});
    // messages uses plain useState + RPC so the RPC handler always has a stable setter reference
    // (useMultiplayerState's setter is not referentially stable — causes stale closure bugs)
    const [messages, setMessages] = useState([]);

    // ── Local State ──
    const [mySecret, setMySecret] = useState(null);
    const [eliminated, setEliminated] = useState(new Set());
    const [chatInput, setChatInput] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [copied, setCopied] = useState(false);
    const chatEndRef = useRef(null);

    // Build pool: look up host's poolOrder in the FULL member set (so guest never drops cards)
    const fullPool = useMemo(() => buildMemberPool({ memberStatus: 'all', generation: 'all', team: 'all' }), []);
    const pool = useMemo(() => {
        if (!poolOrder || poolOrder.length === 0) return allPool;
        return poolOrder.map(fn => fullPool.find(m => m.filename === fn)).filter(Boolean);
    }, [poolOrder, fullPool, allPool]);

    const winner = useMemo(() => players.find(p => p.id === winnerId), [players, winnerId]);

    // When both players have picked, host starts the game
    useEffect(() => {
        if (phase !== 'picking' || !pickedPlayers) return;
        if (Object.keys(pickedPlayers).length >= 2 && amHost) {
            setPhase('play');
            sendMsg('🎮 Both players picked a secret! Game starts — ask yes/no questions!', 'system');
        }
    }, [pickedPlayers, phase, amHost]);

    // Room code — retry since skipLobby may delay it by a tick
    useEffect(() => {
        const tryGet = () => {
            try {
                const code = getRoomCode();
                if (code) { setRoomCode(code); return; }
            } catch { }
            setTimeout(() => { try { setRoomCode(getRoomCode() || ''); } catch { } }, 200);
        };
        tryGet();
    }, []);

    // Scroll chat to bottom
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Register RPC listener for chat messages
    useEffect(() => {
        RPC.register('newMsg', (data) => {
            setMessages(prev => {
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
            text, type, ts: Date.now(), ...extra,
        };
        // Add to local state immediately — RPC.Mode.OTHERS won't echo back to ourselves
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
        });
        // Broadcast to the other player
        RPC.call('newMsg', msg, RPC.Mode.OTHERS);
    }, [me]);

    const copyCode = () => {
        if (!roomCode) return;
        const doCopy = (text) => {
            if (navigator.clipboard?.writeText)
                return navigator.clipboard.writeText(text)
                    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
                    .catch(() => legacyCopy(text));
            legacyCopy(text);
        };
        const legacyCopy = (text) => {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { }
            document.body.removeChild(ta);
        };
        doCopy(roomCode);
    };

    // ── Waiting for second player ─────────────────────────────────────────────
    if (players.length < 2) {
        return (
            <div className="gw-screen gw-online-wait">
                <div className="gw-wait-card">
                    <div className="gw-wait-spinner" />
                    <h2 className="gw-wait-title">Waiting for opponent…</h2>
                    <p className="gw-wait-sub">Share the room code with one friend to start!</p>
                    {roomCode && (
                        <div className="gw-room-code-badge">
                            <div className="gw-room-code-badge-label">🔑 Room Code — share this!</div>
                            <div className="gw-room-code-badge-val">{roomCode}</div>
                            <button className="gw-copy-btn" onClick={copyCode}>{copied ? '✓ Copied!' : 'Copy Code'}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Phase: picking (both players pick simultaneously) ─────────────────────
    if (phase === 'picking') {
        const iHavePicked = !!(pickedPlayers && pickedPlayers[me?.id]);
        const otherHasPicked = !!(pickedPlayers && other && pickedPlayers[other.id]);

        if (iHavePicked) {
            return (
                <div className="gw-screen gw-online-wait">
                    <div className="gw-wait-card">
                        <div className="gw-wait-spinner" />
                        <h2 className="gw-wait-title">Waiting for opponent…</h2>
                        <p className="gw-wait-sub">You picked <strong style={{color:'#f5c518'}}>{mySecret?.name}</strong>. Your opponent is choosing!</p>
                        <div className="gw-players-joined">
                            {players.map(p => {
                                const prof = p.getProfile();
                                const hasPicked = pickedPlayers && pickedPlayers[p.id];
                                return (
                                    <div key={p.id} className="gw-player-chip" style={{ borderColor: prof.color?.hexString || '#555' }}>
                                        <span className="gw-player-chip-dot" style={{ background: prof.color?.hexString || '#555' }} />
                                        {prof.name} {hasPicked ? '✅' : '⏳'}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        // Pick your secret
        return (
            <div className="gw-screen gw-pick-screen">
                <div className="gw-pick-header">
                    <div className="gw-pick-crown">🔒</div>
                    <h2 className="gw-pick-title">Pick YOUR Secret Member</h2>
                    <p className="gw-pick-hint">
                        Your opponent will try to guess this. Don't show them!
                        {other && <span style={{color:'#f5c518'}}> {other.getProfile().name} {otherHasPicked ? 'has picked ✅' : 'is choosing…'}</span>}
                    </p>
                    {roomCode && (
                        <div className="gw-room-code-badge" style={{marginTop:8}}>
                            <div className="gw-room-code-badge-label">🔑 Room Code</div>
                            <div className="gw-room-code-badge-val">{roomCode}</div>
                        </div>
                    )}
                </div>
                <div className="gw-pick-board-grid">
                    {pool.map(m => (
                        <div key={m.filename} className="gw-pick-card" onClick={() => {
                            setMySecret(m);
                            setPickedPlayers({ ...(pickedPlayers || {}), [me.id]: true });
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
        const myRevealedFn = revealedSecrets && revealedSecrets[me?.id];
        const canIReveal = !myRevealedFn && mySecret; // I haven't revealed yet and I know my secret

        const revealMySecret = () => {
            if (!mySecret) return;
            setRevealedSecrets({ ...(revealedSecrets || {}), [me.id]: mySecret.filename });
        };

        return (
            <div className="gw-screen gw-done-screen">
                <div className="gw-done-card">
                    <div className="gw-done-trophy">🏆</div>
                    <h2 className="gw-done-title">
                        {winner ? `${winner.getProfile().name} Wins!` : 'Game Over!'}
                    </h2>
                    <div className="gw-done-reveals">
                        {players.map(p => {
                            const prof = p.getProfile();
                            const fn = revealedSecrets && revealedSecrets[p.id];
                            const member = fn && fullPool.find(m => m.filename === fn);
                            const isMe = p.id === me?.id;
                            return (
                                <div key={p.id} className="gw-done-reveal-item">
                                    <div className="gw-done-reveal-label" style={{color: prof.color?.hexString}}>
                                        {isMe ? 'Your' : prof.name + "'s"} secret:
                                    </div>
                                    {member ? (
                                        <div className="gw-done-reveal-card">
                                            <img src={member.src} alt={member.name} className="gw-done-photo"
                                                onError={e => { e.target.style.display = 'none'; }} />
                                            <div className="gw-done-name">{member.name}</div>
                                            <div className="gw-done-meta">{member.generation}{member.team ? ` • ${member.team}` : ''}</div>
                                        </div>
                                    ) : (
                                        <div className="gw-done-reveal-card gw-done-reveal-hidden">
                                            <div className="gw-done-photo" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem'}}>🔒</div>
                                            <div className="gw-done-name">Never guessed</div>
                                            {/* Only the owner of this secret can reveal it */}
                                            {isMe && canIReveal && (
                                                <button className="gw-btn-reveal-secret" onClick={revealMySecret}>
                                                    🔓 Reveal My Secret
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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
        setEliminated(prev => { const n = new Set(prev); n.has(filename) ? n.delete(filename) : n.add(filename); return n; });
    };

    const handleSendChat = () => {
        if (!chatInput.trim()) return;
        sendMsg(chatInput.trim());
        setChatInput('');
    };

    const handleFinalGuess = () => {
        if (!guessInput.trim() || !other) return;
        sendMsg(`🎯 FINAL GUESS: "${guessInput.trim()}"`, 'guess', {
            guessText: guessInput.trim(),
            targetPlayerId: other.id,
        });
        setGuessInput('');
    };

    const confirmGuess = (msg, correct) => {
        if (!mySecret) return;
        if (correct) {
            sendMsg(`✅ ${msg.player} guessed correctly! My secret was ${mySecret.name}!`, 'system');
            setRevealedSecrets({ ...(revealedSecrets || {}), [me.id]: mySecret.filename });
            setWinnerId(msg.playerId);
            setPhase('done');
        } else {
            sendMsg(`❌ "${msg.guessText}" is wrong! Keep asking!`, 'system');
        }
    };

    const answerYes = () => sendMsg('✅ YES!', 'answer');
    const answerNo  = () => sendMsg('❌ NO!', 'answer');

    return (
        <div className="gw-screen gw-game-screen gw-online-game">
            {/* Top bar */}
            <div className="gw-topbar">
                <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                <div className="gw-topbar-center">
                    <div className="gw-stat-pill">🃏 {pool.length - eliminated.size} left</div>
                    {eliminated.size > 0 && <div className="gw-stat-pill gw-stat-elim">❌ {eliminated.size} out</div>}
                    {roomCode && (
                        <div className="gw-room-code-pill" onClick={copyCode} title="Click to copy">
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
                        Flip cards to eliminate members. Ask yes/no questions and answer about YOUR secret!
                    </div>
                    <Board members={pool} eliminated={eliminated} onToggle={toggle} revealedFilename={null} />
                </div>

                {/* Sidebar */}
                <div className="gw-sidebar">
                    {/* My secret panel — both players see their own */}
                    {mySecret && (
                        <div className="gw-host-secret-panel">
                            <div className="gw-guide-title">🔒 Your Secret (only you see this)</div>
                            <div className="gw-host-secret-card">
                                <div className="gw-host-secret-frame">
                                    <img className="gw-host-secret-photo" src={mySecret.src} alt={mySecret.name}
                                        onError={e => { e.target.style.display = 'none'; }} />
                                </div>
                                <div className="gw-host-secret-info">
                                    <div className="gw-host-secret-name">{mySecret.name}</div>
                                    <div className="gw-host-secret-meta">{mySecret.generation}{mySecret.team ? ` • ${mySecret.team}` : ''}</div>
                                    <div className={`gw-host-status ${mySecret.isActive ? 'active' : 'ex'}`}>
                                        {mySecret.isActive ? '✨ Active' : '🎓 Ex-Member'}
                                    </div>
                                </div>
                            </div>
                            {/* Both players answer questions about THEIR OWN secret */}
                            <div className="gw-answer-btns">
                                <div className="gw-answer-label">Answer about YOUR secret:</div>
                                <button className="gw-answer-yes" onClick={answerYes}>✅ YES</button>
                                <button className="gw-answer-no" onClick={answerNo}>❌ NO</button>
                            </div>
                        </div>
                    )}

                    {/* Chat */}
                    <div className="gw-chat-box">
                        <div className="gw-chat-header">
                            💬 Game Chat
                            <span className="gw-chat-hint">Ask questions • Answer about your own secret</span>
                        </div>
                        <div className="gw-chat-messages">
                            {messages.length === 0 && (
                                <div className="gw-chat-empty">Ask yes/no questions about the other player's secret!</div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} className={`gw-msg gw-msg-${msg.type}`}>
                                    {msg.type !== 'system' && (
                                        <span className="gw-msg-player" style={{ color: msg.color }}>{msg.player}:</span>
                                    )}
                                    <span className="gw-msg-text">{msg.text}</span>
                                    {/* Show confirm/deny only to the player being guessed */}
                                    {msg.type === 'guess' && msg.targetPlayerId === me?.id && (
                                        <div className="gw-confirm-row">
                                            <button className="gw-confirm-yes" onClick={() => confirmGuess(msg, true)}>✅ Correct!</button>
                                            <button className="gw-confirm-no" onClick={() => confirmGuess(msg, false)}>❌ Wrong</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form className="gw-chat-input-wrap"
                            onSubmit={e => { e.preventDefault(); handleSendChat(); }}>
                            <input className="gw-chat-input" placeholder="Ask or type a message…"
                                value={chatInput} onChange={e => setChatInput(e.target.value)}
                                enterKeyHint="send"
                                autoComplete="off" />
                            <button type="submit" className="gw-send-btn">→</button>
                        </form>
                    </div>

                    {/* Final guess — both players guess the opponent's secret */}
                    <div className="gw-guess-form">
                        <div className="gw-guess-label">🎯 Guess {other ? other.getProfile().name + "'s" : "opponent's"} secret:</div>
                        <form className="gw-guess-row"
                            onSubmit={e => { e.preventDefault(); handleFinalGuess(); }}>
                            <input className="gw-guess-input" placeholder="Type member name…"
                                value={guessInput} onChange={e => setGuessInput(e.target.value)}
                                enterKeyHint="send"
                                autoComplete="off"
                                list="gw-ml-online" />
                            <datalist id="gw-ml-online">
                                {pool.map(m => <option key={m.filename} value={m.name} />)}
                            </datalist>
                            <button type="submit" className="gw-btn-guess">Guess!</button>
                        </form>
                    </div>

                    <div className="gw-hint-guide">
                        <div className="gw-guide-title">💡 How to Play</div>
                        <ul className="gw-guide-list">
                            <li>Ask your opponent yes/no questions about their secret</li>
                            <li>Answer <strong>YES ✅ / NO ❌</strong> about YOUR own secret</li>
                            <li>Flip cards to eliminate members that don't match</li>
                            <li>Submit a <strong>Final Guess</strong> when you're ready!</li>
                            <li>Your opponent confirms if you're right</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
