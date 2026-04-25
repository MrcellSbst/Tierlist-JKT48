import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
    if ((memberData.tim_trainee || []).some(f => f.toLowerCase() === base)) return 'Tim Trainee';
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
            const label = { tim_love: 'Tim Love', tim_dream: 'Tim Dream', tim_passion: 'Tim Passion', tim_trainee: 'Tim Trainee' }[team];
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
    { value: 'tim_trainee', label: 'Tim Trainee' },
];

// ────────────────────────────────────────────────────────────────────────────
// ROOT
// ────────────────────────────────────────────────────────────────────────────
export default function GuessWho() {
    const [screen, setScreen] = useState('menu');
    const [filters, setFilters] = useState({ memberStatus: 'active', generation: 'all', team: 'all' });
    const [joinCode, setJoinCode] = useState('');
    const [nickname, setNickname] = useState('');

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
                    nickname={nickname}
                    onNicknameChange={setNickname}
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
                <MultiLobby filters={filters} joinCode={joinCode} nickname={nickname}
                    onBack={() => window.location.replace(window.location.pathname)} />
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MENU
// ────────────────────────────────────────────────────────────────────────────
function MenuScreen({ onPick }) {
    const navigate = useNavigate();
    return (
        <div className="gw-screen gw-menu">
            <button className="gw-btn-back gw-btn-back-corner" onClick={() => navigate('/games')}>← Back</button>
            <div className="gw-logo-wrap">
                <div className="gw-logo-board">
                    {[
                        'Gen11_grace_octaviani.jpg',
                        'Gen12_aurhel_alana.jpg',
                        'Gen11_cynthia_yaputera.jpg',
                        'Gen13_Astrella_Virgiananda.jpg',
                        'Gen13_Jemima_Evodie.jpg',
                        'Gen13_Jacqueline_Immanuela.jpg',
                    ].map((file, i) => (
                        <div key={i} className="gw-logo-card">
                            <img src={`/asset/member_active/${file}`} alt="" draggable={false} />
                        </div>
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
                    <div className="gw-menu-card-desc">Untuk bermain secara IRL dengan temanmu</div>
                </button>
                <button className="gw-menu-card" id="btn-multi" onClick={() => onPick('online-lobby')}>
                    <div className="gw-menu-card-icon">🌐</div>
                    <div className="gw-menu-card-label">Online Multiplayer</div>
                    <div className="gw-menu-card-desc">Buat room atau join dengan kode. Chat dan tebak siapa member rahasia!</div>
                </button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE LOBBY (Create vs Join choice) + Nickname picker
// ────────────────────────────────────────────────────────────────────────────
function OnlineLobbyScreen({ onBack, onCreateRoom, onJoinRoom, nickname, onNicknameChange }) {
    const handleNick = (e) => {
        // Allow letters, numbers, spaces only — max 25
        const val = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25);
        onNicknameChange(val);
    };
    const nickOk = nickname.trim().length > 0;

    return (
        <div className="gw-screen gw-menu" style={{ paddingTop: 32 }}>
            <button className="gw-btn-back gw-btn-back-corner" onClick={onBack}>← Back</button>
            <div className="gw-logo-wrap" style={{ marginBottom: 4 }}>
                <div className="gw-logo-jkt" style={{ fontSize: '1rem', letterSpacing: '0.35em' }}>Online Multiplayer</div>
                <div className="gw-logo-gw" style={{ fontSize: '2rem' }}>Mau buat game seperti apa?</div>
            </div>

            {/* Nickname input */}
            <div className="gw-nickname-section">
                <label className="gw-filter-label" htmlFor="gw-nick-input">Nickname-mu</label>
                <div className="gw-nickname-row">
                    <input
                        id="gw-nick-input"
                        className="gw-nickname-input"
                        value={nickname}
                        onChange={handleNick}
                        placeholder="Enter your nickname…"
                        maxLength={25}
                        autoComplete="nickname"
                        spellCheck={false}
                    />
                    <span className={`gw-nick-count ${nickname.length >= 23 ? 'gw-nick-count-warn' : ''}`}>
                        {nickname.length}/25
                    </span>
                </div>
                {!nickOk && <div className="gw-nick-hint">Kamu harus buat nickname sebelum kamu bisa buat room</div>}
            </div>

            <div className="gw-menu-cards">
                <button className="gw-menu-card" onClick={onCreateRoom} disabled={!nickOk}>
                    <div className="gw-menu-card-icon">👑</div>
                    <div className="gw-menu-card-label">Buat Room</div>
                    <div className="gw-menu-card-desc">Pilih filter, buat room, dan bagikan <strong style={{ color: '#f5c518' }}>kode room</strong> ke temanmu.</div>
                </button>
                <button className="gw-menu-card" onClick={onJoinRoom} disabled={!nickOk}>
                    <div className="gw-menu-card-icon">🎮</div>
                    <div className="gw-menu-card-label">Join Room</div>
                    <div className="gw-menu-card-desc">Masukkan kode room yang dibagikan oleh host untuk langsung bermain.</div>
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
            <button className="gw-btn-back gw-btn-back-corner" onClick={onBack}>← Back</button>
            <div className="gw-join-card">
                <div className="gw-join-icon">🎮</div>
                <h2 className="gw-join-title">Masuk ke Room</h2>
                <p className="gw-join-sub">Masukkan kode room yang dibagikan oleh host</p>
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
                    Masuk Room →
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
            <button className="gw-btn-back gw-btn-back-corner" onClick={onBack}>← Back</button>
            <h2 className="gw-setup-title">{title} — Pengaturan</h2>
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
                            <label className="gw-filter-label">Generasi</label>
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
                    <span className="gw-pool-num">{pool.length}</span> member dalam pool
                    {pool.length < 4 && <span className="gw-pool-warn"> - butuh minimal 4</span>}
                </div>
                {isMulti && (
                    <div className="gw-setup-note">
                        <span className="gw-note-icon">🌐</span>
                        Game room akan dibuat, share kode room kepada teman kalian untuk join!
                        Nanti, kalian berdua akan memilih satu member secara rahasia, lalu coba tebak member pilihan masing-masing!
                    </div>
                )}
            </div>
            <button className="gw-btn-start" disabled={pool.length < 4} onClick={onStart}>
                {isMulti ? 'Buat Room' : 'Mulai Game'}
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MEMBER CARD
// ────────────────────────────────────────────────────────────────────────────
function MemberCard({ member, eliminated, onClick, highlight }) {
    // Shorten gen label: "Gen 1" → "G1", unknown → ""
    const genShort = member.generation?.replace('Gen ', 'G') || '';
    // Shorten team label: "Tim Love" → "Love", etc.
    const teamShort = member.team?.replace('Tim ', '') || '';

    return (
        <div className={`gw-card ${eliminated ? 'gw-card-out' : ''} ${highlight ? 'gw-card-secret' : ''}`}
            onClick={onClick} title={eliminated ? 'Tereliminasi' : member.name}>
            <div className="gw-card-inner">
                <div className="gw-card-front">
                    <div className="gw-card-frame">
                        <div className="gw-card-photo-wrap">
                            <img className="gw-card-photo" src={member.src} alt={member.name}
                                draggable={false} loading="lazy"
                                onError={e => { e.target.style.display = 'none'; }} />
                            {genShort && <span className="gw-card-gen">{genShort}</span>}
                            {teamShort && <span className="gw-card-team">{teamShort}</span>}
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
            <div className="gw-secret-label">Member Rahasia mu</div>
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
                        <div className="gw-secret-tap">Ketuk untuk melihat</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// SINGLE PLAYER (2-player IRL / local mode)
// Player 1 picks a secret. Player 2 asks questions, flips cards, and guesses.
// Same member pool and sorting as online multiplayer.
// ────────────────────────────────────────────────────────────────────────────
function SingleGame({ filters, onBack }) {
    // Identical pool logic to online multiplayer (sorted gen→name, no vgen)
    const pool = useMemo(() => buildMemberPool(filters), []);
    const [phase, setPhase] = useState('picking'); // picking | play | won | giveup
    const [secretMember, setSecretMember] = useState(null);
    const [eliminated, setEliminated] = useState(new Set());
    const [guessInput, setGuessInput] = useState('');
    const [peekOpen, setPeekOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [guessHistory, setGuessHistory] = useState([]);

    const toggle = (filename) => {
        if (phase !== 'play') return;
        setEliminated(prev => { const n = new Set(prev); n.has(filename) ? n.delete(filename) : n.add(filename); return n; });
    };

    const handleGuess = () => {
        const g = guessInput.trim();
        if (!g) return;
        const correct = g.toLowerCase() === secretMember.name.toLowerCase();
        setGuessHistory(h => [...h, { guess: g, correct }]);
        setGuessInput('');
        if (correct) { setPhase('won'); setMessage(`🎉 Correct! The secret was ${secretMember.name}!`); }
        else setMessage(`❌ "${g}" is wrong — keep asking!`);
    };

    // ── Phase: picking ──────────────────────────────────────────────────────────────────
    if (phase === 'picking') {
        return (
            <div className="gw-screen gw-pick-screen">
                <div className="gw-pick-header">
                    <button className="gw-btn-back gw-btn-back-corner" onClick={onBack}>← Back</button>
                    <div className="gw-pick-crown">🎭</div>
                    <h2 className="gw-pick-title">Pemain 1 — Pilih Member Rahasia</h2>
                    <p className="gw-pick-hint">
                        Jangan tunjukkan ke Player 2! Ketuk member untuk memilih rahasia.
                    </p>
                </div>
                <div className="gw-pick-board-grid">
                    {pool.map(m => (
                        <div key={m.filename} className="gw-pick-card" onClick={() => {
                            setSecretMember(m);
                            setPhase('play');
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

    // ── Phase: won / giveup ────────────────────────────────────────────────────────────
    if (phase === 'won' || phase === 'giveup') {
        return (
            <div className="gw-screen gw-done-screen">
                <div className="gw-done-card">
                    <div className="gw-done-trophy">{phase === 'won' ? '🏆' : '🏳️'}</div>
                    <h2 className="gw-done-title">{phase === 'won' ? 'Player 2 Menang!' : 'Game Over!'}</h2>
                    <div className="gw-done-reveal-item">
                        <div className="gw-done-reveal-label">Member Rahasia nya adalah:</div>
                        <div className="gw-done-reveal-card">
                            <img src={secretMember.src} alt={secretMember.name} className="gw-done-photo"
                                onError={e => { e.target.style.display = 'none'; }} />
                            <div className="gw-done-name">{secretMember.name}</div>
                            <div className="gw-done-meta">{secretMember.generation}{secretMember.team ? ` • ${secretMember.team}` : ''}</div>
                        </div>
                    </div>
                    {guessHistory.length > 0 && (
                        <div className="gw-guess-history">
                            <div className="gw-guide-title">📋 Guess Log</div>
                            {guessHistory.map((h, i) => (
                                <div key={i} className={`gw-guess-log-item ${h.correct ? 'correct' : 'wrong'}`}>
                                    {h.correct ? '✅' : '❌'} {h.guess}
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="gw-btn-start" onClick={() => window.location.reload()}>Main Lagi 🔄</button>
                        <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Phase: play ────────────────────────────────────────────────────────────────
    return (
        <div className="gw-screen gw-game-screen">
            <div className="gw-topbar">
                <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                <div className="gw-topbar-center">
                    <div className="gw-stat-pill">🃏 {pool.length - eliminated.size} Tersisa</div>
                    {eliminated.size > 0 && <div className="gw-stat-pill gw-stat-elim">❌ {eliminated.size} out</div>}
                </div>
                <button className="gw-btn-reveal"
                    onClick={() => { setPhase('giveup'); }}
                    disabled={phase !== 'play'}>Give Up 🏳️</button>
            </div>
            {message && (
                <div className={`gw-message-banner ${message.startsWith('🎉') ? 'gw-msg-win' : 'gw-msg-wrong'}`}>
                    {message}
                </div>
            )}
            <div className="gw-game-layout">
                <div className="gw-board-col">
                    <div className="gw-board-instructions">
                        Player 2: Klik kartu untuk eliminasi. Tanyakan pertanyaan ya/tidak kepada Player 1!
                    </div>
                    <Board members={pool} eliminated={eliminated} onToggle={toggle} revealedFilename={null} />
                </div>
                <div className="gw-sidebar">
                    {/* Player 1 secret peek — tap to reveal (hold device close to chest!) */}
                    <div
                        onClick={() => setPeekOpen(p => !p)}
                        style={{ cursor: 'pointer' }}
                    >
                        <SecretCard member={secretMember} revealed={peekOpen} />
                    </div>

                    {/* YES / NO — Player 1 answers questions about their secret */}
                    <div className="gw-host-secret-panel" style={{ marginTop: 0 }}>
                        <div className="gw-guide-title">💁 Player 1 — jawab pertanyaan:</div>
                        <div className="gw-answer-btns">
                            <button className="gw-answer-yes">✅ YES</button>
                            <button className="gw-answer-no">❌ NO</button>
                        </div>
                    </div>

                    {/* Final guess — Player 2 */}
                    {phase === 'play' && (
                        <div className="gw-guess-form">
                            <div className="gw-guess-label">🎯 Player 2 — final guess:</div>
                            <form className="gw-guess-row" onSubmit={e => { e.preventDefault(); handleGuess(); }}>
                                <input className="gw-guess-input" placeholder="Type member name…"
                                    value={guessInput} onChange={e => setGuessInput(e.target.value)}
                                    enterKeyHint="send" autoComplete="off"
                                    list="gw-member-list-sp" />
                                <datalist id="gw-member-list-sp">
                                    {pool.map(m => <option key={m.filename} value={m.name} />)}
                                </datalist>
                                <button type="submit" className="gw-btn-guess">Guess!</button>
                            </form>
                        </div>
                    )}

                    <div className="gw-hint-guide">
                        <div className="gw-guide-title">💡 Cara Bermain</div>
                        <ul className="gw-guide-list">
                            <li><strong>Player 1:</strong> pilih member rahasia</li>
                            <li><strong>Player 2:</strong> ajukan pertanyaan ya/tidak, klik kartu untuk eliminasi</li>
                            <li><strong>Player 1:</strong> intip member rahasia dan jawab YA / TIDAK</li>
                            <li><strong>Player 2:</strong> kalau sudah siap, ketik namanya dan tebak!</li>
                        </ul>
                    </div>

                    {guessHistory.length > 0 && (
                        <div className="gw-guess-history">
                            <div className="gw-guide-title">📋 Guess Log</div>
                            {guessHistory.map((h, i) => (
                                <div key={i} className={`gw-guess-log-item ${h.correct ? 'correct' : 'wrong'}`}>
                                    {h.correct ? '✅' : '❌'} {h.guess}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE MULTIPLAYER — LOBBY INIT
// ────────────────────────────────────────────────────────────────────────────
function MultiLobby({ filters, joinCode, nickname, onBack }) {
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
                // myPlayer() may be null for a tick — poll until available,
                // then apply the nickname via setProfile (best-effort cosmetic).
                // The authoritative nickname is broadcast via Playroom state in OnlineGame.
                const tryProfile = (left) => {
                    try {
                        const player = myPlayer();
                        if (player) {
                            const name = nickname?.trim();
                            if (name) player.setProfile({ name });
                            setReady(true);
                            return;
                        }
                    } catch { /* ignore */ }
                    if (left > 0) setTimeout(() => tryProfile(left - 1), 100);
                    else setReady(true); // give up, show game anyway
                };
                tryProfile(15);
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

    return <OnlineGame allPool={pool} filters={filters} onBack={onBack} myNickname={nickname?.trim() || ''} />;
}

// ────────────────────────────────────────────────────────────────────────────
// ONLINE GAME — 2-player symmetric Guess Who
// Both players pick a secret. Both ask questions and answer about their own
// secret. Either player can submit a Final Guess targeting the OTHER player.
// The target player confirms/denies. First correct guess wins.
// ────────────────────────────────────────────────────────────────────────────
function OnlineGame({ allPool, filters, onBack, myNickname }) {
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
    // Two separate guess-result slots — one per player, each written by exactly one client (no race)
    // hostGuessEntry: result of host's guess, written by the GUEST (who is the target)
    // guestGuessEntry: result of guest's guess, written by the HOST (who is the target)
    const [hostGuessEntry, setHostGuessEntry] = useMultiplayerState('hostGuessEntry', null);
    const [guestGuessEntry, setGuestGuessEntry] = useMultiplayerState('guestGuessEntry', null);
    // hostPlayerId: written once by host so result screen knows which player is which
    const [hostPlayerId, setHostPlayerId] = useMultiplayerState('hostPlayerId', null);
    // Rematch votes — each player sets their own flag (no merge conflict)
    const [hostWantsRematch, setHostWantsRematch] = useMultiplayerState('hostWantsRematch', false);
    const [guestWantsRematch, setGuestWantsRematch] = useMultiplayerState('guestWantsRematch', false);
    // Nickname registry: host and guest each write to their own key — no merge conflicts
    const [hostNick, setHostNick] = useMultiplayerState('hostNick', '');
    const [guestNick, setGuestNick] = useMultiplayerState('guestNick', '');
    // messages uses plain useState + RPC so the RPC handler always has a stable setter reference
    const [messages, setMessages] = useState([]);

    // ── Local State ──
    const [mySecret, setMySecret] = useState(null);
    const [eliminated, setEliminated] = useState(new Set());
    const [chatInput, setChatInput] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const [pendingGuess, setPendingGuess] = useState(null); // non-null = confirm popup open
    const [iHaveSentGuess, setIHaveSentGuess] = useState(false); // true immediately after locking in
    const [roomCode, setRoomCode] = useState('');
    const [copied, setCopied] = useState(false);
    const chatEndRef = useRef(null);
    const processedGuessIds = useRef(new Set()); // tracks auto-confirmed guess message ids
    const mySecretRef = useRef(null);
    useEffect(() => { mySecretRef.current = mySecret; }, [mySecret]);

    // Register own nickname in Playroom state once on mount.
    // Uses isHost() (synchronous) instead of amHost (hook) because the hook
    // can still be false on the first render tick even for the actual host.
    useEffect(() => {
        if (!myNickname) return;
        if (isHost()) {
            setHostNick(myNickname);
            if (me?.id) setHostPlayerId(me.id);
        } else {
            setGuestNick(myNickname);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            sendMsg('Kedua pemain telah memilih member rahasia! Permainan dimulai ajukan pertanyaan ya/tidak!', 'system');
        }
    }, [pickedPlayers, phase, amHost]);

    // When both players have submitted a final guess, host ends the game
    useEffect(() => {
        if (phase !== 'play' || !amHost) return;
        if (!hostGuessEntry || !guestGuessEntry) return;
        // Determine winner: host won if hostGuessEntry.correct, guest won if guestGuessEntry.correct
        if (hostGuessEntry.correct) {
            setWinnerId(hostPlayerId);
        } else if (guestGuessEntry.correct) {
            const guestPlayer = players.find(p => p.id !== hostPlayerId);
            setWinnerId(guestPlayer?.id || null);
        } else {
            setWinnerId(null);
        }
        setPhase('done');
    }, [hostGuessEntry, guestGuessEntry, phase, amHost, hostPlayerId, players]);

    // When both want a rematch, host resets all shared state back to picking
    useEffect(() => {
        if (!hostWantsRematch || !guestWantsRematch) return;
        if (!amHost) return;
        // Reset shared game state
        setPhase('picking');
        setPickedPlayers({});
        setWinnerId(null);
        setHostGuessEntry(null);
        setGuestGuessEntry(null);
        setHostWantsRematch(false);
        setGuestWantsRematch(false);
    }, [hostWantsRematch, guestWantsRematch, amHost]);

    // Reset local state whenever phase goes back to picking (rematch started)
    const prevPhaseRef = useRef(phase);
    useEffect(() => {
        if (prevPhaseRef.current === 'done' && phase === 'picking') {
            setMySecret(null);
            setEliminated(new Set());
            setMessages([]);
            setIHaveSentGuess(false);
            setChatInput('');
            setGuessInput('');
            processedGuessIds.current = new Set();
        }
        prevPhaseRef.current = phase;
    }, [phase]);

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

    // Auto-confirm incoming guess messages that target me — compare with my secret
    useEffect(() => {
        if (!messages || !me) return;
        messages.forEach(msg => {
            if (msg.type !== 'guess' || msg.targetPlayerId !== me.id) return;
            if (processedGuessIds.current.has(msg.id)) return;
            const secret = mySecretRef.current;
            if (!secret) return;
            processedGuessIds.current.add(msg.id);
            const correct = msg.guessText.trim().toLowerCase() === secret.name.toLowerCase();
            const entry = { guessText: msg.guessText, correct, revealedFn: secret.filename };
            // Each client only writes to the slot for their OPPONENT's guess (no race condition)
            // If I'm the host, the guesser targeting me is the guest → write guestGuessEntry
            // If I'm the guest, the guesser targeting me is the host → write hostGuessEntry
            if (isHost()) setGuestGuessEntry(entry);
            else setHostGuessEntry(entry);
        });
    }, [messages, me]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Helper: use isHost() (synchronous) so the host/guest key decision is
    // always correct regardless of whether amHost hook has updated yet.
    const getPlayerName = useCallback((p) => {
        if (!p) return 'Unknown';
        const iAmHost = isHost();
        const pIsHost = iAmHost ? (p.id === me?.id) : (p.id !== me?.id);
        const nick = pIsHost ? hostNick : guestNick;
        return nick || p.getProfile()?.name || 'Unknown';
    }, [me, hostNick, guestNick]);

    const sendMsg = useCallback((text, type = 'chat', extra = {}) => {
        const profile = me?.getProfile() || {};
        const msg = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2),
            playerId: me?.id,
            player: (isHost() ? hostNick : guestNick) || myNickname || profile.name || 'Unknown',
            color: profile.color?.hexString || '#ffffff',
            text, type, ts: Date.now(), ...extra,
        };
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
        });
        RPC.call('newMsg', msg, RPC.Mode.OTHERS);
    }, [me, hostNick, guestNick, myNickname]);

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
                    <h2 className="gw-wait-title">Menunggu lawan…</h2>
                    <p className="gw-wait-sub">Bagikan kode ruang ke satu teman untuk memulai!</p>
                    {roomCode && (
                        <div className="gw-room-code-badge">
                            <div className="gw-room-code-badge-label">🔑 Kode Ruang — bagikan ini!</div>
                            <div className="gw-room-code-badge-val">{roomCode}</div>
                            <button className="gw-copy-btn" onClick={copyCode}>{copied ? '✓ Copied!' : 'Copy Code'}</button>
                        </div>
                    )}
                    <button className="gw-btn-back" style={{ marginTop: 8 }}
                        onClick={() => window.location.replace(window.location.pathname)}>
                        ✕ Cancel
                    </button>
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
                        <h2 className="gw-wait-title">Menunggu lawan…</h2>
                        <p className="gw-wait-sub">Anda telah memilih <strong style={{ color: '#f5c518' }}>{mySecret?.name}</strong>. Lawan Anda sedang memilih!</p>
                        <div className="gw-players-joined">
                            {players.map(p => {
                                const prof = p.getProfile();
                                const hasPicked = pickedPlayers && pickedPlayers[p.id];
                                return (
                                    <div key={p.id} className="gw-player-chip" style={{ borderColor: prof.color?.hexString || '#555' }}>
                                        <span className="gw-player-chip-dot" style={{ background: prof.color?.hexString || '#555' }} />
                                        {getPlayerName(p)} {hasPicked ? '✅' : '⏳'}
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
                    <h2 className="gw-pick-title">Pilih Member Rahasiamu</h2>
                    <p className="gw-pick-hint">
                        Lawan kalian akan menebak member ini, jangan beritahu/tunjukan kepada lawan kalian!
                        {other && <span style={{ color: '#f5c518' }}> {getPlayerName(other)} {otherHasPicked ? 'telah memilih ✅' : 'sedang memilih…'}</span>}
                    </p>
                    {roomCode && (
                        <div className="gw-room-code-badge" style={{ marginTop: 8 }}>
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
        return (
            <div className="gw-screen gw-done-screen">
                <div className="gw-done-card">
                    <div className="gw-done-trophy">{winner ? '🏆' : '🤝'}</div>
                    <h2 className="gw-done-title">
                        {winner ? `${getPlayerName(winner)} Wins!` : 'Both guessed wrong!'}
                    </h2>
                    <div className="gw-done-reveals">
                        {players.map(p => {
                            const prof = p.getProfile();
                            const isMe = p.id === me?.id;
                            const opponentPlayer = players.find(pl => pl.id !== p.id);
                            // Determine which guess entry belongs to player p
                            const pIsHost = p.id === hostPlayerId;
                            const guessEntry = pIsHost ? hostGuessEntry : guestGuessEntry;
                            const correctFn = guessEntry?.revealedFn;
                            const correctMember = correctFn && fullPool.find(m => m.filename === correctFn);
                            const guessedText = guessEntry?.guessText;
                            const wasCorrect = guessEntry?.correct;
                            return (
                                <div key={p.id} className="gw-done-reveal-item">
                                    <div className="gw-done-reveal-label" style={{ color: prof.color?.hexString }}>
                                        {isMe ? 'You' : getPlayerName(p)} menebak {opponentPlayer ? (isMe ? getPlayerName(opponentPlayer) : getPlayerName(players.find(pl => pl.id !== p.id))) + "'s" : "opponent's"} secret:
                                    </div>
                                    <div className="gw-done-guess-comparison">
                                        <div className="gw-done-guess-col">
                                            <div className="gw-done-guess-col-label">{isMe ? 'Your guess' : `${getPlayerName(p)}'s guess`}</div>
                                            <div className={`gw-done-guess-badge ${wasCorrect ? 'correct' : 'wrong'}`}>
                                                {wasCorrect ? '✅' : '❌'} {guessedText || '(no guess)'}
                                            </div>
                                        </div>
                                        <div className="gw-done-guess-arrow">vs</div>
                                        <div className="gw-done-guess-col">
                                            <div className="gw-done-guess-col-label">Jawaban yang benar</div>
                                            {correctMember ? (
                                                <div className="gw-done-reveal-card">
                                                    <img src={correctMember.src} alt={correctMember.name} className="gw-done-photo"
                                                        onError={e => { e.target.style.display = 'none'; }} />
                                                    <div className="gw-done-name">{correctMember.name}</div>
                                                    <div className="gw-done-meta">{correctMember.generation}{correctMember.team ? ` • ${correctMember.team}` : ''}</div>
                                                </div>
                                            ) : (
                                                <div className="gw-done-reveal-card gw-done-reveal-hidden">
                                                    <div className="gw-done-name">Unknown</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="gw-done-chat-log">
                        <div className="gw-guide-title">Game Chat</div>
                        <div className="gw-done-messages">
                            {messages.slice(-12).map(msg => (
                                <div key={msg.id} className={`gw-msg gw-msg-${msg.type}`}>
                                    {msg.type !== 'system' && <span className="gw-msg-player" style={{ color: msg.color }}>{msg.player}: </span>}
                                    <span className="gw-msg-text">{msg.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {/* Play Again — rematch with same opponent */}
                        {(() => {
                            const iAmHost = isHost();
                            const iVoted = iAmHost ? hostWantsRematch : guestWantsRematch;
                            const theyVoted = iAmHost ? guestWantsRematch : hostWantsRematch;
                            if (iVoted && !theyVoted) {
                                return (
                                    <div className="gw-rematch-waiting">
                                        ⏳ Menunggu {other ? getPlayerName(other) : 'opponent'} untuk main lagi…
                                    </div>
                                );
                            }
                            return (
                                <button className="gw-btn-start" onClick={() => {
                                    if (iAmHost) setHostWantsRematch(true);
                                    else setGuestWantsRematch(true);
                                }}>
                                    Main Lagi
                                </button>
                            );
                        })()}
                        <button className="gw-btn-back" onClick={() => window.location.replace(window.location.pathname)}>
                            ← Kembali ke menu
                        </button>
                    </div>
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

    // iHaveGuessed: use local flag so UI locks immediately without waiting for opponent to confirm
    const iHaveGuessed = iHaveSentGuess;

    // Open the confirm popup instead of sending immediately
    const handleFinalGuess = () => {
        if (!guessInput.trim() || !other || iHaveGuessed) return;
        setPendingGuess(guessInput.trim());
    };

    // Called when user confirms the popup — actually sends the guess
    const confirmAndSend = () => {
        if (!pendingGuess || !other || iHaveGuessed) return;
        sendMsg(`🔒 ${(isHost() ? hostNick : guestNick) || myNickname || 'Player'} telah mengunci jawaban!`, 'guess', {
            guessText: pendingGuess,
            targetPlayerId: other.id,
        });
        setGuessInput('');
        setPendingGuess(null);
        setIHaveSentGuess(true);
    };

    const answerYes = () => sendMsg('✅ YES!', 'answer');
    const answerNo = () => sendMsg('❌ NO!', 'answer');

    return (
        <>
            <div className="gw-screen gw-game-screen gw-online-game">
                {/* Top bar */}
                <div className="gw-topbar">
                    <button className="gw-btn-back" onClick={onBack}>← Menu</button>
                    <div className="gw-topbar-center">
                        <div className="gw-stat-pill">{pool.length - eliminated.size} left</div>
                        {eliminated.size > 0 && <div className="gw-stat-pill gw-stat-elim">{eliminated.size} out</div>}
                        {roomCode && (
                            <div className="gw-room-code-pill" onClick={copyCode} title="Click to copy">
                                {roomCode} {copied ? '✓' : ''}
                            </div>
                        )}
                    </div>
                    <div className="gw-players-pills">
                        {players.map(p => {
                            const prof = p.getProfile();
                            const displayName = getPlayerName(p);
                            return (
                                <div key={p.id} className="gw-player-dot" title={displayName}
                                    style={{ background: prof.color?.hexString || '#888' }}>
                                    {displayName?.charAt(0)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="gw-game-layout">
                    {/* Board */}
                    <div className="gw-board-col">
                        <div className="gw-board-instructions">
                            Pilih member untuk menyingkirkan. Ajukan pertanyaan ya/tidak dan jawab tentang member rahasia Lawan!
                        </div>
                        <Board members={pool} eliminated={eliminated} onToggle={toggle} revealedFilename={null} />
                    </div>

                    {/* Sidebar */}
                    <div className="gw-sidebar">
                        {/* My secret panel — both players see their own */}
                        {mySecret && (
                            <div className="gw-host-secret-panel">
                                <div className="gw-guide-title"> Member Rahasiamu</div>
                                <div className="gw-host-secret-card">
                                    <div className="gw-host-secret-frame">
                                        <img className="gw-host-secret-photo" src={mySecret.src} alt={mySecret.name}
                                            onError={e => { e.target.style.display = 'none'; }} />
                                    </div>
                                    <div className="gw-host-secret-info">
                                        <div className="gw-host-secret-name">{mySecret.name}</div>
                                        <div className="gw-host-secret-meta">{mySecret.generation}{mySecret.team ? ` • ${mySecret.team}` : ''}</div>
                                        <div className={`gw-host-status ${mySecret.isActive ? 'active' : 'ex'}`}>
                                            {mySecret.isActive ? 'Active' : 'Ex-Member'}
                                        </div>
                                    </div>
                                </div>
                                {/* Both players answer questions about THEIR OWN secret */}
                                <div className="gw-answer-btns">
                                    <div className="gw-answer-label">Jawaban Tentang Membermu</div>
                                    <button className="gw-answer-yes" onClick={answerYes}>✅ YA</button>
                                    <button className="gw-answer-no" onClick={answerNo}>❌ TIDAK</button>
                                </div>
                            </div>
                        )}

                        {/* Chat */}
                        <div className="gw-chat-box">
                            <div className="gw-chat-header">
                                Obrolan
                                <span className="gw-chat-hint" style={{ marginLeft: '12px' }}>Ajukan pertanyaan • Jawaban tentang member rahasia</span>
                            </div>
                            <div className="gw-chat-messages">
                                {messages.length === 0 && (
                                    <div className="gw-chat-empty">Tanyakan pertanyaan ya/tidak tentang rahasia Lawan!</div>
                                )}
                                {messages.map(msg => (
                                    <div key={msg.id} className={`gw-msg gw-msg-${msg.type}`}>
                                        {msg.type !== 'system' && (
                                            <span className="gw-msg-player" style={{ color: msg.color }}>{msg.player}:</span>
                                        )}
                                        <span className="gw-msg-text">{msg.text}</span>
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
                        {iHaveGuessed ? (
                            <div className="gw-guess-form gw-guess-submitted">
                                <div className="gw-guess-label">✅ Jawaban Terkunci</div>
                                <div className="gw-guess-waiting">Menunggu {other ? getPlayerName(other) : 'Lawan'} untuk Mengunci Jawaban</div>
                            </div>
                        ) : (
                            <div className="gw-guess-form">
                                <div className="gw-guess-label"> Tebak Siapa Member Rahasia Lawan</div>
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
                                    <button type="submit" className="gw-btn-guess">Kunci!</button>
                                </form>
                            </div>
                        )}

                        <div className="gw-hint-guide">
                            <div className="gw-guide-title">Cara Bermain</div>
                            <ul className="gw-guide-list">
                                <li>Ajukan pertanyaan ya/tidak tentang member rahasia Lawan</li>
                                <li>Jawab <strong>YA ✅ / TIDAK ❌</strong> tentang member rahasia mu</li>
                                <li>Tutup kartu untuk mengeliminasi anggota yang tidak cocok</li>
                                <li>Ketik nama dan tekan <strong>Kunci!</strong> — konfirmasi di popup</li>
                                <li>Hasil terungkap ketika kedua pemain telah mengunci!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Guess Confirmation Popup */}
            {pendingGuess && (
                <div className="gw-popup-overlay" onClick={() => setPendingGuess(null)}>
                    <div className="gw-popup-card" onClick={e => e.stopPropagation()}>
                        <div className="gw-popup-icon">🎯</div>
                        <div className="gw-popup-title">Yakin Mau Mengunci Jawaban?</div>
                        <div className="gw-popup-sub">Tebakanmu tentang member rahasia Lawan adalah:</div>
                        <div className="gw-popup-guess-name">{pendingGuess}</div>
                        <div className="gw-popup-warning">⚠️ Ini tidak bisa diubah setelah terkunci!</div>
                        <div className="gw-popup-btns">
                            <button className="gw-popup-cancel" onClick={() => setPendingGuess(null)}>Batal</button>
                            <button className="gw-popup-confirm" onClick={confirmAndSend}>🔒 Kunci!</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
