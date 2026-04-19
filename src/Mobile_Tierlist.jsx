import React, {
    useState, useEffect, useRef, useMemo, useCallback, memo
} from 'react';
import { useNavigate } from 'react-router-dom';
import * as memberData from './data/memberData';
import { setlistSongs } from './data/setlistSongs';
import { setlistFiles } from './data/SetlistData';
import { ssRamadanFiles } from './data/specialshowData';
import { mvFiles, spvFiles } from './data/spv_mv';
import {
    TIER_COLORS, getContrastColor, initialRows,
    formatSetlistName, formatVideoName,
} from './components/TierlistShared';

import domtoimage from 'dom-to-image-more';

// ─── Constants ────────────────────────────────────────────────────────────────
const activeMemberFiles = memberData.activeMemberFiles || [];
const exMemberFiles = memberData.exMemberFiles || [];
const timLoveList = memberData.tim_love || [];
const timLoveSet = new Set(timLoveList.map(f => f.toLowerCase()));

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const buildImageList = (tierlistTypeParam, memberType, generation, videoType) => {
    if (tierlistTypeParam === 'setlist') {
        return setlistFiles.map((f, i) => ({
            id: `setlist-${f}`, src: `/asset/Setlist/${f}`,
            name: formatSetlistName(f), containerId: 'pool', originalIndex: i
        }));
    }
    if (tierlistTypeParam === 'ramadan') {
        return ssRamadanFiles.map((f, i) => ({
            id: `ramadan-${f}`, src: `/asset/SSRamadan/${f}`,
            name: formatSetlistName(f), containerId: 'pool', originalIndex: i
        }));
    }
    if (tierlistTypeParam === 'video') {
        let vFiles = videoType === 'mv' ? mvFiles : videoType === 'spv' ? spvFiles : [...spvFiles, ...mvFiles];
        return vFiles.map((f, i) => ({
            id: `video-${f}`, src: `/asset/SPV_MV/${f}`,
            name: formatVideoName(f), containerId: 'pool', originalIndex: i
        }));
    }
    // member
    const matchesGen = (filename) => {
        if (generation === 'all') return true;
        const base = filename.includes('/') ? filename.split('/').pop() : filename;
        if (generation === 'genvall') return /^JKT48VGen\d+_/i.test(base) || /^JKT48V_Gen\d+_/i.test(base);
        if (generation.toLowerCase().startsWith('genv')) {
            const n = generation.slice(4);
            return base.startsWith(`JKT48V_Gen${n}_`) || base.startsWith(`JKT48VGen${n}_`);
        }
        if (generation.toLowerCase().startsWith('gen'))
            return base.startsWith(`Gen${generation.slice(3)}_`);
        return true;
    };
    let list = [], idx = 0;
    if (memberType === 'active' || memberType === 'all') {
        activeMemberFiles.filter(matchesGen).forEach(f => list.push({
            id: `member-${f}`, src: `/asset/member_active/${f}`,
            name: formatMemberName(f), isTimLove: timLoveSet.has(f.toLowerCase()),
            containerId: 'pool', originalIndex: idx++
        }));
    }
    if (memberType === 'ex' || memberType === 'all') {
        exMemberFiles.filter(matchesGen).forEach(f => list.push({
            id: `member-${f}`, src: `/asset/exmember/${f.replace(/\\/g, '/')}`,
            name: formatMemberName(f), isTimLove: timLoveSet.has(f.toLowerCase()),
            containerId: 'pool', originalIndex: idx++
        }));
    }
    return list;
};

const getSetlistImageInfo = (setlistName) => {
    const specialCases = { 'BELIEVE': 'BELIEVE', 'Fly! Team T': 'Fly!_Team_T', 'Ingin Bertemu': 'Ingin_Bertemu' };
    const filename = specialCases[setlistName] ||
        setlistName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    const extension = setlistName === 'Ingin Bertemu' ? 'webp' : 'jpg';
    return { filename, extension };
};

// ─── Item Card (memoized) ─────────────────────────────────────────────────────
const ItemCard = memo(({ item, isSelected, onTap, mode, isSong, setlistImgInfo, inTier }) => {
    const handleTap = useCallback((e) => {
        e.stopPropagation();
        onTap(item);
    }, [item, onTap]);

    const imgSrc = isSong
        ? `/asset/Setlist/${setlistImgInfo.filename}.${setlistImgInfo.extension}`
        : item.src;

    return (
        <div
            className={`mtl-card${isSelected ? ' mtl-card--selected' : ''}${item.isTimLove ? ' mtl-card--love' : ''}${inTier ? ' mtl-card--tier' : ''}`}
            onClick={handleTap}
            role="button"
            tabIndex={0}
            aria-label={item.name}
            aria-pressed={isSelected}
        >
            <div className="mtl-card__img-wrap">
                <img
                    src={imgSrc}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                />
                {isSelected && <div className="mtl-card__selected-badge">✓</div>}
                {item.isTimLove && <div className="mtl-card__love-badge">💖</div>}
            </div>
            {isSong
                ? <div className="mtl-card__name mtl-card__name--song">{item.name}</div>
                : <div className="mtl-card__name">{item.name}</div>
            }
        </div>
    );
});

// ─── Tier Row ─────────────────────────────────────────────────────────────────
const TierRowMobile = memo(({ row, items, selectedCount, onRowTap, onEdit, onClear, onMoveUp, onMoveDown, onDelete, isSong, setlistImgInfo, onItemTap, selectedItems, isFirst }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const textColor = getContrastColor(row.color);

    const handleRowTap = useCallback(() => {
        if (selectedCount > 0) onRowTap(row.id);
    }, [selectedCount, onRowTap, row.id]);

    return (
        <div className={`mtl-tier-row${selectedCount > 0 ? ' mtl-tier-row--droppable' : ''}`}
            style={{ borderLeft: `6px solid ${row.color}` }}>
            {/* Header */}
            <div className="mtl-tier-header"
                style={{ background: row.color }}
                onClick={handleRowTap}
            >
                <span className="mtl-tier-label" style={{ color: textColor }}>{row.name}</span>
                <button
                    className="mtl-tier-menu-btn"
                    style={{ color: textColor }}
                    onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    aria-label="Tier options"
                >
                    ⋯
                </button>
            </div>

            {/* Context menu */}
            {menuOpen && (
                <div className="mtl-tier-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { onMoveUp(row.id); setMenuOpen(false); }}>↑ Move Up</button>
                    <button onClick={() => { onMoveDown(row.id); setMenuOpen(false); }}>↓ Move Down</button>
                    <button onClick={() => { onEdit(row); setMenuOpen(false); }}>✏️ Edit</button>
                    <button onClick={() => { onClear(row.id); setMenuOpen(false); }}>🗑️ Clear</button>
                    <button className="mtl-tier-menu__danger" onClick={() => { onDelete(row.id); setMenuOpen(false); }}>❌ Delete</button>
                    <button onClick={() => setMenuOpen(false)}>Cancel</button>
                </div>
            )}

            {/* Drop hint */}
            {selectedCount > 0 && (
                <div className="mtl-tier-drop-hint" onClick={handleRowTap}>
                    Tap to place {selectedCount} item{selectedCount > 1 ? 's' : ''} here
                </div>
            )}

            {/* Items in this tier */}
            <div className="mtl-tier-content" onClick={handleRowTap}>
                {items.length === 0 && selectedCount === 0 && (
                    <div className="mtl-tier-empty">Empty</div>
                )}
                {items.map(item => (
                    <ItemCard
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        onTap={onItemTap}
                        isSong={isSong}
                        setlistImgInfo={setlistImgInfo}
                        inTier
                    />
                ))}
            </div>
        </div>
    );
});

// ─── Edit Row Sheet ───────────────────────────────────────────────────────────
const EditRowSheet = ({ row, onSave, onClose }) => {
    const [name, setName] = useState(row.name);
    const [color, setColor] = useState(row.color);

    return (
        <div className="mtl-sheet-overlay" onClick={onClose}>
            <div className="mtl-sheet" onClick={e => e.stopPropagation()}>
                <div className="mtl-sheet__handle" />
                <h3 className="mtl-sheet__title">Edit Tier</h3>
                <label className="mtl-sheet__label">Name
                    <input
                        className="mtl-sheet__input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={20}
                    />
                </label>
                <p className="mtl-sheet__label">Color</p>
                <div className="mtl-sheet__colors">
                    {TIER_COLORS.map(c => (
                        <button
                            key={c.value}
                            className={`mtl-sheet__color-btn${color === c.value ? ' mtl-sheet__color-btn--active' : ''}`}
                            style={{ background: c.value }}
                            onClick={() => setColor(c.value)}
                            title={c.name}
                            aria-label={c.name}
                        >
                            {color === c.value && <span style={{ color: getContrastColor(c.value) }}>✓</span>}
                        </button>
                    ))}
                </div>
                <div className="mtl-sheet__actions">
                    <button className="mtl-sheet__btn mtl-sheet__btn--cancel" onClick={onClose}>Cancel</button>
                    <button className="mtl-sheet__btn mtl-sheet__btn--save" onClick={() => onSave({ ...row, name, color })}>Save</button>
                </div>
            </div>
        </div>
    );
};

// ─── Welcome Sheet ────────────────────────────────────────────────────────────
const WelcomeSheet = ({ onClose }) => (
    <div className="mtl-sheet-overlay" onClick={onClose}>
        <div className="mtl-sheet mtl-sheet--welcome" onClick={e => e.stopPropagation()}>
            <div className="mtl-sheet__handle" />
            <div className="mtl-welcome-logo">🎀</div>
            <h2 className="mtl-sheet__title">JKT48 Tierlist Mobile</h2>
            <div className="mtl-welcome-steps">
                <div className="mtl-welcome-step">
                    <span className="mtl-welcome-step__icon">👆</span>
                    <div>
                        <strong>Tap to Select</strong>
                        <p>Tap items in the pool to select them (highlighted in pink).</p>
                    </div>
                </div>
                <div className="mtl-welcome-step">
                    <span className="mtl-welcome-step__icon">🎯</span>
                    <div>
                        <strong>Tap Tier to Place</strong>
                        <p>Tap a tier row header or the "Tap to place" hint to move selected items.</p>
                    </div>
                </div>
                <div className="mtl-welcome-step">
                    <span className="mtl-welcome-step__icon">↩️</span>
                    <div>
                        <strong>Return to Pool</strong>
                        <p>Tap any item already in a tier to move it back to the pool.</p>
                    </div>
                </div>
                <div className="mtl-welcome-step">
                    <span className="mtl-welcome-step__icon">⋯</span>
                    <div>
                        <strong>Tier Options</strong>
                        <p>Tap ⋯ on any tier header to edit, clear, or reorder tiers.</p>
                    </div>
                </div>
            </div>
            <p className="mtl-welcome-disclaimer">
                ⚠️ <em>Pembuat tidak bertanggung jawab atas akibat membagikan tierlist ini (termasuk donfol).</em>
            </p>
            <button className="mtl-sheet__btn mtl-sheet__btn--save mtl-welcome-cta" onClick={onClose}>
                Mengerti! Mulai 🚀
            </button>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MobileTierlist = () => {
    const navigate = useNavigate();
    const captureRef = useRef(null);

    // Mode: 'member' or 'song'
    const [mode, setMode] = useState('member');
    const [rows, setRows] = useState(initialRows);
    const [items, setItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [title, setTitle] = useState('');
    const [editingRow, setEditingRow] = useState(null);
    const [showWelcome, setShowWelcome] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [showConfirmReset, setShowConfirmReset] = useState(false);

    // Song-mode specific
    const [selectedSetlist, setSelectedSetlist] = useState('');
    const setlistImgInfo = useMemo(() => getSetlistImageInfo(selectedSetlist), [selectedSetlist]);

    // ── Load items on mount ────────────────────────────────────────────────────
    useEffect(() => {
        const tierlistType = localStorage.getItem('tierlistType') || 'member';
        const memberType = localStorage.getItem('memberType') || 'active';
        const generation = localStorage.getItem('generation') || 'all';
        const videoType = localStorage.getItem('videoType') || 'all';
        const setlistName = localStorage.getItem('selectedSetlist') || 'Aturan Anti Cinta';
        const draftId = localStorage.getItem('currentDraftId');

        if (tierlistType === 'song') {
            setMode('song');
            setSelectedSetlist(setlistName);
            let songList = (setlistSongs[setlistName] || []).map((name, i) => ({
                id: `song-${name}`, name, containerId: 'pool', originalIndex: i
            }));
            if (draftId) {
                const draft = loadDraft(draftId);
                if (draft) {
                    setRows(draft.rows || initialRows);
                    setTitle(draft.title || '');
                    songList = songList.map(s => {
                        const saved = (draft.songs || draft.images || []).find(d => d.id === s.id);
                        return saved ? { ...s, containerId: saved.containerId } : s;
                    });
                }
            }
            setItems(songList);
        } else {
            setMode('member');
            let imgList = buildImageList(tierlistType, memberType, generation, videoType);
            if (draftId) {
                const draft = loadDraft(draftId);
                if (draft) {
                    setRows(draft.rows || initialRows);
                    setTitle(draft.title || '');
                    imgList = imgList.map(img => {
                        const saved = (draft.images || []).find(d => d.id === img.id);
                        return saved ? { ...img, containerId: saved.containerId } : img;
                    });
                }
            }
            setItems(imgList);
        }
        localStorage.removeItem('currentDraftId');
    }, []);

    const loadDraft = (draftId) => {
        const manual = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        const auto = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        return [...manual, ...auto].find(d => d.id?.toString() === draftId?.toString()) || null;
    };

    // ── Auto-save every 5 placements ──────────────────────────────────────────
    const changeCounterRef = useRef(0);
    const prevPlacedRef = useRef(0);

    useEffect(() => {
        const placed = items.filter(i => i.containerId !== 'pool').length;
        if (placed !== prevPlacedRef.current) {
            prevPlacedRef.current = placed;
            changeCounterRef.current += 1;
            if (changeCounterRef.current >= 5) {
                changeCounterRef.current = 0;
                autoSave();
            }
        }
    }, [items]);

    const autoSave = useCallback(() => {
        const draft = {
            type: mode === 'song' ? 'song' : 'member',
            rows,
            images: items.map(i => ({ id: i.id, containerId: i.containerId })),
            songs: items.map(i => ({ id: i.id, containerId: i.containerId })),
            title,
            savedAt: new Date().toISOString(),
            isAutoSave: true,
            id: Date.now()
        };
        let drafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        drafts.unshift(draft);
        drafts = drafts.slice(0, 3);
        localStorage.setItem('tierlistAutoSaveDrafts', JSON.stringify(drafts));
    }, [mode, rows, items, title]);

    // ── Derived: map items by container ───────────────────────────────────────
    const byContainer = useMemo(() => {
        const map = {};
        for (const item of items) {
            if (!map[item.containerId]) map[item.containerId] = [];
            map[item.containerId].push(item);
        }
        return map;
    }, [items]);

    const poolItems = useMemo(() => {
        const pool = (byContainer['pool'] || []).slice().sort((a, b) => a.originalIndex - b.originalIndex);
        if (!searchTerm.trim()) return pool;
        const q = searchTerm.toLowerCase();
        return pool.filter(i => i.name.toLowerCase().includes(q));
    }, [byContainer, searchTerm]);

    const getTierItems = useCallback((rowId) => byContainer[rowId] || [], [byContainer]);

    // ── Interaction handlers ───────────────────────────────────────────────────
    const handleItemTap = useCallback((item) => {
        if (item.containerId !== 'pool') {
            // Return item to pool
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, containerId: 'pool' } : i));
            setSelectedItems(prev => { const s = new Set(prev); s.delete(item.id); return s; });
            showToast('Returned to pool');
        } else {
            // Toggle selection
            setSelectedItems(prev => {
                const s = new Set(prev);
                s.has(item.id) ? s.delete(item.id) : s.add(item.id);
                return s;
            });
        }
    }, []);

    const handleRowTap = useCallback((rowId) => {
        if (selectedItems.size === 0) return;
        setItems(prev => {
            let arr = [...prev];
            for (const selId of selectedItems) {
                const idx = arr.findIndex(i => i.id === selId);
                if (idx === -1 || arr[idx].containerId === rowId) continue;
                const [item] = arr.splice(idx, 1);
                // Find last index in target row
                let last = -1;
                for (let j = 0; j < arr.length; j++) if (arr[j].containerId === rowId) last = j;
                arr.splice(last + 1, 0, { ...item, containerId: rowId });
            }
            return arr;
        });
        setSelectedItems(new Set());
        showToast(`Placed ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}`);
    }, [selectedItems]);

    const handleClearSelection = () => setSelectedItems(new Set());

    // ── Row management ─────────────────────────────────────────────────────────
    const handleRowEdit = useCallback((row) => setEditingRow(row), []);

    const handleRowSave = useCallback((updatedRow) => {
        setRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
        setEditingRow(null);
    }, []);

    const handleRowMove = useCallback((rowId, dir) => {
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            const newIdx = dir === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const arr = [...prev];
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            return arr;
        });
    }, []);

    const handleRowClear = useCallback((rowId) => {
        setItems(prev => prev.map(i => i.containerId === rowId ? { ...i, containerId: 'pool' } : i));
    }, []);

    const handleRowDelete = useCallback((rowId) => {
        setItems(prev => prev.map(i => i.containerId === rowId ? { ...i, containerId: 'pool' } : i));
        setRows(prev => prev.filter(r => r.id !== rowId));
    }, []);

    const handleAddRow = () => {
        const id = `row-${Date.now()}`;
        setRows(prev => [...prev, { id, name: `Tier ${prev.length + 1}`, color: '#808080' }]);
    };

    const handleReset = () => {
        setRows(initialRows);
        setItems(prev => prev.map(i => ({ ...i, containerId: 'pool' })));
        setSelectedItems(new Set());
        setShowConfirmReset(false);
        showToast('Reset!');
    };

    // ── Draft save ─────────────────────────────────────────────────────────────
    const handleSaveDraft = () => {
        const draft = {
            type: mode,
            rows,
            images: items.map(i => ({ id: i.id, containerId: i.containerId })),
            songs: items.map(i => ({ id: i.id, containerId: i.containerId })),
            title,
            savedAt: new Date().toISOString(),
            isAutoSave: false,
            id: Date.now()
        };
        let drafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        drafts.unshift(draft);
        drafts = drafts.slice(0, 5);
        localStorage.setItem('tierlistManualDrafts', JSON.stringify(drafts));
        showToast('Draft saved!');
    };

    // ── Export as image ────────────────────────────────────────────────────────
    const handleSaveImage = async () => {
        if (!captureRef.current || isSaving) return;
        setIsSaving(true);
        showToast('Generating image…');
        try {
            await document.fonts.ready.catch(() => { });
            const el = captureRef.current;
            await Promise.all([...el.querySelectorAll('img')].map(img =>
                img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
            ));
            const scale = Math.max(2, window.devicePixelRatio || 1);
            const dataUrl = await domtoimage.toPng(el, {
                quality: 1.0,
                bgcolor: '#0f0f1a',
                scale,
                cacheBust: true
            });
            const link = document.createElement('a');
            link.download = 'jkt48-tierlist-mobile.png';
            link.href = dataUrl;
            link.click();
            showToast('Image saved! 🎉');
        } catch (e) {
            console.error(e);
            showToast('Export failed. Try screenshot instead.');
        } finally {
            setIsSaving(false);
        }
    };

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 2200);
    };

    const placedCount = items.filter(i => i.containerId !== 'pool').length;
    const totalCount = items.length;
    const progressPct = totalCount > 0 ? Math.round((placedCount / totalCount) * 100) : 0;

    return (
        <>
            <style>{MOBILE_CSS}</style>

            {/* Welcome sheet */}
            {showWelcome && <WelcomeSheet onClose={() => setShowWelcome(false)} />}

            {/* Edit row sheet */}
            {editingRow && (
                <EditRowSheet
                    row={editingRow}
                    onSave={handleRowSave}
                    onClose={() => setEditingRow(null)}
                />
            )}

            {/* Confirm reset sheet */}
            {showConfirmReset && (
                <div className="mtl-sheet-overlay" onClick={() => setShowConfirmReset(false)}>
                    <div className="mtl-sheet" onClick={e => e.stopPropagation()}>
                        <div className="mtl-sheet__handle" />
                        <h3 className="mtl-sheet__title">Reset Tierlist?</h3>
                        <p className="mtl-sheet__desc">All placements will be cleared. This cannot be undone.</p>
                        <div className="mtl-sheet__actions">
                            <button className="mtl-sheet__btn mtl-sheet__btn--cancel" onClick={() => setShowConfirmReset(false)}>Cancel</button>
                            <button className="mtl-sheet__btn mtl-sheet__btn--danger" onClick={handleReset}>Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toastMsg && <div className="mtl-toast">{toastMsg}</div>}

            <div className="mtl-root">
                {/* ── Header ── */}
                <header className="mtl-header">
                    <button className="mtl-header__back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
                    <div className="mtl-header__center">
                        <img src="/asset/icon/TierlistIcon.png" alt="logo" className="mtl-header__logo" />
                        <span className="mtl-header__title">JKT48 Tierlist</span>
                    </div>
                    <button className="mtl-header__help" onClick={() => setShowWelcome(true)} aria-label="Help">?</button>
                </header>

                {/* ── Progress bar ── */}
                <div className="mtl-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemax={100}>
                    <div className="mtl-progress-bar__fill" style={{ width: `${progressPct}%` }} />
                    <span className="mtl-progress-bar__label">{placedCount}/{totalCount} placed ({progressPct}%)</span>
                </div>

                {/* ── Title input ── */}
                <div className="mtl-title-wrap">
                    <input
                        className="mtl-title-input"
                        type="text"
                        placeholder={mode === 'song' ? `My ${selectedSetlist} Tierlist` : 'Tap to add title…'}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        maxLength={80}
                    />
                </div>

                {/* ── Tier rows (capture target) ── */}
                <div className="mtl-tier-section" ref={captureRef}>
                    {rows.map((row, i) => (
                        <TierRowMobile
                            key={row.id}
                            row={row}
                            items={getTierItems(row.id)}
                            selectedCount={selectedItems.size}
                            onRowTap={handleRowTap}
                            onEdit={handleRowEdit}
                            onClear={handleRowClear}
                            onMoveUp={(id) => handleRowMove(id, 'up')}
                            onMoveDown={(id) => handleRowMove(id, 'down')}
                            onDelete={handleRowDelete}
                            isSong={mode === 'song'}
                            setlistImgInfo={setlistImgInfo}
                            onItemTap={handleItemTap}
                            selectedItems={selectedItems}
                            isFirst={i === 0}
                        />
                    ))}
                </div>

                {/* ── Action bar ── */}
                <div className="mtl-action-bar">
                    <button className="mtl-action-btn mtl-action-btn--add" onClick={handleAddRow}>
                        <span>＋</span> Add Tier
                    </button>
                    <button className="mtl-action-btn mtl-action-btn--draft" onClick={handleSaveDraft}>
                        <span>💾</span> Draft
                    </button>
                    <button className="mtl-action-btn mtl-action-btn--reset" onClick={() => setShowConfirmReset(true)}>
                        <span>↺</span> Reset
                    </button>
                    <button className="mtl-action-btn mtl-action-btn--save" onClick={handleSaveImage} disabled={isSaving}>
                        <span>{isSaving ? '⏳' : '📷'}</span> {isSaving ? 'Saving…' : 'Save'}
                    </button>
                </div>

                {/* ── Pool ── */}
                <div className="mtl-pool-section">
                    <div className="mtl-pool-header">
                        <div className="mtl-pool-header__left">
                            <span className="mtl-pool-title">
                                {mode === 'song' ? `${selectedSetlist} Songs` : 'Available Items'}
                            </span>
                            <span className="mtl-pool-count">{poolItems.length}</span>
                        </div>
                        {selectedItems.size > 0 && (
                            <button className="mtl-pool-clear-sel" onClick={handleClearSelection}>
                                ✕ Deselect {selectedItems.size}
                            </button>
                        )}
                    </div>
                    <div className="mtl-search-wrap">
                        <span className="mtl-search-icon">🔍</span>
                        <input
                            className="mtl-search"
                            type="search"
                            placeholder={mode === 'song' ? 'Search songs…' : 'Search members…'}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="mtl-search-clear" onClick={() => setSearchTerm('')}>✕</button>
                        )}
                    </div>
                    <div className="mtl-pool-grid">
                        {poolItems.map(item => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                isSelected={selectedItems.has(item.id)}
                                onTap={handleItemTap}
                                mode={mode}
                                isSong={mode === 'song'}
                                setlistImgInfo={setlistImgInfo}
                                inTier={false}
                            />
                        ))}
                        {poolItems.length === 0 && (
                            <div className="mtl-pool-empty">
                                {searchTerm ? 'No results' : '🎉 All placed!'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Selection status bar */}
                {selectedItems.size > 0 && (
                    <div className="mtl-sel-bar">
                        <span>👆 {selectedItems.size} selected — tap a tier row to place</span>
                        <button onClick={handleClearSelection}>✕</button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── Inline CSS ───────────────────────────────────────────────────────────────
const MOBILE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.mtl-root {
    min-height: 100dvh;
    background: #0f0f1a;
    color: #f0f0f8;
    font-family: 'Inter', system-ui, sans-serif;
    padding-bottom: 6rem;
    overscroll-behavior: contain;
}

/* ── Header ── */
.mtl-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    background: rgba(15,15,26,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.mtl-header__back {
    font-size: 1.8rem;
    background: none;
    border: none;
    color: #f0f0f8;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
    touch-action: manipulation;
    line-height: 1;
}
.mtl-header__center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.mtl-header__logo { width: 28px; height: 28px; border-radius: 6px; }
.mtl-header__title { font-size: 1rem; font-weight: 700; letter-spacing: 0.5px; }
.mtl-header__help {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: none; color: #f0f0f8;
    font-size: 0.95rem; font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
}

/* ── Progress ── */
.mtl-progress-bar {
    position: relative;
    height: 4px;
    background: rgba(255,255,255,0.1);
}
.mtl-progress-bar__fill {
    height: 100%;
    background: linear-gradient(90deg, #e040fb, #ff6eb4);
    transition: width 0.4s ease;
    border-radius: 0 2px 2px 0;
}
.mtl-progress-bar__label {
    position: absolute;
    right: 8px;
    top: 6px;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.45);
    white-space: nowrap;
}

/* ── Title ── */
.mtl-title-wrap {
    padding: 0.75rem 1rem 0.25rem;
}
.mtl-title-input {
    width: 100%;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: #f0f0f8;
    font-size: 1rem;
    font-family: inherit;
    font-weight: 600;
    padding: 0.55rem 0.9rem;
    outline: none;
    transition: border-color 0.2s;
}
.mtl-title-input:focus { border-color: #e040fb; }
.mtl-title-input::placeholder { color: rgba(255,255,255,0.3); }

/* ── Tier section ── */
.mtl-tier-section {
    padding: 0.75rem 0 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.mtl-tier-row {
    background: rgba(255,255,255,0.04);
    border-radius: 0;
    overflow: hidden;
    border-left: 6px solid #888;
    transition: box-shadow 0.2s;
}
.mtl-tier-row--droppable {
    box-shadow: 0 0 0 2px #e040fb66, 0 4px 20px rgba(224,64,251,0.15);
}

.mtl-tier-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.75rem 0.55rem 0.85rem;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    min-height: 44px;
}
.mtl-tier-label {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.3px;
    flex: 1;
}
.mtl-tier-menu-btn {
    background: rgba(0,0,0,0.15);
    border: none;
    border-radius: 6px;
    font-size: 1.3rem;
    line-height: 1;
    padding: 0.15rem 0.5rem;
    cursor: pointer;
    touch-action: manipulation;
    min-width: 36px;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.mtl-tier-menu {
    background: #1e1e30;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    margin: 0 0.75rem 0.5rem;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.mtl-tier-menu button {
    display: block;
    width: 100%;
    padding: 0.7rem 1rem;
    background: none;
    border: none;
    color: #f0f0f8;
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    touch-action: manipulation;
    min-height: 44px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    transition: background 0.15s;
}
.mtl-tier-menu button:last-child { border-bottom: none; }
.mtl-tier-menu button:active { background: rgba(255,255,255,0.08); }
.mtl-tier-menu__danger { color: #ff6b6b !important; }

.mtl-tier-drop-hint {
    padding: 0.4rem 0.9rem;
    font-size: 0.78rem;
    color: #e040fb;
    cursor: pointer;
    touch-action: manipulation;
    font-weight: 500;
    background: rgba(224,64,251,0.07);
    animation: mtl-pulse 1.4s ease-in-out infinite;
}
@keyframes mtl-pulse { 0%,100%{opacity:.7} 50%{opacity:1} }

.mtl-tier-content {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem 0.6rem;
    min-height: 24px;
    cursor: pointer;
    touch-action: manipulation;
}
.mtl-tier-empty {
    font-size: 0.72rem;
    color: rgba(255,255,255,0.2);
    align-self: center;
    padding: 0.2rem 0;
    font-style: italic;
}

/* ── Action bar ── */
.mtl-action-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    overflow-x: auto;
    scrollbar-width: none;
}
.mtl-action-bar::-webkit-scrollbar { display: none; }
.mtl-action-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    padding: 0.6rem 1rem;
    border-radius: 10px;
    border: none;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    touch-action: manipulation;
    min-height: 40px;
    transition: opacity 0.2s, transform 0.1s;
    flex-shrink: 0;
}
.mtl-action-btn:active { transform: scale(0.96); opacity: 0.85; }
.mtl-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mtl-action-btn--add { background: rgba(99,102,241,0.25); color: #a5b4fc; border: 1.5px solid rgba(99,102,241,0.4); }
.mtl-action-btn--draft { background: rgba(20,184,166,0.2); color: #5eead4; border: 1.5px solid rgba(20,184,166,0.35); }
.mtl-action-btn--reset { background: rgba(245,158,11,0.2); color: #fcd34d; border: 1.5px solid rgba(245,158,11,0.35); }
.mtl-action-btn--save { background: linear-gradient(135deg, #e040fb, #ff6eb4); color: #fff; border: none; box-shadow: 0 4px 14px rgba(224,64,251,0.35); }

/* ── Pool ── */
.mtl-pool-section {
    padding: 0 0.75rem;
}
.mtl-pool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}
.mtl-pool-header__left { display: flex; align-items: center; gap: 0.5rem; }
.mtl-pool-title { font-size: 0.9rem; font-weight: 700; }
.mtl-pool-count {
    background: rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
}
.mtl-pool-clear-sel {
    background: rgba(224,64,251,0.2);
    border: 1.5px solid rgba(224,64,251,0.4);
    border-radius: 8px;
    color: #f5a6ff;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    touch-action: manipulation;
    min-height: 36px;
}

/* ── Search ── */
.mtl-search-wrap {
    position: relative;
    margin-bottom: 0.75rem;
}
.mtl-search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    pointer-events: none;
}
.mtl-search {
    width: 100%;
    background: rgba(255,255,255,0.07);
    border: 1.5px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: #f0f0f8;
    font-size: 0.9rem;
    font-family: inherit;
    padding: 0.55rem 2.5rem 0.55rem 2.3rem;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color 0.2s;
}
.mtl-search:focus { border-color: rgba(224,64,251,0.6); }
.mtl-search::placeholder { color: rgba(255,255,255,0.3); }
.mtl-search-clear {
    position: absolute;
    right: 0.6rem;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.12);
    border: none;
    border-radius: 50%;
    color: rgba(255,255,255,0.7);
    width: 22px; height: 22px;
    font-size: 0.7rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ── Pool grid ── */
.mtl-pool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 0.45rem;
    padding-bottom: 2rem;
}
.mtl-pool-empty {
    grid-column: 1/-1;
    text-align: center;
    padding: 2rem;
    color: rgba(255,255,255,0.3);
    font-size: 0.9rem;
}

/* ── Card ── */
.mtl-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 9px;
    overflow: hidden;
    cursor: pointer;
    touch-action: manipulation;
    background: rgba(255,255,255,0.05);
    border: 2px solid transparent;
    transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    -webkit-tap-highlight-color: transparent;
}
.mtl-card:active { transform: scale(0.94); }
.mtl-card--selected {
    border-color: #e040fb;
    box-shadow: 0 0 0 2px rgba(224,64,251,0.35), 0 4px 12px rgba(224,64,251,0.2);
    background: rgba(224,64,251,0.1);
}
.mtl-card--love { border-color: rgba(255,105,174,0.4); }
.mtl-card--tier {
    min-width: 60px;
}

.mtl-card__img-wrap {
    width: 100%;
    aspect-ratio: 3/4;
    overflow: hidden;
    position: relative;
    background: rgba(255,255,255,0.04);
}
.mtl-card--tier .mtl-card__img-wrap {
    width: 60px;
    height: 80px;
    aspect-ratio: unset;
    flex-shrink: 0;
}
.mtl-card__img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.mtl-card__selected-badge {
    position: absolute;
    top: 3px; right: 3px;
    background: #e040fb;
    color: #fff;
    border-radius: 50%;
    width: 18px; height: 18px;
    font-size: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
}
.mtl-card__love-badge {
    position: absolute;
    bottom: 2px; left: 3px;
    font-size: 0.65rem;
    line-height: 1;
}
.mtl-card__name {
    width: 100%;
    font-size: 0.6rem;
    text-align: center;
    padding: 0.2rem 0.15rem;
    line-height: 1.2;
    color: rgba(255,255,255,0.82);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(0,0,0,0.3);
}
.mtl-card__name--song {
    font-size: 0.58rem;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    padding: 0.25rem 0.2rem;
    min-height: 2.4em;
}

/* ── Bottom sheet ── */
.mtl-sheet-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: mtl-fade-in 0.2s ease;
}
@keyframes mtl-fade-in { from{opacity:0} to{opacity:1} }
.mtl-sheet {
    width: 100%;
    max-height: 90dvh;
    background: #1a1a2e;
    border-radius: 20px 20px 0 0;
    padding: 1rem 1.25rem 2.5rem;
    overflow-y: auto;
    animation: mtl-slide-up 0.28s cubic-bezier(0.4,0,0.2,1);
    border: 1px solid rgba(255,255,255,0.1);
    border-bottom: none;
}
@keyframes mtl-slide-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
.mtl-sheet__handle {
    width: 40px; height: 4px;
    background: rgba(255,255,255,0.18);
    border-radius: 2px;
    margin: 0 auto 1rem;
}
.mtl-sheet__title {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 1rem;
    text-align: center;
}
.mtl-sheet__label {
    display: block;
    font-size: 0.82rem;
    color: rgba(255,255,255,0.6);
    margin-bottom: 0.5rem;
}
.mtl-sheet__input {
    width: 100%;
    background: rgba(255,255,255,0.08);
    border: 1.5px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    color: #f0f0f8;
    font-size: 1rem;
    font-family: inherit;
    font-weight: 600;
    padding: 0.6rem 0.9rem;
    outline: none;
    margin-top: 0.3rem;
    margin-bottom: 1rem;
    display: block;
}
.mtl-sheet__colors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
}
.mtl-sheet__color-btn {
    width: 40px; height: 40px;
    border-radius: 8px;
    border: 2.5px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    touch-action: manipulation;
    transition: transform 0.1s;
}
.mtl-sheet__color-btn--active { border-color: #fff; transform: scale(1.15); }
.mtl-sheet__actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
}
.mtl-sheet__btn {
    flex: 1;
    padding: 0.8rem;
    border-radius: 12px;
    border: none;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    min-height: 48px;
    touch-action: manipulation;
}
.mtl-sheet__btn--cancel { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.mtl-sheet__btn--save { background: linear-gradient(135deg, #e040fb, #ff6eb4); color: #fff; }
.mtl-sheet__btn--danger { background: #ef4444; color: #fff; }
.mtl-sheet__desc { font-size: 0.9rem; color: rgba(255,255,255,0.6); text-align: center; margin-bottom: 1.25rem; line-height: 1.5; }

/* Welcome sheet extras */
.mtl-sheet--welcome { text-align: center; }
.mtl-welcome-logo { font-size: 2.5rem; margin-bottom: 0.5rem; }
.mtl-welcome-steps { text-align: left; margin: 1rem 0; display: flex; flex-direction: column; gap: 0.85rem; }
.mtl-welcome-step { display: flex; gap: 0.75rem; align-items: flex-start; }
.mtl-welcome-step__icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 0.1rem; }
.mtl-welcome-step strong { display: block; font-size: 0.9rem; margin-bottom: 0.15rem; }
.mtl-welcome-step p { font-size: 0.8rem; color: rgba(255,255,255,0.6); line-height: 1.4; }
.mtl-welcome-disclaimer { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin: 1rem 0; line-height: 1.5; }
.mtl-welcome-cta { width: 100%; margin-top: 0.5rem; }

/* ── Selection status bar ── */
.mtl-sel-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #e040fb, #ff6eb4);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 90;
    font-size: 0.85rem;
    font-weight: 600;
    animation: mtl-slide-up 0.2s ease;
    box-shadow: 0 -4px 20px rgba(224,64,251,0.4);
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
.mtl-sel-bar button {
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 50%;
    color: #fff;
    width: 28px; height: 28px;
    font-size: 0.85rem;
    cursor: pointer;
    flex-shrink: 0;
}

/* ── Toast ── */
.mtl-toast {
    position: fixed;
    bottom: 5rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30,30,50,0.95);
    border: 1px solid rgba(255,255,255,0.15);
    color: #f0f0f8;
    padding: 0.6rem 1.2rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    z-index: 1000;
    white-space: nowrap;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: mtl-toast-in 0.25s ease;
}
@keyframes mtl-toast-in { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
`;

export default MobileTierlist;
