import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DndContext, DragOverlay, KeyboardSensor, PointerSensor,
    useSensor, useSensors, pointerWithin,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    IconButton, Dialog, DialogTitle, DialogContent, TextField,
    Button, DialogActions, Menu, MenuItem, ListItemIcon, ListItemText,
    Grid, Box, Tooltip, Switch, FormControlLabel, Typography,
    InputAdornment, Paper, Chip,
} from '@mui/material';
import {
    Settings, ArrowUpward, ArrowDownward, Edit, Delete, Add,
    Refresh, Save, Check, ArrowBack, Search, MusicNote, Person,
    AutoAwesome,
} from '@mui/icons-material';
import domtoimage from 'dom-to-image-more';
import './Tierlist_Combined.css';

import * as memberData from './data/memberData';
import { mvFiles, spvFiles } from './data/spv_mv';
import { setlistFiles } from './data/SetlistData';
import { ssRamadanFiles } from './data/specialshowData';
import { setlistSongs } from './data/setlistSongs';
import {
    TIER_COLORS, getContrastColor, initialRows,
    formatSetlistName, formatVideoName,
    dropAnimation, Droppable, TierRow,
} from './components/TierlistShared';

// ─── Member name helpers ─────────────────────────────────────────────────────

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

const parseNameForSearch = (filename) => {
    if (!filename || typeof filename !== 'string') return '';
    const rawBase = filename.split('/').pop().split('.')[0];
    const baseName = rawBase.replace(/^(member|setlist|ramadan|video)-/i, '');
    const parts = baseName.split('_').filter(Boolean);
    const firstPart = parts[0] || '';
    const brandTokens = [];
    let genPart = '', nameParts = [];
    if (/^jkt48vgen\d+$/i.test(firstPart)) {
        const genNum = (firstPart.match(/\d+/) || [])[0] || '';
        genPart = genNum ? `genv${genNum}` : '';
        nameParts = parts.slice(1);
        brandTokens.push('jkt48v');
    } else if (firstPart.toUpperCase() === 'JKT48V') {
        const rest = parts.slice(1);
        const genToken = rest[0]?.toLowerCase().startsWith('gen') ? rest[0] : '';
        const genNum = (genToken.match(/\d+/) || [])[0] || '';
        genPart = genNum ? `genv${genNum}` : '';
        nameParts = genToken ? rest.slice(1) : rest;
        brandTokens.push('jkt48v');
    } else if (parts[0]?.toLowerCase().startsWith('gen')) {
        genPart = parts[0]; nameParts = parts.slice(1);
    } else { nameParts = parts; }
    return [...brandTokens, genPart, ...nameParts].filter(Boolean).join(' ').toLowerCase();
};

// ─── Data ────────────────────────────────────────────────────────────────────
const activeMemberFiles = memberData.activeMemberFiles || [];
const exMemberFiles     = memberData.exMemberFiles     || [];
const timLoveList       = memberData.tim_love          || [];
const timLoveSet        = new Set(timLoveList.map(f => f.toLowerCase()));

const buildImageList = (tierlistTypeParam, memberType, generation, videoType) => {
    let imageList = [];
    if (tierlistTypeParam === 'setlist') {
        imageList = setlistFiles.map((filename, index) => ({
            id: `setlist-${filename}`, src: `/asset/Setlist/${encodeURIComponent(filename)}`,
            name: formatSetlistName(filename), containerId: 'image-pool', originalIndex: index,
        }));
    } else if (tierlistTypeParam === 'ramadan') {
        imageList = ssRamadanFiles.map((filename, index) => ({
            id: `ramadan-${filename}`, src: `/asset/SSRamadan/${filename}`,
            name: formatSetlistName(filename), containerId: 'image-pool', originalIndex: index,
        }));
    } else if (tierlistTypeParam === 'video') {
        let videoFiles = [];
        if (videoType === 'all') videoFiles = [...spvFiles, ...mvFiles];
        else if (videoType === 'mv')  videoFiles = mvFiles;
        else if (videoType === 'spv') videoFiles = spvFiles;
        imageList = videoFiles.map((filename, index) => ({
            id: `video-${filename}`, src: `/asset/SPV_MV/${filename}`,
            name: formatVideoName(filename), containerId: 'image-pool', originalIndex: index,
        }));
    } else {
        const matchesGeneration = (filename) => {
            if (generation === 'all') return true;
            if (generation === 'genvall') {
                const base = filename.includes('/') ? filename.split('/').pop() : filename;
                return /^JKT48VGen\d+_/i.test(base) || /^JKT48V_Gen\d+_/i.test(base);
            }
            const base = filename.includes('/') ? filename.split('/').pop() : filename;
            if (generation.toLowerCase().startsWith('genv')) {
                const n = generation.slice(4);
                return base.startsWith(`JKT48V_Gen${n}_`) || base.startsWith(`JKT48VGen${n}_`);
            }
            if (generation.toLowerCase().startsWith('gen'))
                return base.startsWith(`Gen${generation.slice(3)}_`);
            return true;
        };
        let idx = 0;
        if (memberType === 'active' || memberType === 'all') {
            imageList = [...imageList, ...activeMemberFiles.filter(matchesGeneration).map(filename => ({
                id: `member-${filename}`, src: `/asset/member_active/${filename}`,
                name: formatMemberName(filename), isTimLove: timLoveSet.has(filename.toLowerCase()),
                containerId: 'image-pool', originalIndex: idx++,
            }))];
        }
        if (memberType === 'ex' || memberType === 'all') {
            imageList = [...imageList, ...exMemberFiles.filter(matchesGeneration).map(filename => ({
                id: `member-${filename}`, src: `/asset/exmember/${filename.replace(/\\/g, '/')}`,
                name: formatMemberName(filename), isTimLove: timLoveSet.has(filename.toLowerCase()),
                containerId: 'image-pool', originalIndex: idx++,
            }))];
        }
    }
    return imageList;
};

// ─── Member / Image card ─────────────────────────────────────────────────────
const MemberCard = React.memo(({ image, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.06)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : undefined,
    };
    return (
        <div
            className={`member-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''} ${image.isTimLove ? 'love' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick && onImageClick(image)}
            onContextMenu={(e) => { e.preventDefault(); if (image.containerId !== 'image-pool') onContextMenu?.(e, image); }}
        >
            <img src={image.src} alt={image.name} />
            <div className="member-name">{image.name}</div>
        </div>
    );
});

const SortableMemberCard = React.memo(({ image, isDragging, onImageClick, onContextMenu, isSelected, isDragMode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: image.id, data: { type: 'image', image },
    });
    const style = { transform: CSS.Transform.toString(transform), transition, cursor: isDragMode ? 'grab' : 'pointer' };
    const dragProps = isDragMode ? { ...attributes, ...listeners } : {};
    return (
        <div ref={setNodeRef} style={style} {...dragProps}
            onClick={() => !isDragMode && onImageClick?.(image)}>
            <MemberCard image={image} isDragging={isDragging}
                onImageClick={isDragMode ? onImageClick : null}
                onContextMenu={onContextMenu} isSelected={isSelected} isDragMode={isDragMode} />
        </div>
    );
});

// ─── Song card ───────────────────────────────────────────────────────────────
const SongCard = React.memo(({ song, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode, setlistImageInfo }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.06)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : undefined,
    };
    return (
        <div
            className={`song-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick?.(song)}
            onContextMenu={(e) => onContextMenu?.(e, song)}
        >
            <img
                src={`/asset/Setlist/${encodeURIComponent(`${setlistImageInfo.filename}.${setlistImageInfo.extension}`)}`}
                alt={song.name} className="song-background"
            />
            <div className="song-name">{song.name}</div>
        </div>
    );
});

const SortableSongCard = React.memo(({ image, isDragging, onImageClick, onContextMenu, isSelected, isDragMode, setlistImageInfo }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: image.id, data: { type: 'image', image },
    });
    const style = { transform: CSS.Transform.toString(transform), transition, cursor: isDragMode ? 'grab' : 'pointer' };
    const dragProps = isDragMode ? { ...attributes, ...listeners } : {};
    return (
        <div ref={setNodeRef} style={style} {...dragProps}
            onClick={() => !isDragMode && onImageClick?.(image)}>
            <SongCard song={image} isDragging={isDragging}
                onImageClick={isDragMode ? onImageClick : null}
                onContextMenu={onContextMenu} isSelected={isSelected}
                isDragMode={isDragMode} setlistImageInfo={setlistImageInfo} />
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const TierlistCombined = () => {
    const navigate = useNavigate();
    const tierlistRef  = useRef(null);
    const titleInputRef = useRef(null);
    const measureRef   = useRef(null);

    // ── Mode: 'image' (members/setlist/video) vs 'song' ──
    const [mode, setMode] = useState('image'); // 'image' | 'song'

    // ── Shared state ──
    const [rows, setRows]               = useState(initialRows);
    const [dialogOpen, setDialogOpen]   = useState(false);
    const [editingRow, setEditingRow]   = useState({ name: '', color: '' });
    const [activeId, setActiveId]       = useState(null);
    const [isDragMode, setIsDragMode]   = useState(true);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
    const [searchTerm, setSearchTerm]   = useState('');
    const [tierlistTitle, setTierlistTitle] = useState('');
    const [titlePosition, setTitlePosition] = useState({ left: 0, width: 0 });
    const [inputWidth, setInputWidth]   = useState(300);
    const [isSaving, setIsSaving]       = useState(false);
    const [showAutoSave, setShowAutoSave] = useState(false);
    const [changeCounter, setChangeCounter] = useState(0);
    const [availableCount, setAvailableCount] = useState(0);

    // ── Image-mode state ──
    const [tierlistType, setTierlistType] = useState('member');
    const [images, setImages]           = useState([]);

    // ── Song-mode state ──
    const [songs, setSongs]             = useState([]);
    const [selectedSetlist, setSelectedSetlist] = useState('');

    // ── sensors ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 1, delay: 50, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // ── Load on mount ──
    useEffect(() => {
        const storedType = localStorage.getItem('tierlistType') || 'member';
        setTierlistType(storedType);

        if (storedType === 'song') {
            setMode('song');
            const setlistName = localStorage.getItem('selectedSetlist') || 'Aturan Anti Cinta';
            setSelectedSetlist(setlistName);
            const songList = (setlistSongs[setlistName] || []).map((name, i) => ({
                id: `song-${name}`, name, containerId: 'image-pool', originalIndex: i,
            }));
            const draftId = localStorage.getItem('currentDraftId');
            if (draftId) {
                const all = [
                    ...JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]'),
                    ...JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]'),
                ];
                const d = all.find(x => x.id.toString() === draftId.toString());
                if (d) {
                    setRows(d.rows || initialRows);
                    setTierlistTitle(d.title || '');
                    setSongs(songList.map(s => {
                        const saved = (d.songs || []).find(x => x.id === s.id);
                        return saved ? { ...s, containerId: saved.containerId } : s;
                    }));
                } else { setSongs(songList); }
            } else { setSongs(songList); }
            localStorage.removeItem('currentDraftId');
        } else {
            setMode('image');
            const memberType = localStorage.getItem('memberType') || 'active';
            const generation = localStorage.getItem('generation') || 'all';
            const videoType  = localStorage.getItem('videoType')  || 'all';
            let imageList = buildImageList(storedType, memberType, generation, videoType);
            const draftId = localStorage.getItem('currentDraftId');
            if (draftId) {
                const all = [
                    ...JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]'),
                    ...JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]'),
                ];
                const d = all.find(x => x.id.toString() === draftId.toString());
                if (d) {
                    setRows(d.rows || initialRows);
                    setTierlistTitle(d.title || '');
                    imageList = imageList.map(img => {
                        const saved = (d.images || []).find(x => x.id === img.id);
                        return saved ? { ...img, containerId: saved.containerId } : img;
                    });
                }
            }
            setImages(imageList);
        }
    }, []);

    // ── Track change counter for auto-save ──
    const activeItems = mode === 'song' ? songs : images;
    useEffect(() => {
        const cur = activeItems.filter(x => x.containerId === 'image-pool').length;
        if (cur !== availableCount) {
            setAvailableCount(cur);
            setChangeCounter(p => p + 1);
        }
    }, [activeItems]);

    // ── Auto-save ──
    useEffect(() => {
        const threshold = mode === 'song' ? 2 : 5;
        if (changeCounter < threshold) return;
        const items = mode === 'song' ? songs : images;
        const draft = mode === 'song'
            ? { type: 'song', setlist: selectedSetlist, rows, songs: songs.map(s => ({ id: s.id, containerId: s.containerId })), title: tierlistTitle, isAutoSave: true, savedAt: new Date().toISOString() }
            : { type: tierlistType, rows, images: images.map(i => ({ id: i.id, containerId: i.containerId })), title: tierlistTitle, isAutoSave: true, savedAt: new Date().toISOString() };
        manageDrafts(draft, true);
        setChangeCounter(0);
        setShowAutoSave(true);
        setTimeout(() => setShowAutoSave(false), 2000);
    }, [changeCounter]);

    // ── Header sync row widths ──
    useLayoutEffect(() => {
        const container = tierlistRef.current;
        if (!container) return;
        const headers = Array.from(container.querySelectorAll('.row-header'));
        if (!headers.length) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const firstLabel = headers[0].querySelector('.row-name-label');
        ctx.font = firstLabel
            ? (() => { const cs = window.getComputedStyle(firstLabel); return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; })()
            : 'bold 1.1rem sans-serif';
        let maxPx = 0;
        headers.forEach(h => {
            const label = h.querySelector('.row-name-label');
            ((label?.textContent) || '').split(/\s+/).forEach(w => { if (w) maxPx = Math.max(maxPx, ctx.measureText(w).width); });
        });
        const cs = window.getComputedStyle(headers[0]);
        const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const btn = headers[0].querySelector('button');
        const btnW = btn ? btn.offsetWidth + 8 : 44;
        const newW = Math.ceil(maxPx + padH + btnW);
        const containerW = (document.querySelector('.tier-rows-container')?.getBoundingClientRect().width) || 1200;
        const guarantees = headers.map(h => {
            const drp = h.closest('.tier-row')?.querySelector('.droppable');
            const cur = drp ? drp.getBoundingClientRect().width : 650;
            return Math.min(Math.max(cur, 650), Math.max(containerW - newW, 650));
        });
        headers.forEach((h, i) => {
            h.style.width = `${newW}px`;
            const row = h.closest('.tier-row');
            if (row) row.style.minWidth = `${newW + guarantees[i]}px`;
        });
    }, [rows]);

    // ── Title input width sync ──
    useEffect(() => {
        const update = () => {
            if (!titleInputRef.current || !tierlistRef.current) return;
            const firstRow = tierlistRef.current.querySelector('.tier-row');
            if (!firstRow) return;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = window.getComputedStyle(titleInputRef.current).font;
            const textW = Math.ceil(ctx.measureText(tierlistTitle || titleInputRef.current.placeholder || '').width);
            const newW = Math.min(Math.max(300, textW + 24), firstRow.offsetWidth);
            setInputWidth(newW);
            const rowRect = firstRow.getBoundingClientRect();
            const cx = rowRect.left + rowRect.width / 2;
            setTitlePosition({ left: `${(cx / document.documentElement.clientWidth) * 100}%`, transform: 'translateX(-50%)', width: newW });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [tierlistTitle]);

    // ── Mobile zoom ──
    useEffect(() => {
        const update = () => {
            const isMobile = window.innerWidth < 1024;
            const vp = document.querySelector('meta[name=viewport]');
            if (isMobile) {
                const scale = window.innerWidth / 1024;
                const content = `width=1024, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no`;
                if (vp) vp.content = content; else { const m = document.createElement('meta'); m.name = 'viewport'; m.content = content; document.head.appendChild(m); }
            } else if (vp) { vp.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1'; }
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
    }, []);

    // ── Draft helpers ──
    const calculateCompletion = (items) => {
        if (!items?.length) return 0;
        return Math.round(items.filter(x => x.containerId !== 'image-pool').length / items.length * 100);
    };
    const manageDrafts = (draft, isAutoSave = false) => {
        const key = isAutoSave ? 'tierlistAutoSaveDrafts' : 'tierlistManualDrafts';
        const max = isAutoSave ? 3 : 5;
        let drafts = JSON.parse(localStorage.getItem(key) || '[]');
        drafts = drafts.filter(d => d.type === draft.type);
        drafts.unshift({ ...draft, completion: calculateCompletion(draft.songs || draft.images), isAutoSave, id: Date.now() });
        localStorage.setItem(key, JSON.stringify(drafts.slice(0, max)));
    };

    // ── Generic DnD helpers (shared by both modes) ──
    const getItems  = useCallback(() => mode === 'song' ? songs  : images, [mode, songs, images]);
    const setItems  = useCallback((fn) => mode === 'song' ? setSongs(fn) : setImages(fn), [mode]);

    const moveItem = (prevItems, activeItemId, targetId) => {
        const activeItem = prevItems.find(x => x.id === activeItemId);
        if (!activeItem || activeItem.containerId === targetId) return prevItems;
        const without = prevItems.filter(x => x.id !== activeItemId);
        let lastIdx = -1;
        for (let i = 0; i < without.length; i++) if (without[i].containerId === targetId) lastIdx = i;
        const updated = { ...activeItem, containerId: targetId };
        if (lastIdx === -1) return [...without, updated];
        without.splice(lastIdx + 1, 0, updated);
        return without;
    };

    const handleDragStart = useCallback(({ active }) => { if (!isDragMode) return; setActiveId(active.id); }, [isDragMode]);
    const handleDragOver  = useCallback(({ active, over }) => {
        if (!isDragMode || !over) return;
        const overId = over.id;
        const items  = getItems();
        if (items.find(x => x.id === overId)) {
            const a = items.find(x => x.id === active.id);
            const o = items.find(x => x.id === overId);
            if (a && o && a.containerId === o.containerId)
                setItems(prev => { const ai = prev.findIndex(x => x.id === active.id); const oi = prev.findIndex(x => x.id === overId); return arrayMove(prev, ai, oi); });
        } else if (rows.find(r => r.id === overId) || overId === 'image-pool') {
            setItems(prev => moveItem(prev, active.id, overId));
        }
    }, [isDragMode, getItems, setItems, rows]);
    const handleDragEnd = useCallback(({ active, over }) => {
        if (!isDragMode) return;
        if (!over) { setActiveId(null); return; }
        const overId = over.id;
        const items  = getItems();
        if (items.find(x => x.id === overId)) {
            const a = items.find(x => x.id === active.id);
            const o = items.find(x => x.id === overId);
            if (a && o && a.containerId === o.containerId)
                setItems(prev => { const ai = prev.findIndex(x => x.id === active.id); const oi = prev.findIndex(x => x.id === overId); return arrayMove(prev, ai, oi); });
        } else if (rows.find(r => r.id === overId) || overId === 'image-pool') {
            setItems(prev => moveItem(prev, active.id, overId));
        }
        setActiveId(null);
    }, [isDragMode, getItems, setItems, rows]);

    // ── Click-to-place handlers ──
    const handleImageClick = useCallback((image) => {
        if (isDragMode) return;
        setSelectedImages(prev => { const n = new Set(prev); n.has(image.id) ? n.delete(image.id) : n.add(image.id); return n; });
    }, [isDragMode]);
    const handleImageRightClick = useCallback((e, image) => {
        e.preventDefault();
        if (image.containerId !== 'image-pool')
            setItems(prev => prev.map(x => x.id === image.id ? { ...x, containerId: 'image-pool' } : x));
        setSelectedImages(prev => { const n = new Set(prev); n.delete(image.id); return n; });
    }, [setItems]);
    const handleTierClick = useCallback((tierId) => {
        if (isDragMode || !selectedImages.size) return;
        setItems(prev => {
            let next = [...prev];
            for (const selId of selectedImages) next = moveItem(next, selId, tierId);
            return next;
        });
        setTimeout(() => setSelectedImages(new Set()), 50);
    }, [isDragMode, selectedImages, setItems]);

    // ── Row CRUD ──
    const handleRowEdit   = useCallback((row) => { setEditingRow(row); setDialogOpen(true); }, []);
    const handleRowSave   = useCallback(() => { setRows(r => r.map(x => x.id === editingRow.id ? { ...x, ...editingRow } : x)); setDialogOpen(false); }, [editingRow]);
    const handleRowMove   = useCallback((rowId, dir) => {
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === prev.length - 1)) return prev;
            const nr = [...prev]; const ni = dir === 'up' ? idx - 1 : idx + 1;
            [nr[idx], nr[ni]] = [nr[ni], nr[idx]]; return nr;
        });
    }, []);
    const handleRowClear  = useCallback((rowId) => setItems(prev => prev.map(x => x.containerId === rowId ? { ...x, containerId: 'image-pool' } : x)), [setItems]);
    const handleRowDelete = useCallback((rowId) => { handleRowClear(rowId); setRows(p => p.filter(r => r.id !== rowId)); }, [handleRowClear]);
    const handleAddRow    = useCallback(() => setRows(p => [...p, { id: `row-${Date.now()}`, name: `New Tier ${p.length + 1}`, color: '#808080' }]), []);

    // ── Reset ──
    const handleReset = () => {
        setRows([...initialRows]);
        if (mode === 'song') {
            const name = localStorage.getItem('selectedSetlist') || 'Aturan Anti Cinta';
            setSongs((setlistSongs[name] || []).map((n, i) => ({ id: `song-${n}`, name: n, containerId: 'image-pool', originalIndex: i })));
        } else {
            setImages(buildImageList(
                localStorage.getItem('tierlistType')  || 'member',
                localStorage.getItem('memberType')    || 'active',
                localStorage.getItem('generation')    || 'all',
                localStorage.getItem('videoType')     || 'all',
            ));
        }
    };

    // ── Draft save/clear ──
    const handleSaveDraft = () => {
        const draft = mode === 'song'
            ? { type: 'song', setlist: selectedSetlist, rows, songs: songs.map(s => ({ id: s.id, containerId: s.containerId })), title: tierlistTitle, savedAt: new Date().toISOString() }
            : { type: tierlistType, rows, images: images.map(i => ({ id: i.id, containerId: i.containerId })), title: tierlistTitle, savedAt: new Date().toISOString() };
        manageDrafts(draft, false);
        alert('Tierlist saved as draft!');
    };
    const handleClearDraft = () => {
        if (!window.confirm('Clear all saved drafts?')) return;
        localStorage.removeItem('tierlistManualDrafts');
        localStorage.removeItem('tierlistAutoSaveDrafts');
        localStorage.removeItem('currentDraftId');
        alert('All drafts cleared!');
    };

    // ── Display label ──
    const getTierlistTypeDisplay = () => {
        if (mode === 'song') return `${selectedSetlist} Song`;
        switch (tierlistType) {
            case 'setlist': return 'Setlist';
            case 'ramadan': return 'Special Show Ramadan';
            case 'video':
                const vt = localStorage.getItem('videoType') || 'all';
                return vt === 'mv' ? 'Music Video' : vt === 'spv' ? 'Special Video' : 'SPV & MV';
            default: return 'Member';
        }
    };

    // ── Derived image/song groups ──
    const itemsByContainer = useMemo(() => {
        const items = mode === 'song' ? songs : images;
        const map = {};
        for (const x of items) { if (!map[x.containerId]) map[x.containerId] = []; map[x.containerId].push(x); }
        return map;
    }, [images, songs, mode]);

    const setlistImageInfo = useMemo(() => {
        const name = selectedSetlist || localStorage.getItem('selectedSetlist') || 'Aturan Anti Cinta';
        const specialCases = { 'BELIEVE': 'BELIEVE', 'Fly! Team T': 'Fly!_Team_T', 'Ingin Bertemu': 'Ingin_Bertemu' };
        const extensionMap  = { 'Ingin Bertemu': 'webp', 'Dream Bakudan': 'png' };
        const filename  = specialCases[name] || name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
        const extension = extensionMap[name] ?? 'jpg';
        return { filename, extension };
    }, [selectedSetlist]);

    const getItemsForContainer = useCallback((containerId) => {
        const container = itemsByContainer[containerId] || [];
        if (containerId === 'image-pool' && searchTerm) {
            const lower = searchTerm.toLowerCase();
            if (mode === 'song') {
                return [...container].filter(s => s.name.toLowerCase().includes(lower))
                    .sort((a, b) => a.originalIndex - b.originalIndex);
            }
            const rawWords = lower.split(/\s+/).filter(Boolean);
            const words = [];
            for (let i = 0; i < rawWords.length; i++) {
                const w = rawWords[i], nx = rawWords[i + 1];
                if ((w === 'gen' || w === 'genv') && nx && /^\d+$/.test(nx)) { words.push(`${w}${nx}`); i++; } else words.push(w);
            }
            return container.filter(img => {
                if (!img.id) return false;
                const sn = parseNameForSearch(img.id);
                const sd = `${sn} ${(img.name || '').toLowerCase()}`;
                return words.every(w => /^genv?\d+$/i.test(w) ? new RegExp(`\\b${w}\\b`, 'i').test(sn) : sd.includes(w));
            }).sort((a, b) => a.originalIndex - b.originalIndex);
        }
        if (containerId === 'image-pool')
            return [...container].sort((a, b) => a.originalIndex - b.originalIndex);
        return container;
    }, [itemsByContainer, searchTerm, mode]);

    const activeItem = activeId ? getItems().find(x => x.id === activeId) : null;

    // ── Save as image ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!tierlistRef.current || isSaving) return;
        setIsSaving(true);
        try {
            const rowsContainer = tierlistRef.current.querySelector('.tier-rows-container');
            if (!rowsContainer) return;
            if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
            await Promise.all(Array.from(rowsContainer.querySelectorAll('img')).map(img =>
                img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
            ));
            const clone = rowsContainer.cloneNode(true);
            Object.assign(clone.style, { backgroundColor: '#1a1a2e', width: `${rowsContainer.scrollWidth}px`, margin: '0', padding: '10px 20px', boxSizing: 'border-box', position: 'absolute', left: '-9999px', top: '0', transform: 'none', opacity: '1' });
            if (!tierlistTitle) {
                const bar = clone.querySelector('.tierlist-title-container');
                if (bar) bar.style.display = 'none';
            } else {
                const bar = clone.querySelector('.tierlist-title-container');
                const inp = clone.querySelector('.tierlist-title');
                if (bar) Object.assign(bar.style, { border: 'none', boxShadow: 'none', padding: '0', marginBottom: '8px', background: 'transparent' });
                if (inp) Object.assign(inp.style, { width: '100%', whiteSpace: 'normal', height: 'auto', overflow: 'visible', display: 'block', border: 'none', boxShadow: 'none', background: 'transparent', outline: 'none', padding: '4px 0' });
            }
            const strip = (el) => { if (!el?.style) return; el.style.animation = 'none'; el.style.transition = 'none'; if (el.style.opacity) el.style.opacity = '1'; [...(el.children || [])].forEach(strip); };
            strip(clone);
            document.body.appendChild(clone);
            const W = clone.scrollWidth, H = clone.scrollHeight;
            clone.style.width = `${W}px`; clone.style.height = `${H}px`;
            const SCALE = Math.max(2, window.devicePixelRatio || 1);
            const opts = { quality: 1.0, bgcolor: '#1a1a2e', width: W, height: H, scale: SCALE, style: { 'background-color': '#1a1a2e', width: `${W}px`, height: `${H}px`, transform: 'none' }, cacheBust: true };
            try {
                const url = await domtoimage.toPng(clone, opts);
                const a = document.createElement('a'); a.download = 'jkt48-tierlist.png'; a.href = url; a.click();
            } catch {
                const blob = await domtoimage.toBlob(clone, opts);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.download = 'jkt48-tierlist.png'; a.href = url; a.click();
                URL.revokeObjectURL(url);
            }
            document.body.removeChild(clone);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save image. Please try again or take a screenshot.');
        } finally { setIsSaving(false); }
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const renderSortableCard = useCallback((item) => mode === 'song'
        ? <SortableSongCard key={item.id} image={item} isDragging={item.id === activeId}
            onImageClick={handleImageClick} onContextMenu={handleImageRightClick}
            isSelected={selectedImages.has(item.id)} isDragMode={isDragMode}
            setlistImageInfo={setlistImageInfo} />
        : <SortableMemberCard key={item.id} image={item} isDragging={item.id === activeId}
            onImageClick={handleImageClick} onContextMenu={handleImageRightClick}
            isSelected={selectedImages.has(item.id)} isDragMode={isDragMode} />,
    [mode, activeId, handleImageClick, handleImageRightClick, selectedImages, isDragMode, setlistImageInfo]);

    const renderOverlayCard = useCallback(() => !activeItem ? null : mode === 'song'
        ? <SongCard song={activeItem} dragOverlay isDragMode={isDragMode} setlistImageInfo={setlistImageInfo} />
        : <MemberCard image={activeItem} dragOverlay isDragMode={isDragMode} />,
    [activeItem, mode, isDragMode, setlistImageInfo]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="tierlist-page">
            <header className="header">
                <IconButton onClick={() => navigate(-1)} sx={{ color: 'white', mr: 1 }}><ArrowBack /></IconButton>
                <div className="header-title-container">
                    <div className="header-main" onClick={() => navigate('/')}>
                        <img src="/asset/icon/TierlistIcon.png" alt="JKT48 Tierlist Logo" className="header-logo" />
                        <div className="header-titles"><h1 className="header-title">JKT48 Tierlist</h1></div>
                    </div>
                    {tierlistTitle && (
                        <div className="header-subtitle-container" style={{ left: titlePosition.left, width: titlePosition.width, transform: titlePosition.transform }}>
                            <h2 className="header-subtitle">{tierlistTitle}</h2>
                        </div>
                    )}
                </div>
            </header>

            {/* Welcome dialog */}
            <Dialog open={showWelcomeDialog} onClose={() => setShowWelcomeDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Selamat Datang di JKT48 Tierlist! 👋</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Panduan Penggunaan Tierlist:</Typography>
                        <Typography variant="body1" paragraph>1. Dua mode interaksi tersedia:</Typography>
                        <Box sx={{ pl: 3, mb: 2 }}>
                            <Typography variant="body1" gutterBottom>• <strong>Drag &amp; Drop Mode:</strong> Seret item ke tier tujuan</Typography>
                            <Typography variant="body1" gutterBottom>• <strong>Select to Place Mode:</strong> Klik item, lalu klik tier. Klik kanan untuk kembalikan ke pool</Typography>
                        </Box>
                        <Typography variant="body1" paragraph>2. <strong>Mobile User:</strong> Dioptimalkan untuk desktop, silakan zoom out.</Typography>
                        <Typography variant="body1">3. Gunakan tombol di bawah untuk tambah tier, reset, atau simpan gambar.</Typography>
                        <Typography variant="body1" sx={{ mt: 2, color: '#ff69b4' }}>
                            <strong>Disclaimer:</strong> Pembuat tidak bertanggung jawab atas akibat dari membagikan tierlist ini.
                        </Typography>
                        <Typography sx={{ mt: 2, color: '#ff69b4', textAlign: 'center' }}>
                            <span style={{ fontSize: '1.2rem' }}>˚˖𓍢ִ໋🌷͙֒✧˚.🎀༘⋆ HIDUP TIM LOVE ˚˖𓍢ִ໋🌷͙֒✧˚.🎀༘⋆</span>
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowWelcomeDialog(false)} variant="contained" color="primary">Mengerti!</Button>
                </DialogActions>
            </Dialog>

            {/* DnD context */}
            <DndContext sensors={sensors} collisionDetection={pointerWithin}
                onDragStart={handleDragStart} onDragOver={handleDragOver}
                onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
                <div className="tierlist-container" ref={tierlistRef}>

                    {/* Tier rows */}
                    <div className="tier-rows-container" ref={measureRef}>
                        <div className="tierlist-title-container" style={{ marginTop: 0, marginBottom: 5, display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <input ref={titleInputRef} type="text" className="tierlist-title"
                                value={tierlistTitle} onChange={e => setTierlistTitle(e.target.value)}
                                placeholder={mode === 'song' ? `My ${selectedSetlist} Tierlist` : 'Click Here to Add Title'}
                                spellCheck="false" maxLength={90}
                                style={{ width: `${inputWidth}px`, fontSize: '32px', padding: '8px 12px' }} />
                        </div>

                        {rows.map((row, index) => (
                            <div key={row.id}
                                className={`tier-row ${index === 0 ? 'first-tier-row' : ''}`}
                                onClick={() => handleTierClick(row.id)}
                                style={{ cursor: (!isDragMode && selectedImages.size > 0) ? 'pointer' : 'default', opacity: (!isDragMode && selectedImages.size > 0) ? 0.8 : 1 }}>
                                <TierRow row={row} onMove={handleRowMove} onEdit={handleRowEdit}
                                    onClear={handleRowClear} onDelete={handleRowDelete} isFirstRow={index === 0} />
                                <Droppable id={row.id}>
                                    <div className="tier-content">
                                        {(() => { const rowItems = getItemsForContainer(row.id); return (
                                        <SortableContext items={rowItems.map(x => x.id)} strategy={rectSortingStrategy}>
                                            {rowItems.length === 0 && (
                                                <div className="tier-empty-placeholder"><span>Drop here</span></div>
                                            )}
                                            {rowItems.map(renderSortableCard)}
                                        </SortableContext>
                                        ); })()}
                                    </div>
                                </Droppable>
                            </div>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="tierlist-button-container">
                        <FormControlLabel
                            control={<Switch checked={isDragMode} onChange={e => { setIsDragMode(e.target.checked); setSelectedImages(new Set()); }} color="primary" />}
                            label={
                                <div style={{ color: 'white' }}>
                                    {isDragMode ? 'Drag & Drop Mode' : 'Click to Place Mode'}
                                    {!isDragMode && <span style={{ fontSize: '0.8em', display: 'block', color: '#aaa' }}>Right-click to return to pool</span>}
                                </div>
                            }
                        />
                        <Button variant="contained" color="primary"   startIcon={<Add />}     onClick={handleAddRow}    className="action-button">Add New Tier</Button>
                        <Button variant="contained" color="secondary"  startIcon={<Refresh />} onClick={handleReset}     className="action-button">Reset</Button>
                        <Button variant="contained" color="success"    startIcon={isSaving ? <span className="save-spinner" /> : <Save />} onClick={handleSave} disabled={isSaving} className="action-button">{isSaving ? 'Saving…' : 'Save as Image'}</Button>
                        <Button variant="contained" color="info"       startIcon={<Save />}   onClick={handleSaveDraft}  className="action-button">Save Draft</Button>
                        <Button variant="contained" color="error"      startIcon={<Delete />} onClick={handleClearDraft} className="action-button">Clear Draft</Button>
                    </div>

                    {/* Item pool */}
                    <div className="image-pool-container">
                        <div className="image-pool-header">
                            <h2>
                                {getTierlistTypeDisplay()}s ({getItemsForContainer('image-pool').length})
                                {!isDragMode && selectedImages.size > 0 && (
                                    <span style={{ fontSize: '0.8em', marginLeft: 10, color: '#4CAF50' }}>
                                        {selectedImages.size} selected
                                        <button onClick={e => { e.stopPropagation(); setSelectedImages(new Set()); }}
                                            style={{ marginLeft: 8, fontSize: '0.85em', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 4, color: '#fff', padding: '1px 7px' }}>
                                            ✕ Clear
                                        </button>
                                    </span>
                                )}
                            </h2>
                            <Paper component="form" sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: { xs: '100%', sm: '300px' }, backgroundColor: '#1e1e38', ml: { xs: 0, sm: 2 }, border: '1px solid rgba(255,255,255,0.08)' }}>
                                <InputAdornment position="start" sx={{ pl: 1 }}>
                                    <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                                </InputAdornment>
                                <TextField
                                    sx={{ flex: 1, '& .MuiInputBase-input': { color: 'white', pl: 1, '&::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 } }, '& .MuiInputBase-root': { '&:before, &:after': { display: 'none' }, padding: '4px 8px' } }}
                                    placeholder={mode === 'song' ? 'Search songs…' : `Search ${tierlistType === 'setlist' ? 'setlists' : 'members'}…`}
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    variant="standard" fullWidth inputProps={{ style: { paddingLeft: 8 } }}
                                />
                            </Paper>
                        </div>
                        <Droppable id="image-pool">
                            <div className="image-pool">
                                {(() => { const poolItems = getItemsForContainer('image-pool'); return (
                                <SortableContext items={poolItems.map(x => x.id)} strategy={rectSortingStrategy}>
                                    {poolItems.map(renderSortableCard)}
                                </SortableContext>
                                ); })()}
                            </div>
                        </Droppable>
                    </div>

                    <DragOverlay>{activeId && isDragMode ? renderOverlayCard() : null}</DragOverlay>
                </div>
            </DndContext>

            {/* Edit row dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>Edit Row</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Row Name" fullWidth
                        value={editingRow.name} onChange={e => setEditingRow({ ...editingRow, name: e.target.value })}
                        sx={{ mb: 2, '& .MuiInputBase-input': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#90caf9' } } }}
                    />
                    <Box sx={{ mb: 1 }}>Row Color:</Box>
                    <Grid container spacing={1}>
                        {TIER_COLORS.map(color => (
                            <Grid item key={color.value}>
                                <Tooltip title={color.name} arrow>
                                    <Box onClick={() => setEditingRow({ ...editingRow, color: color.value })}
                                        sx={{ width: 40, height: 40, backgroundColor: color.value, border: '2px solid', borderColor: editingRow.color === color.value ? '#000' : 'transparent', borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { opacity: 0.8 } }}>
                                        {editingRow.color === color.value && <Check sx={{ color: getContrastColor(color.value) }} />}
                                    </Box>
                                </Tooltip>
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: 'white' }}>Cancel</Button>
                    <Button onClick={handleRowSave} sx={{ color: 'white' }}>Save</Button>
                </DialogActions>
            </Dialog>

            {showAutoSave && (
                <div className="auto-save-indicator">
                    <Check fontSize="small" /> Auto-saved
                </div>
            )}
        </div>
    );
};

export default TierlistCombined;
