import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, MenuItem, Checkbox, ListItemText } from '@mui/material';
import './Homepage.css';
import { setlistSongs } from './data/setlistSongs';
import { formatDistanceToNow } from 'date-fns';

const homepageLogo = '/asset/icon/HomepageLogo.png';
const tierlistLogo = '/asset/icon/TierlistIcon.png';

const STANDARD_GEN_COUNT = 14;
const V_GEN_COUNT = 2;

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

    const handleGenerationChange = (event) => {
        const { target: { value } } = event;
        let newValues = typeof value === 'string' ? value.split(',') : value;
        if (newValues.includes('all') && !generation.includes('all')) newValues = ['all'];
        else if (newValues.includes('all') && newValues.length > 1) newValues = newValues.filter(v => v !== 'all');
        if (newValues.length === 0) newValues = ['all'];
        setGeneration(newValues);
    };

    const handleSetlistChange = (event) => {
        const { target: { value } } = event;
        setSetlist(typeof value === 'string' ? value.split(',') : value);
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
                        <select className="hp2-select" value={tierlistType}
                            onChange={e => { setTierlistType(e.target.value); }}>
                            <option value="">— Pilih jenis —</option>
                            <option value="member">Tierlist Member</option>
                            <option value="setlist">Tierlist Setlist</option>
                            <option value="ramadan">Spesial Show Ramadan</option>
                            <option value="video">SPV & MV</option>
                            <option value="setlist_song">Lagu Setlist</option>
                        </select>

                        {/* Sub-filter */}
                        {tierlistType === 'video' && (
                            <select className="hp2-select" value={videoType} onChange={e => setVideoType(e.target.value)}>
                                <option value="all">SPV & MV</option>
                                <option value="mv">Hanya MV</option>
                                <option value="spv">Hanya SPV</option>
                            </select>
                        )}
                        {tierlistType === 'setlist_song' && (
                            <Select
                                multiple
                                displayEmpty
                                value={setlist}
                                onChange={handleSetlistChange}
                                renderValue={(selected) => {
                                    if (selected.length === 0) return <span style={{color: '#666888'}}>— Pilih setlist —</span>;
                                    return selected.join(', ');
                                }}
                                sx={{
                                    flex: 1, minWidth: 160, color: '#e8e8f0', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '10px',
                                    '.MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(255,255,255,0.1)' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e50014' },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e50014' },
                                    '.MuiSvgIcon-root': { color: '#666888' },
                                    height: '42px', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem'
                                }}
                                MenuProps={{ PaperProps: { style: { maxHeight: 300, backgroundColor: '#1a1030', color: '#e8e8f0' } } }}
                            >
                                {Object.keys(setlistSongs).map(s => (
                                    <MenuItem key={s} value={s} sx={{ '&.Mui-selected': { backgroundColor: 'rgba(229,0,20,0.2)' } }}>
                                        <Checkbox checked={setlist.indexOf(s) > -1} sx={{ color: '#e8e8f0', '&.Mui-checked': { color: '#e50014' }, padding: '4px 8px' }} />
                                        <ListItemText primary={s} />
                                    </MenuItem>
                                ))}
                            </Select>
                        )}
                    </div>
                </div>

                {/* Member sub-filters */}
                {tierlistType === 'member' && (
                    <div className="hp2-config-row">
                        <select className="hp2-select" value={memberType} onChange={e => setMemberType(e.target.value)}>
                            <option value="active">Member Aktif</option>
                            <option value="ex">Ex-Member</option>
                            <option value="all">Semua Member</option>
                        </select>
                        <Select
                            multiple
                            displayEmpty
                            value={generation}
                            onChange={handleGenerationChange}
                            renderValue={(selected) => {
                                if (selected.includes('all')) return 'Semua Generasi';
                                return selected.map(g => g.startsWith('genv') ? `JKT48V Gen ${g.replace('genv', '').replace('all', 'Semua')}` : g.startsWith('gen') ? `Gen ${g.slice(3)}` : g).join(', ');
                            }}
                            sx={{
                                flex: 1, minWidth: 160, color: '#e8e8f0', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '10px',
                                '.MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(255,255,255,0.1)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e50014' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e50014' },
                                '.MuiSvgIcon-root': { color: '#666888' },
                                height: '42px', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem'
                            }}
                            MenuProps={{ PaperProps: { style: { maxHeight: 300, backgroundColor: '#1a1030', color: '#e8e8f0' } } }}
                        >
                            <MenuItem value="all" sx={{ '&.Mui-selected': { backgroundColor: 'rgba(229,0,20,0.2)' } }}>
                                <Checkbox checked={generation.includes('all')} sx={{ color: '#e8e8f0', '&.Mui-checked': { color: '#e50014' }, padding: '4px 8px' }} />
                                <ListItemText primary="Semua Generasi" />
                            </MenuItem>
                            {Array.from({ length: STANDARD_GEN_COUNT }, (_, i) => i + 1).map(g => (
                                <MenuItem key={`gen${g}`} value={`gen${g}`} sx={{ '&.Mui-selected': { backgroundColor: 'rgba(229,0,20,0.2)' } }}>
                                    <Checkbox checked={generation.indexOf(`gen${g}`) > -1} sx={{ color: '#e8e8f0', '&.Mui-checked': { color: '#e50014' }, padding: '4px 8px' }} />
                                    <ListItemText primary={`Generasi ${g}`} />
                                </MenuItem>
                            ))}
                            <MenuItem value="genvall" sx={{ '&.Mui-selected': { backgroundColor: 'rgba(229,0,20,0.2)' } }}>
                                <Checkbox checked={generation.includes('genvall')} sx={{ color: '#e8e8f0', '&.Mui-checked': { color: '#e50014' }, padding: '4px 8px' }} />
                                <ListItemText primary="Semua Generasi-V" />
                            </MenuItem>
                            {Array.from({ length: V_GEN_COUNT }, (_, i) => i + 1).map(g => (
                                <MenuItem key={`genv${g}`} value={`genv${g}`} sx={{ '&.Mui-selected': { backgroundColor: 'rgba(229,0,20,0.2)' } }}>
                                    <Checkbox checked={generation.indexOf(`genv${g}`) > -1} sx={{ color: '#e8e8f0', '&.Mui-checked': { color: '#e50014' }, padding: '4px 8px' }} />
                                    <ListItemText primary={`JKT48V Gen ${g}`} />
                                </MenuItem>
                            ))}
                        </Select>
                    </div>
                )}

                {/* Drafts */}
                {drafts.length > 0 && (
                    <div>
                        <div className="hp2-draft-label" style={{ marginBottom: 8 }}>Load Draft</div>
                        <select className="hp2-select" style={{ width: '100%' }} defaultValue="" onChange={handleDraftSelect}>
                            <option value="">— Pilih draft yang disimpan —</option>
                            {drafts.map(d => {
                                const ago = formatDistanceToNow(new Date(d.savedAt), { addSuffix: true })
                                    .replace(' minutes', 'm').replace(' minute', 'm')
                                    .replace(' hours', 'h').replace(' hour', 'h')
                                    .replace(' days', 'd').replace(' day', 'd')
                                    .replace(' ago', '').replace('about ', '');
                                return (
                                    <option key={d.id} value={d.id}>
                                        {d.isAutoSave ? `${d.title || 'Tanpa Judul'} (Otomatis)` : d.title || 'Tanpa Judul'} • {d.completion}% • {ago}
                                    </option>
                                );
                            })}
                        </select>
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
