import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';
import { setlistSongs } from './data/setlistSongs';
import { formatDistanceToNow } from 'date-fns';

const homepageLogo = '/asset/icon/HomepageLogo.png';
const tierlistLogo = '/asset/icon/TierlistIcon.png';

// ─── Running banner ──────────────────────────────────────────────────────────────
const TICKER_TEXT = 'Suka dengan Website ini? Dukung Saya dengan cara berdonasi untuk Hosting dan Domain di';
const TICKER_URL = 'https://tako.id/MrcellSbst';

function RunningBanner() {
    const item = (
        <span className="hp2-ticker-item">
            <span className="hp2-ticker-dot" />
            {TICKER_TEXT}&nbsp;:&nbsp;<a href={TICKER_URL} target="_blank" rel="noopener noreferrer">{TICKER_URL}</a>
        </span>
    );
    // Duplicate to fill the track for seamless loop
    return (
        <div className="hp2-ticker" role="marquee" aria-label="Pengumuman">
            <div className="hp2-ticker-track">
                {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="hp2-ticker-item">
                        <span className="hp2-ticker-dot" />
                        {TICKER_TEXT}&nbsp;:&nbsp;<a href={TICKER_URL} target="_blank" rel="noopener noreferrer">{TICKER_URL}</a>
                    </span>
                ))}
            </div>
        </div>
    );
}

import { memberData } from './data/newmemberdata';

// Derive generation counts from newmemberdata keys
const STANDARD_GEN_COUNT = Object.keys(memberData).filter(k => /^GEN \d+$/i.test(k)).length;
const V_GEN_COUNT = Object.keys(memberData).filter(k => /^JKT48V GEN \d+$/i.test(k)).length;

// ─── Custom multi-select dropdown (dark themed) ─────────────────────────────
function MultiCheckDropdown({ values, onChange, options, placeholder, renderLabel }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = (val) => {
        if (values.includes(val)) onChange(values.filter(v => v !== val));
        else onChange([...values, val]);
    };

    const label = renderLabel ? renderLabel(values) : (values.length === 0 ? placeholder : `${values.length} selected`);

    return (
        <div className="hp2-multi-dd" ref={ref}>
            <button className="hp2-multi-dd-btn" type="button" onClick={() => setOpen(o => !o)}>
                <span className="hp2-multi-dd-label">{label}</span>
                <span className="hp2-multi-dd-arrow">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="hp2-multi-dd-menu">
                    {options.map(opt => (
                        <label key={opt.value} className="hp2-multi-dd-item">
                            <input type="checkbox" checked={values.includes(opt.value)} onChange={() => handleToggle(opt.value)} />
                            <span>{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Generation multi-select dropdown (dark themed) ─────────────────────────
function GenerationDropdown({ generation, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = (value) => {
        if (value === 'all') { onChange(['all']); return; }
        const without = generation.filter(g => g !== 'all' && g !== value);
        if (generation.includes(value)) {
            onChange(without.length === 0 ? ['all'] : without);
        } else {
            onChange([...without, value]);
        }
    };

    const allGens = [
        { value: 'all', label: 'Semua Generasi' },
        ...Array.from({ length: STANDARD_GEN_COUNT }, (_, i) => ({ value: `gen${i + 1}`, label: `Generasi ${i + 1}` })),
        { value: 'genvall', label: 'Semua Generasi-V' },
        ...Array.from({ length: V_GEN_COUNT }, (_, i) => ({ value: `genv${i + 1}`, label: `JKT48V Gen ${i + 1}` })),
    ];

    const label = generation.includes('all')
        ? 'Semua Generasi'
        : generation.length === 1
            ? allGens.find(g => g.value === generation[0])?.label || generation[0]
            : `${generation.length} generasi`;

    return (
        <div className="hp2-multi-dd" ref={ref}>
            <button className="hp2-multi-dd-btn" type="button" onClick={() => setOpen(o => !o)}>
                <span className="hp2-multi-dd-label">{label}</span>
                <span className="hp2-multi-dd-arrow">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="hp2-multi-dd-menu">
                    {allGens.map((gen, idx) => (
                        <React.Fragment key={gen.value}>
                            {gen.value === 'genvall' && (
                                <div className="hp2-multi-dd-divider">
                                    <span>Virtual</span>
                                </div>
                            )}
                            <label className="hp2-multi-dd-item">
                                <input type="checkbox" checked={generation.includes(gen.value)} onChange={() => handleToggle(gen.value)} />
                                <span>{gen.label}</span>
                            </label>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
}
// ─── Custom single-select dropdown (dark themed) ────────────────────────────
function SingleDropdown({ value, onChange, options, placeholder, fullWidth }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value);
    const label = selected ? selected.label : (placeholder || '— Pilih —');

    return (
        <div className="hp2-multi-dd" ref={ref} style={fullWidth ? { width: '100%' } : undefined}>
            <button className="hp2-multi-dd-btn" type="button" onClick={() => setOpen(o => !o)}
                style={!selected ? { color: '#666888' } : undefined}>
                <span className="hp2-multi-dd-label">{label}</span>
                <span className="hp2-multi-dd-arrow">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="hp2-multi-dd-menu">
                    {options.map(opt => (
                        <div key={opt.value}
                            className={`hp2-single-dd-item${opt.value === value ? ' active' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}>
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-page: Tierlist config ──────────────────────────────────────────────────
function TierlistConfig({ onBack }) {
    const navigate = useNavigate();
    const [tierlistType, setTierlistType] = useState('');
    const [memberType, setMemberType] = useState('active');
    const [generation, setGeneration] = useState(['all']);
    const [videoType, setVideoType] = useState('all');
    const [setlist, setSetlist] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [toast, setToast] = useState('');

    useEffect(() => {
        if (!tierlistType) { setDrafts([]); return; }
        const manual = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        const auto = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        const relevant = [...manual, ...auto]
            .filter(d => d.type === tierlistType)
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        setDrafts(relevant);
    }, [tierlistType]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleDraftSelect = (e) => {
        const draftId = e.target.value;
        if (!draftId) return;
        localStorage.setItem('currentDraftId', draftId);
        const all = [
            ...JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]'),
            ...JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]'),
        ];
        const draft = all.find(d => d.id.toString() === draftId);
        if (draft.type === 'song') {
            localStorage.setItem('tierlistType', 'song');
            localStorage.setItem('selectedSetlist', draft.setlist);
            navigate('/tierlist');
        } else {
            localStorage.setItem('tierlistType', draft.type);
            navigate('/tierlist');
        }
    };

    const handleStart = () => {
        if (!tierlistType) { showToast('Silakan pilih jenis tierlist terlebih dahulu!'); return; }
        if (tierlistType === 'setlist_song' && setlist.length === 0) { showToast('Silakan pilih setlist terlebih dahulu!'); return; }
        localStorage.removeItem('currentDraftId');
        if (tierlistType === 'setlist' || tierlistType === 'ramadan') {
            localStorage.setItem('tierlistType', tierlistType);
            navigate('/tierlist');
        } else if (tierlistType === 'video') {
            localStorage.setItem('tierlistType', 'video');
            localStorage.setItem('videoType', videoType);
            navigate('/tierlist');
        } else if (tierlistType === 'setlist_song') {
            localStorage.setItem('tierlistType', 'song');
            localStorage.setItem('selectedSetlist', JSON.stringify(setlist));
            navigate('/tierlist');
        } else {
            localStorage.setItem('tierlistType', 'member');
            localStorage.setItem('memberType', memberType);
            localStorage.setItem('generation', JSON.stringify(generation));
            navigate('/tierlist');
        }
    };

    return (
        <>
            <div className="hp2-config-panel">
                {/* Type */}
                <div>
                    <div className="hp2-draft-label" style={{ marginBottom: 8 }}>Jenis Tierlist</div>
                    <div className="hp2-config-row">
                        <SingleDropdown
                            value={tierlistType}
                            onChange={setTierlistType}
                            placeholder="— Pilih jenis —"
                            options={[
                                { value: 'member', label: 'Tierlist Member' },
                                { value: 'setlist', label: 'Tierlist Setlist' },
                                { value: 'ramadan', label: 'Spesial Show Ramadan' },
                                { value: 'video', label: 'SPV & MV' },
                                { value: 'setlist_song', label: 'Lagu Setlist' },
                            ]}
                        />

                        {/* Sub-filter */}
                        {tierlistType === 'video' && (
                            <SingleDropdown
                                value={videoType}
                                onChange={setVideoType}
                                options={[
                                    { value: 'all', label: 'SPV & MV' },
                                    { value: 'mv', label: 'Hanya MV' },
                                    { value: 'spv', label: 'Hanya SPV' },
                                ]}
                            />
                        )}
                        {tierlistType === 'setlist_song' && (
                            <MultiCheckDropdown
                                values={setlist}
                                onChange={setSetlist}
                                options={Object.keys(setlistSongs).map(s => ({ value: s, label: s }))}
                                placeholder="— Pilih setlist —"
                                renderLabel={(sel) => sel.length === 0 ? '— Pilih setlist —' : sel.join(', ')}
                            />
                        )}
                    </div>
                </div>

                {/* Member sub-filters */}
                {tierlistType === 'member' && (
                    <div className="hp2-config-row">
                        <SingleDropdown
                            value={memberType}
                            onChange={setMemberType}
                            options={[
                                { value: 'active', label: 'Member Aktif' },
                                { value: 'ex', label: 'Ex-Member' },
                                { value: 'all', label: 'Semua Member' },
                            ]}
                        />
                        <GenerationDropdown generation={generation} onChange={setGeneration} />
                    </div>
                )}

                {/* Drafts */}
                {drafts.length > 0 && (
                    <div>
                        <div className="hp2-draft-label" style={{ marginBottom: 8 }}>Load Draft</div>
                        <SingleDropdown
                            value=""
                            onChange={(draftId) => {
                                if (!draftId) return;
                                handleDraftSelect({ target: { value: draftId } });
                            }}
                            placeholder="— Pilih draft yang disimpan —"
                            fullWidth
                            options={drafts.map(d => {
                                const ago = formatDistanceToNow(new Date(d.savedAt), { addSuffix: true })
                                    .replace(' minutes', 'm').replace(' minute', 'm')
                                    .replace(' hours', 'h').replace(' hour', 'h')
                                    .replace(' days', 'd').replace(' day', 'd')
                                    .replace(' ago', '').replace('about ', '');
                                return {
                                    value: d.id.toString(),
                                    label: `${d.isAutoSave ? `${d.title || 'Tanpa Judul'} (Otomatis)` : d.title || 'Tanpa Judul'} • ${d.completion}% • ${ago}`
                                };
                            })}
                        />
                    </div>
                )}

                <button className="hp2-start-btn" onClick={handleStart}>
                    Mulai Buat Tierlist
                </button>
            </div>
            {toast && <div className="hp2-toast">{toast}</div>}
        </>
    );
}

// ─── Tools page ────────────────────────────────────────────────────────────────
export function HomepageTools() {
    const navigate = useNavigate();
    const [showTierlistConfig, setShowTierlistConfig] = useState(false);

    return (
        <div className="hp2-root">
            <RunningBanner />
            <div className="hp2-bg"><div className="hp2-bg-grad" /><div className="hp2-bg-grid" /></div>
            <div className="hp2-content">

                {/* Back */}
                <div style={{ width: '100%', maxWidth: 960, marginBottom: 28 }}>
                    <button onClick={() => navigate('/')} style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
                        color: '#666888', padding: '7px 16px', cursor: 'pointer', fontSize: '0.85rem',
                        fontFamily: 'Inter,sans-serif', transition: 'color 0.2s, border-color 0.2s',
                    }}
                        onMouseEnter={e => { e.target.style.color = '#ccc'; e.target.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                        onMouseLeave={e => { e.target.style.color = '#666888'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                        ← Kembali
                    </button>
                </div>

                <div className="hp2-section">
                    <div className="hp2-section-label">Tools</div>
                    <div className="hp2-grid hp2-grid-2">

                        {/* Tierlist Maker */}
                        <div className="hp2-card hp2-card-red" onClick={() => setShowTierlistConfig(v => !v)} style={{ cursor: 'pointer' }}>
                            <div className="hp2-card-title">Tierlist Maker</div>
                            <div className="hp2-card-desc">
                                Peringkatkan member JKT48, setlist, lagu, SPV & MV dalam tierlist drag-and-drop.
                            </div>
                            <span className="hp2-tag hp2-tag-red">Member · Setlist · Video</span>
                            <div className="hp2-card-arrow">{showTierlistConfig ? '▲' : '▼'}</div>
                        </div>

                        {/* Dream Setlist */}
                        <div className="hp2-card hp2-card-purple" onClick={() => navigate('/dream-setlist')}>
                            <div className="hp2-card-title">Dream Setlist</div>
                            <div className="hp2-card-desc">
                                Bangun setlist theater impianmu dari seluruh katalog lagu JKT48 dan bagikan dengan penggemar lain.
                            </div>
                            <span className="hp2-tag hp2-tag-purple">Setlist Maker</span>
                            <div className="hp2-card-arrow">→</div>
                        </div>


                    </div>

                    {/* Inline Tierlist Config */}
                    {showTierlistConfig && (
                        <div style={{ marginTop: 16 }}>
                            <TierlistConfig />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Games page ─────────────────────────────────────────────────────────────────
export function HomepageGames() {
    const navigate = useNavigate();

    return (
        <div className="hp2-root">
            <RunningBanner />
            <div className="hp2-bg"><div className="hp2-bg-grad" /><div className="hp2-bg-grid" /></div>
            <div className="hp2-content">

                <div style={{ width: '100%', maxWidth: 960, marginBottom: 28 }}>
                    <button onClick={() => navigate('/')} style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
                        color: '#666888', padding: '7px 16px', cursor: 'pointer', fontSize: '0.85rem',
                        fontFamily: 'Inter,sans-serif', transition: 'color 0.2s, border-color 0.2s',
                    }}
                        onMouseEnter={e => { e.target.style.color = '#ccc'; e.target.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                        onMouseLeave={e => { e.target.style.color = '#666888'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                        ← Kembali
                    </button>
                </div>

                <div className="hp2-section">
                    <div className="hp2-section-label">Game</div>
                    <div className="hp2-grid hp2-grid-2">

                        <div className="hp2-card hp2-card-gold" onClick={() => navigate('/roulette')}>
                            <div className="hp2-card-title">Roulette Member</div>
                            <div className="hp2-card-desc">
                                Putar roulette dan biarkan takdir menentukan member JKT48 mana yang muncul. Cocok untuk memilih secara acak!
                            </div>
                            <span className="hp2-tag hp2-tag-gold">Luck · Random</span>
                            <div className="hp2-card-arrow">→</div>
                        </div>


                        <div className="hp2-card hp2-card-green" onClick={() => navigate('/guess-who')} style={{ position: 'relative' }}>
                            <span className="hp2-new-pill">New</span>
                            <div className="hp2-card-title">Guess Who?</div>
                            <div className="hp2-card-desc">
                                Game tebak member klasik, edisi JKT48! Ajukan pertanyaan ya/tidak untuk menebak member rahasia lawanmu.
                            </div>
                            <span className="hp2-tag hp2-tag-green">Multiplayer · Online</span>
                            <div className="hp2-card-arrow">→</div>
                        </div>


                        {/* Gacha - hidden
                        <div className="hp2-card hp2-card-pink" onClick={() => navigate('/gacha')}>
                            <span className="hp2-new-pill">New</span>
                            <div className="hp2-card-title">Gacha</div>
                            <div className="hp2-card-desc">
                                Pull dari gacha member JKT48 dan kumpulkan favoritmu. Seberapa beruntung kamu hari ini?
                            </div>
                            <span className="hp2-tag hp2-tag-pink">Collection · Fun</span>
                            <div className="hp2-card-arrow">→</div>
                        </div>
                        */}

                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Tierlist page (standalone) ─────────────────────────────────────────────────
export function HomepageTierlist() {
    const navigate = useNavigate();
    return (
        <div className="hp2-root">
            <RunningBanner />
            <div className="hp2-bg"><div className="hp2-bg-grad" /><div className="hp2-bg-grid" /></div>
            <div className="hp2-content">
                <div style={{ width: '100%', maxWidth: 700, marginBottom: 28 }}>
                    <button onClick={() => navigate('/tools')} style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
                        color: '#666888', padding: '7px 16px', cursor: 'pointer', fontSize: '0.85rem',
                        fontFamily: 'Inter,sans-serif',
                    }}>← Kembali</button>
                </div>
                <div className="hp2-section" style={{ maxWidth: 700 }}>
                    <div className="hp2-section-label">Tierlist Maker</div>
                    <TierlistConfig onBack={() => navigate('/tools')} />
                </div>
            </div>
        </div>
    );
}

// ─── Homepage (landing) ─────────────────────────────────────────────────────────
export default function Homepage() {
    const navigate = useNavigate();

    useEffect(() => {
        const vp = document.querySelector('meta[name=viewport]');
        const content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
        if (vp) vp.content = content;
        else { const m = document.createElement('meta'); m.name = 'viewport'; m.content = content; document.head.appendChild(m); }
    }, []);

    const navCards = [
        {
            icon: '', title: 'Tools', desc: 'Tierlist Maker, Dream Setlist, dan tools lainnya.',
            path: '/tools', accent: 'red', tag: 'Tierlist · Setlist', tagClass: 'red',
        },
        {
            icon: '', title: 'Game', desc: 'Putar Roulette Member dan pilih member favoritmu secara acak!',
            path: '/games', accent: 'gold', tag: 'Roulette', tagClass: 'gold',
        },
    ];

    return (
        <div className="hp2-root">
            <RunningBanner />
            {/* Animated BG */}
            <div className="hp2-bg">
                <div className="hp2-bg-grad" />
                <div className="hp2-bg-grid" />
            </div>

            <div className="hp2-content">
                {/* Hero */}
                <div className="hp2-hero">
                    <div className="hp2-logo-ring">
                        <div className="hp2-logo-inner">
                            <img src={homepageLogo} alt="JKT48 Fan Tools" className="hp2-logo-img" />
                        </div>
                    </div>
                    <span className="hp2-badge">Fan Tools · JKT48</span>
                    <h1 className="hp2-title">JKT48<br />FAN TOOLS</h1>
                    <p className="hp2-subtitle">
                        Pusat segala aktivitas untuk penggemar JKT48 — buat peringkat oshi, tebak member bersama teman, susun setlist impian, dan banyak lagi.
                    </p>
                </div>

                {/* Nav cards */}
                <div className="hp2-section">
                    <div className="hp2-section-label">Pilih kategori</div>
                    <div className="hp2-grid hp2-grid-2">
                        {navCards.map(c => (
                            <div key={c.path} className={`hp2-card hp2-card-${c.accent}`} onClick={() => navigate(c.path)} role="button" tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && navigate(c.path)}>
                                {c.icon && <span className="hp2-card-icon">{c.icon}</span>}
                                <div className="hp2-card-title">{c.title}</div>
                                <div className="hp2-card-desc">{c.desc}</div>
                                <span className={`hp2-tag hp2-tag-${c.tagClass}`}>{c.tag}</span>
                                <div className="hp2-card-arrow">→</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick-access */}
                <div className="hp2-section">
                    <div className="hp2-section-label">Quick Access</div>
                    <div className="hp2-grid">
                        {[
                            { icon: '', title: 'Tierlist Maker', desc: 'Rank members, setlists & more', path: '/homepagetierlist', accent: 'red', tag: 'Tools', tagClass: 'red' },
                            { icon: '', title: 'Guess Who?', desc: 'Play online with friends', path: '/guess-who', accent: 'green', tag: 'NEW · Game', tagClass: 'green', isNew: true },
                            { icon: '', title: 'Dream Setlist', desc: 'Build your dream concert', path: '/dream-setlist', accent: 'purple', tag: 'Tools', tagClass: 'purple' },
                            { icon: '', title: 'Member Roulette', desc: 'Spin to choose a member', path: '/roulette', accent: 'gold', tag: 'Game', tagClass: 'gold' },
                            // { icon: '', title: 'Gacha', desc: 'Test your luck today', path: '/gacha', accent: 'pink', tag: 'NEW · Game', tagClass: 'pink', isNew: true },
                        ].map(c => (
                            <div key={c.path} className={`hp2-card hp2-card-${c.accent}`} onClick={() => navigate(c.path)} role="button" tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && navigate(c.path)}>
                                {c.isNew && <span className="hp2-new-pill">New</span>}
                                {c.icon && <span className="hp2-card-icon">{c.icon}</span>}
                                <div className="hp2-card-title">{c.title}</div>
                                <div className="hp2-card-desc">{c.desc}</div>
                                <span className={`hp2-tag hp2-tag-${c.tagClass}`}>{c.tag}</span>
                                <div className="hp2-card-arrow">→</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
