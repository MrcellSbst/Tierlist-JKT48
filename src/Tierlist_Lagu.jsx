import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects,
    pointerWithin,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    Button,
    DialogActions,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Grid,
    Box,
    Tooltip,
    Switch,
    FormControlLabel,
    Typography,
    InputAdornment,
    Paper
} from '@mui/material';
import {
    Settings,
    ArrowUpward,
    ArrowDownward,
    Edit,
    Delete,
    Add,
    Refresh,
    Save,
    Check,
    ArrowBack,
    Search
} from '@mui/icons-material';
import domtoimage from 'dom-to-image-more';
import { setlistSongs } from './data/setlistSongs';
import './Tierlist.css';
import './TierlistPage_Lagu.css';
import logo from './assets/icon/TierlistIcon.png';
import {
    TIER_COLORS, getContrastColor, initialRows,
    formatSetlistName, formatVideoName,
    dropAnimation, Droppable, TierRow,
} from './components/TierlistShared';



const DraggableImage = ({ song, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode, setlistImageInfo }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.05)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : 'none'
    };

    return (
        <div
            className={`song-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick && onImageClick(song)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, song)}
        >
            <img
                src={`/asset/Setlist/${setlistImageInfo.filename}.${setlistImageInfo.extension}`}
                alt={song.name}
                className="song-background"
            />
            <div className="song-name">{song.name}</div>
        </div>
    );
};

const SortableImage = ({ image, isDragging, onImageClick, onContextMenu, isSelected, isDragMode, setlistImageInfo }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        id: image.id,
        data: {
            type: 'image',
            image,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: isDragMode ? 'grab' : 'pointer',
    };

    // Only include drag-related props if in drag mode
    const dragProps = isDragMode ? {
        ...attributes,
        ...listeners
    } : {};

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...dragProps}
            onClick={() => !isDragMode && onImageClick && onImageClick(image)}
        >
            <DraggableImage
                song={image}
                isDragging={isDragging}
                onImageClick={isDragMode ? onImageClick : null}
                onContextMenu={onContextMenu}
                isSelected={isSelected}
                isDragMode={isDragMode}
                setlistImageInfo={setlistImageInfo}
            />
        </div>
    );
};






const Tierlist = () => {
    const navigate = useNavigate();
    const tierlistRef = useRef(null);
    const titleInputRef = useRef(null);
    const measureRef = useRef(null);
    const [rows, setRows] = useState(initialRows);
    const [songs, setSongs] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRow, setEditingRow] = useState({ name: '', color: '' });
    const [activeId, setActiveId] = useState(null);
    const [tierlistType, setTierlistType] = useState('member');
    const [isDragMode, setIsDragMode] = useState(true);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tierlistTitle, setTierlistTitle] = useState('');
    const [titlePosition, setTitlePosition] = useState({ left: 0, width: 0 });
    const [inputWidth, setInputWidth] = useState(300); // minimum width
    const [selectedSetlist, setSelectedSetlist] = useState('');
    const [moveCounter, setMoveCounter] = useState(0);
    const [showAutoSave, setShowAutoSave] = useState(false);
    const [availableCount, setAvailableCount] = useState(0);
    const [lastAvailableCount, setLastAvailableCount] = useState(0);
    const [changeCounter, setChangeCounter] = useState(0);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 1,
                delay: 50,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const setlistName = localStorage.getItem('selectedSetlist') || "Aturan Anti Cinta";
        setSelectedSetlist(setlistName);

        const songList = setlistSongs[setlistName].map((songName, index) => ({
            id: `song-${songName}`,
            name: songName,
            containerId: 'image-pool',
            originalIndex: index
        }));

        const draftId = localStorage.getItem('currentDraftId');

        if (draftId) {
            const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
            const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
            const allDrafts = [...manualDrafts, ...autoDrafts];
            const draftToLoad = allDrafts.find(d => d.id.toString() === draftId.toString());

            if (draftToLoad) {
                setRows(draftToLoad.rows || initialRows);
                setTierlistTitle(draftToLoad.title || '');

                const updatedSongs = songList.map(song => {
                    const savedSong = draftToLoad.songs.find(s =>
                        s.id === song.id ||
                        (s.id === `song-${song.name}` || s.id === `song-${song.id}`)
                    );
                    return savedSong ? { ...song, containerId: savedSong.containerId } : song;
                });
                setSongs(updatedSongs);
            } else {
                setSongs(songList);
            }
        } else {
            setSongs(songList);
        }

        localStorage.removeItem('currentDraftId');
    }, []);

    // Track changes in available items count
    useEffect(() => {
        const currentAvailable = songs.filter(song => song.containerId === 'image-pool').length;
        if (currentAvailable !== availableCount) {
            setAvailableCount(currentAvailable);
            setLastAvailableCount(availableCount);
            setChangeCounter(prev => prev + 1);
        }
    }, [songs]);

    // ── Sync row-header widths & keep droppable from shrinking ─────────────────
    useLayoutEffect(() => {
        const container = tierlistRef.current;
        if (!container) return;
        const headers = Array.from(container.querySelectorAll('.row-header'));
        if (headers.length === 0) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const firstLabel = headers[0].querySelector('.row-name-label');
        if (firstLabel) {
            const cs = window.getComputedStyle(firstLabel);
            ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        } else {
            ctx.font = 'bold 1.1rem sans-serif';
        }

        let maxTextPx = 0;
        headers.forEach(h => {
            const label = h.querySelector('.row-name-label');
            const text = (label ? label.textContent : '') || '';
            text.split(/\s+/).forEach(word => {
                if (word) maxTextPx = Math.max(maxTextPx, ctx.measureText(word).width);
            });
        });

        const cs = window.getComputedStyle(headers[0]);
        const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const btn = headers[0].querySelector('button');
        const buttonW = btn ? btn.offsetWidth + 8 : 44;

        const newTotalW = Math.ceil(maxTextPx + padH + buttonW);

        const containerWidth = container.closest('.tier-rows-container')
            ? container.closest('.tier-rows-container').getBoundingClientRect().width
            : (document.querySelector('.tier-rows-container')?.getBoundingClientRect().width || 1200);

        // Measure each row's current droppable width BEFORE we change anything.
        const rowGuarantees = headers.map(h => {
            const row = h.closest('.tier-row');
            const droppable = row?.querySelector('.droppable');
            const currentDrpW = droppable ? droppable.getBoundingClientRect().width : 650;
            const maxAllowed = Math.max(containerWidth - newTotalW, 650);
            return Math.min(Math.max(currentDrpW, 650), maxAllowed);
        });

        headers.forEach((h, i) => {
            h.style.width = `${newTotalW}px`;
            const row = h.closest('.tier-row');
            if (row) row.style.minWidth = `${newTotalW + rowGuarantees[i]}px`;
        });
    }, [rows]);





    const handleDragStart = (event) => {
        if (!isDragMode) return;  // Add this line to prevent drag in click mode
        const { active } = event;
        setActiveId(active.id);
    };

    const handleDragOver = (event) => {
        if (!isDragMode) return;  // Add this line to prevent drag in click mode
        const { active, over } = event;
        if (!over) return;

        const overId = over.id;

        // If we're over a droppable container
        if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            setSongs(prev => {
                const activeImage = prev.find(img => img.id === active.id);
                if (activeImage.containerId === overId) return prev; // No change if same container

                // Remove the dragged image from its current position
                const newImages = prev.filter(img => img.id !== active.id);

                // Find the last index in the target container — O(n)
                let lastContainerImageIndex = -1;
                for (let idx = 0; idx < newImages.length; idx++) {
                    if (newImages[idx].containerId === overId) lastContainerImageIndex = idx;
                }

                const updatedImage = { ...activeImage, containerId: overId };

                if (lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                return newImages;
            });
        }
    };

    const handleDragEnd = (event) => {
        if (!isDragMode) return;
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        const overId = over.id;
        const activeImage = songs.find(img => img.id === active.id);
        const overContainer = overId;

        // Check if moving to a different container
        if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            setSongs(prev => {
                // Remove the dragged image from its current position
                const newImages = prev.filter(img => img.id !== active.id);

                // Find the last index in the target container — O(n)
                let lastContainerImageIndex = -1;
                for (let idx = 0; idx < newImages.length; idx++) {
                    if (newImages[idx].containerId === overContainer) lastContainerImageIndex = idx;
                }

                const updatedImage = { ...activeImage, containerId: overContainer };

                if (lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                return newImages;
            });
        } else {
            // If dropping onto another image, swap positions
            const activeIndex = songs.findIndex(img => img.id === active.id);
            const overIndex = songs.findIndex(img => img.id === over.id);

            if (activeIndex !== -1 && overIndex !== -1) {
                setSongs(prev => {
                    const activeImage = prev[activeIndex];
                    const overImage = prev[overIndex];

                    // Only swap if they're in the same container
                    if (activeImage.containerId === overImage.containerId) {
                        return arrayMove(prev, activeIndex, overIndex);
                    }
                    return prev;
                });
            }
        }

        setActiveId(null);
    };

    const handleRowEdit = (row) => {
        setEditingRow(row);
        setDialogOpen(true);
    };

    const handleRowSave = () => {
        setRows(rows.map(row =>
            row.id === editingRow.id ? { ...row, ...editingRow } : row
        ));
        setDialogOpen(false);
    };

    const handleRowMove = (rowId, direction) => {
        const index = rows.findIndex(row => row.id === rowId);
        if ((direction === 'up' && index === 0) ||
            (direction === 'down' && index === rows.length - 1)) return;

        const newRows = [...rows];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
        setRows(newRows);
    };

    const handleRowClear = (rowId) => {
        setSongs(prevSongs =>
            prevSongs.map(song =>
                song.containerId === rowId
                    ? { ...song, containerId: 'image-pool' }
                    : song
            )
        );
    };

    const handleRowDelete = (rowId) => {
        // Move all images from the row to the image pool
        setSongs(prevImages =>
            prevImages.map(img =>
                img.containerId === rowId
                    ? { ...img, containerId: 'image-pool' }
                    : img
            )
        );
        // Remove the row
        setRows(prev => prev.filter(row => row.id !== rowId));
    };

    const handleAddRow = () => {
        const newRow = {
            id: `row-${rows.length + 1}`,
            name: `New Tier ${rows.length + 1}`,
            color: '#808080'
        };
        setRows(prev => [...prev, newRow]);
    };

    // Compute setlist image info once (was reading localStorage on every DraggableImage render)
    const setlistImageInfo = useMemo(() => {
        const name = selectedSetlist || localStorage.getItem('selectedSetlist') || "Aturan Anti Cinta";
        const specialCases = {
            "BELIEVE": "BELIEVE",
            "Fly! Team T": "Fly!_Team_T",
            "Ingin Bertemu": "Ingin_Bertemu"
        };
        const filename = specialCases[name] ||
            name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
        const extension = name === "Ingin Bertemu" ? 'webp' : 'jpg';
        return { filename, extension };
    }, [selectedSetlist]);

    // Pre-group songs by containerId — rebuilt only when songs state changes
    const songsByContainer = useMemo(() => {
        const map = {};
        for (const s of songs) {
            if (!map[s.containerId]) map[s.containerId] = [];
            map[s.containerId].push(s);
        }
        return map;
    }, [songs]);

    const getImagesForContainer = useCallback((containerId) => {
        const containerSongs = songsByContainer[containerId] || [];

        if (containerId === 'image-pool' && searchTerm) {
            const lower = searchTerm.toLowerCase();
            const filtered = containerSongs.filter(s => s.name.toLowerCase().includes(lower));
            return filtered.sort((a, b) => a.originalIndex - b.originalIndex);
        }

        if (containerId === 'image-pool') {
            return [...containerSongs].sort((a, b) => a.originalIndex - b.originalIndex);
        }

        return containerSongs;
    }, [songsByContainer, searchTerm]);

    const activeImage = activeId ? songs.find(img => img.id === activeId) : null;

    const handleReset = () => {
        // Reset rows to initial state
        setRows([...initialRows]);

        // Reset songs to initial state
        const setlistName = localStorage.getItem('selectedSetlist') || "Aturan Anti Cinta";
        setSelectedSetlist(setlistName);
        const songList = setlistSongs[setlistName];

        if (songList) {
            const songs = songList.map((songName, index) => ({
                id: `song-${songName}`,
                name: songName,
                containerId: 'image-pool',
                originalIndex: index
            }));
            setSongs(songs);
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!tierlistRef.current || isSaving) return;
        setIsSaving(true);

        try {
            const rowsContainer = tierlistRef.current.querySelector('.tier-rows-container');
            if (!rowsContainer) return;

            // Ensure fonts and images are ready
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready.catch(() => { });
            }
            const waitForImages = (root) => Promise.all(
                Array.from(root.querySelectorAll('img')).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );

            await waitForImages(rowsContainer);

            // Create an offscreen clone of only the tier rows for capture
            const cloneRowsContainer = rowsContainer.cloneNode(true);
            cloneRowsContainer.style.backgroundColor = '#1a1a2e';
            cloneRowsContainer.style.width = `${rowsContainer.scrollWidth}px`;
            cloneRowsContainer.style.margin = '0';
            cloneRowsContainer.style.padding = '10px 20px';
            cloneRowsContainer.style.boxSizing = 'border-box';
            cloneRowsContainer.style.position = 'absolute';
            cloneRowsContainer.style.left = '-9999px';
            cloneRowsContainer.style.top = '0';
            cloneRowsContainer.style.transform = 'none';
            cloneRowsContainer.style.opacity = '1';

            // Hide title row if title is empty; otherwise strip borders/outline
            if (!tierlistTitle) {
                const titleBar = cloneRowsContainer.querySelector('.tierlist-title-container');
                if (titleBar) {
                    titleBar.style.display = 'none';
                }
            } else {
                const titleBar = cloneRowsContainer.querySelector('.tierlist-title-container');
                const titleInput = cloneRowsContainer.querySelector('.tierlist-title');
                if (titleBar) {
                    titleBar.style.border = 'none';
                    titleBar.style.boxShadow = 'none';
                    titleBar.style.padding = '0';
                    titleBar.style.marginBottom = '8px';
                    titleBar.style.background = 'transparent';
                }
                if (titleInput) {
                    titleInput.style.width = '100%';
                    titleInput.style.whiteSpace = 'normal';
                    titleInput.style.height = 'auto';
                    titleInput.style.overflow = 'visible';
                    titleInput.style.display = 'block';
                    titleInput.style.border = 'none';
                    titleInput.style.boxShadow = 'none';
                    titleInput.style.background = 'transparent';
                    titleInput.style.outline = 'none';
                    titleInput.style.padding = '4px 0';
                }
            }

            // Disable animations/transitions to avoid partially animated captures
            const stripAnimations = (el) => {
                if (!el || !el.style) return;
                el.style.animation = 'none';
                el.style.transition = 'none';
                if (el.style.opacity) el.style.opacity = '1';
                Array.from(el.children || []).forEach(stripAnimations);
            };
            stripAnimations(cloneRowsContainer);

            document.body.appendChild(cloneRowsContainer);

            const captureWidth = cloneRowsContainer.scrollWidth;
            const captureHeight = cloneRowsContainer.scrollHeight;

            cloneRowsContainer.style.width = `${captureWidth}px`;
            cloneRowsContainer.style.height = `${captureHeight}px`;

            const EXPORT_SCALE = Math.max(2, window.devicePixelRatio || 1);

            const options = {
                quality: 1.0,
                bgcolor: '#1a1a2e',
                width: captureWidth,
                height: captureHeight,
                scale: EXPORT_SCALE,
                style: {
                    'background-color': '#1a1a2e',
                    width: `${captureWidth}px`,
                    height: `${captureHeight}px`,
                    transform: 'none',
                },
                cacheBust: true
            };

            try {
                const dataUrl = await domtoimage.toPng(cloneRowsContainer, options);
                const link = document.createElement('a');
                link.download = 'jkt48-tierlist.png';
                link.href = dataUrl;
                link.click();
            } catch (pngError) {
                console.warn('PNG generation failed, trying blob...', pngError);
                const blob = await domtoimage.toBlob(cloneRowsContainer, options);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'jkt48-tierlist.png';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }

            // Clean up
            document.body.removeChild(cloneRowsContainer);
        } catch (error) {
            console.error('Error saving tierlist:', error);
            alert('Failed to save image. Please try again or use a screenshot instead.');
        } finally {
            setIsSaving(false);
        }
    };

    // Update input width based on content
    useEffect(() => {
        const updateWidth = () => {
            if (titleInputRef.current && tierlistRef.current) {
                const firstRow = tierlistRef.current.querySelector('.tier-row');
                if (!firstRow) return;

                const rowWidth = firstRow.offsetWidth;

                // Use canvas for text measurement — no DOM insertion/removal
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.font = window.getComputedStyle(titleInputRef.current).font;
                const text = tierlistTitle || titleInputRef.current.placeholder || '';
                const textWidth = Math.ceil(ctx.measureText(text).width);
                const padding = 24;
                const newWidth = Math.min(Math.max(300, textWidth + padding), rowWidth);

                setInputWidth(newWidth);

                const rowRect = firstRow.getBoundingClientRect();
                const viewportWidth = document.documentElement.clientWidth;
                const rowCenterX = rowRect.left + (rowRect.width / 2);
                const leftPosition = (rowCenterX / viewportWidth) * 100;

                setTitlePosition({
                    left: `${leftPosition}%`,
                    transform: 'translateX(-50%)',
                    width: newWidth
                });
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [tierlistTitle]);

    // Add useEffect for mobile zoom
    useEffect(() => {
        const updateWidth = () => {
            const isMobile = window.innerWidth < 1024;
            if (isMobile) {
                const scale = window.innerWidth / 1024;
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.content = `width=1024, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no`;
                } else {
                    const meta = document.createElement('meta');
                    meta.name = 'viewport';
                    meta.content = `width=1024, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no`;
                    document.head.appendChild(meta);
                }
            } else {
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
                }
            }
        };

        // Initial update
        updateWidth();

        // Update on resize
        window.addEventListener('resize', updateWidth);
        window.addEventListener('orientationchange', updateWidth);

        // Cleanup
        return () => {
            window.removeEventListener('resize', updateWidth);
            window.removeEventListener('orientationchange', updateWidth);
            // Reset viewport on unmount
            const viewport = document.querySelector('meta[name=viewport]');
            if (viewport) {
                viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
            }
        };
    }, []);

    const handleImageClick = (image) => {
        if (!isDragMode) {
            setSelectedImages(prev => {
                const next = new Set(prev);
                if (next.has(image.id)) {
                    next.delete(image.id);
                } else {
                    next.add(image.id);
                }
                return next;
            });
        }
    };

    const handleImageRightClick = (e, image) => {
        e.preventDefault(); // Prevent the default context menu
        if (!isDragMode) {
            if (image.containerId !== 'image-pool') {
                setSongs(prev => prev.map(img =>
                    img.id === image.id
                        ? { ...img, containerId: 'image-pool' }
                        : img
                ));
            }
            // Deselect the right-clicked image
            setSelectedImages(prev => {
                const next = new Set(prev);
                next.delete(image.id);
                return next;
            });
        }
    };

    const handleTierClick = (tierId) => {
        if (!isDragMode && selectedImages.size > 0) {
            setSongs(prev => {
                let newImages = [...prev];

                for (const selId of selectedImages) {
                    const activeImage = newImages.find(img => img.id === selId);
                    if (!activeImage || activeImage.containerId === tierId) continue;

                    newImages = newImages.filter(img => img.id !== selId);

                    // Find the last index in the target container — O(n)
                    let lastContainerImageIndex = -1;
                    for (let idx = 0; idx < newImages.length; idx++) {
                        if (newImages[idx].containerId === tierId) lastContainerImageIndex = idx;
                    }

                    const updatedImage = { ...activeImage, containerId: tierId };

                    if (lastContainerImageIndex === -1) {
                        newImages = [...newImages, updatedImage];
                    } else {
                        newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                    }
                }

                return newImages;
            });
            // Clear selection after placing
            setTimeout(() => setSelectedImages(new Set()), 50);
        }
    };

    const getTierlistTypeDisplay = () => {
        switch (tierlistType) {
            case 'setlist':
                return 'Setlist';
            case 'ramadan':
                return 'Special Show Ramadan';
            case 'video':
                const videoType = localStorage.getItem('videoType') || 'all';
                if (videoType === 'mv') return 'Music Video';
                if (videoType === 'spv') return 'Special Video';
                return 'SPV and MV';
            default:
                return 'Member';
        }
    };

    // Calculate completion percentage for drafts
    const calculateCompletion = (draftSongs) => {
        if (!draftSongs || draftSongs.length === 0) return 0;
        const placedSongs = draftSongs.filter(song => song.containerId !== 'image-pool').length;
        return Math.round((placedSongs / draftSongs.length) * 100);
    };

    // Auto-save effect
    useEffect(() => {
        if (changeCounter >= 2) {
            const draft = {
                type: 'song',
                setlist: selectedSetlist,
                rows: rows,
                songs: songs.map(song => ({
                    id: song.id,
                    containerId: song.containerId
                })),
                title: tierlistTitle,
                savedAt: new Date().toISOString(),
                isAutoSave: true
            };
            manageDrafts(draft, true);
            setChangeCounter(0);

            setShowAutoSave(true);
            setTimeout(() => setShowAutoSave(false), 2000);
        }
    }, [changeCounter, rows, songs, tierlistTitle, selectedSetlist]);

    // Function to manage drafts in localStorage
    const manageDrafts = (newDraft, isAutoSave = false) => {
        const storageKey = isAutoSave ? 'tierlistAutoSaveDrafts' : 'tierlistManualDrafts';
        const maxDrafts = isAutoSave ? 3 : 5;

        let drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
        drafts = drafts.filter(d => d.type === 'song' && d.setlist === selectedSetlist);
        drafts.unshift({
            ...newDraft,
            type: 'song',
            setlist: selectedSetlist,
            completion: calculateCompletion(newDraft.songs),
            isAutoSave,
            id: Date.now()
        });
        drafts = drafts.slice(0, maxDrafts);
        localStorage.setItem(storageKey, JSON.stringify(drafts));
    };

    return (
        <div className="tierlist-page">
            <header className="header">
                <IconButton
                    onClick={() => navigate(-1)}
                    sx={{ color: 'white', marginRight: 1 }}
                >
                    <ArrowBack />
                </IconButton>
                <div className="header-title-container">
                    <div className="header-main" onClick={() => navigate('/')}>
                        <img src={logo} alt="JKT48 Tierlist Logo" className="header-logo" />
                        <div className="header-titles">
                            <h1 className="header-title">JKT48 Tierlist</h1>
                        </div>
                    </div>
                    {tierlistTitle && (
                        <div
                            className="header-subtitle-container"
                            style={{
                                left: titlePosition.left,
                                width: titlePosition.width,
                                transform: titlePosition.transform
                            }}
                        >
                            <h2 className="header-subtitle">{tierlistTitle}</h2>
                        </div>
                    )}
                </div>
            </header>

            {/* Welcome Dialog */}
            <Dialog
                open={showWelcomeDialog}
                onClose={() => setShowWelcomeDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Selamat Datang di JKT48 Tierlist! 👋</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                            Panduan Penggunaan Tierlist:
                        </Typography>
                        <Typography variant="body1" paragraph>
                            1. Kamu bisa menggunakan dua mode interaksi:
                        </Typography>
                        <Box sx={{ pl: 3, mb: 2 }}>
                            <Typography variant="body1" gutterBottom>
                                • <strong>Mode Drag and Drop:</strong> Seret foto member ke tier yang diinginkan
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                                • <strong>Mode Select to Place:</strong> Klik foto member terlebih dahulu, lalu klik tier tujuan. Klik kanan (untuk Mobile User, Ketika tidak sedang memilih foto member, klik tahan sebentar) untuk mengembalikan Foto member ke pool
                            </Typography>
                        </Box>
                        <Typography variant="body1" paragraph>
                            2. <strong>Mobile User:</strong> Aplikasi ini dioptimalkan untuk tampilan desktop. Silakan zoom out untuk melihat keseluruhan tampilan.
                        </Typography>
                        <Typography variant="body1">
                            3. Gunakan tombol-tombol di bawah untuk menambah tier, mengulang dari awal, atau menyimpan tierlist sebagai gambar.
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 2, color: 'warning.main' }}>
                            <strong>Disclaimer:</strong> Pembuat Website ini tidak bertanggung jawab atas segala akibat dari hasil tierlist. Berani membagikan tierlist ini berarti pengguna berani menanggung segala resiko yang muncul (termasuk dongfol).
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setShowWelcomeDialog(false)}
                        variant="contained"
                        color="primary"
                    >
                        Mengerti!
                    </Button>
                </DialogActions>
            </Dialog>

            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
                <div className="tierlist-container" ref={tierlistRef}>
                    <div className="tier-rows-container" ref={measureRef}>
                        <div className="tierlist-title-container" style={{
                            marginTop: '0',
                            marginBottom: '5px',
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%'
                        }}>
                            <input
                                ref={titleInputRef}
                                type="text"
                                className="tierlist-title"
                                value={tierlistTitle}
                                onChange={(e) => setTierlistTitle(e.target.value)}
                                placeholder={`My ${selectedSetlist} Tierlist`}
                                spellCheck="false"
                                style={{
                                    width: `${inputWidth}px`,
                                    fontSize: '32px',
                                    padding: '8px 12px'
                                }}
                                maxLength={90}
                            />
                        </div>
                        {rows.map((row, index) => (
                            <div
                                key={row.id}
                                className={`tier-row ${index === 0 ? 'first-tier-row' : ''}`}
                                onClick={() => handleTierClick(row.id)}
                                style={{
                                    cursor: (!isDragMode && selectedImages.size > 0) ? 'pointer' : 'default',
                                    opacity: (!isDragMode && selectedImages.size > 0) ? 0.8 : 1
                                }}
                            >
                                <TierRow
                                    row={row}
                                    onMove={handleRowMove}
                                    onEdit={handleRowEdit}
                                    onClear={handleRowClear}
                                    onDelete={handleRowDelete}
                                    isFirstRow={index === 0}
                                />
                                <Droppable id={row.id}>
                                    <div className="tier-content">
                                        <SortableContext
                                            items={getImagesForContainer(row.id).map(img => img.id)}
                                            strategy={rectSortingStrategy}
                                        >
                                            {getImagesForContainer(row.id).length === 0 && (
                                                <div className="tier-empty-placeholder">
                                                    <span>Drop here</span>
                                                </div>
                                            )}
                                            {getImagesForContainer(row.id).map((image) => (
                                                <SortableImage
                                                    key={image.id}
                                                    image={image}
                                                    isDragging={image.id === activeId}
                                                    onImageClick={handleImageClick}
                                                    onContextMenu={handleImageRightClick}
                                                    isSelected={selectedImages.has(image.id)}
                                                    isDragMode={isDragMode}
                                                    setlistImageInfo={setlistImageInfo}
                                                />
                                            ))}
                                        </SortableContext>
                                    </div>
                                </Droppable>
                            </div>
                        ))}
                    </div>

                    <div className="tierlist-button-container">
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isDragMode}
                                    onChange={(e) => {
                                        setIsDragMode(e.target.checked);
                                        setSelectedImages(new Set());
                                    }}
                                    color="primary"
                                />
                            }
                            label={
                                <div style={{ color: 'white' }}>
                                    {isDragMode ? "Drag & Drop Mode" : "Click to Place Mode"}
                                    {!isDragMode && (
                                        <span style={{ fontSize: '0.8em', display: 'block', color: '#aaa' }}>
                                            Right-click to return to pool
                                        </span>
                                    )}
                                </div>
                            }
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Add />}
                            onClick={handleAddRow}
                            className="action-button"
                        >
                            Add New Tier
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<Refresh />}
                            onClick={handleReset}
                            className="action-button"
                        >
                            Reset
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={isSaving ? (
                                <span className="save-spinner" />
                            ) : (
                                <Save />
                            )}
                            onClick={handleSave}
                            disabled={isSaving}
                            className="action-button"
                        >
                            {isSaving ? 'Saving…' : 'Save as Image'}
                        </Button>
                    </div>

                    <div className="image-pool-container">
                        <div className="image-pool-header">
                            <h2>
                                {selectedSetlist} Songs ({getImagesForContainer('image-pool').length})
                                {!isDragMode && selectedImages.size > 0 && (
                                    <span style={{ fontSize: '0.8em', marginLeft: '10px', color: '#4CAF50' }}>
                                        {selectedImages.size} selected
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedImages(new Set()); }}
                                            style={{ marginLeft: '8px', fontSize: '0.85em', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', color: '#fff', padding: '1px 7px' }}
                                        >✕ Clear</button>
                                    </span>
                                )}
                            </h2>
                            <Paper
                                component="form"
                                sx={{
                                    p: '2px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: { xs: '100%', sm: '300px' },
                                    backgroundColor: '#2a2a3a',
                                    marginLeft: { xs: 0, sm: 2 }
                                }}
                            >
                                <InputAdornment position="start" sx={{ pl: 1 }}>
                                    <Search sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                                </InputAdornment>
                                <TextField
                                    sx={{
                                        flex: 1,
                                        '& .MuiInputBase-input': {
                                            color: 'white',
                                            pl: 1,
                                            '&::placeholder': {
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                opacity: 1
                                            }
                                        },
                                        '& .MuiInputBase-root': {
                                            '&:before, &:after': {
                                                display: 'none',
                                            },
                                            padding: '4px 8px'
                                        },
                                        '& .MuiInput-underline:before': {
                                            display: 'none',
                                        }
                                    }}
                                    placeholder="Search songs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    variant="standard"
                                    fullWidth
                                    inputProps={{
                                        style: { paddingLeft: '8px' }
                                    }}
                                />
                            </Paper>
                        </div>
                        <Droppable id="image-pool">
                            <div className="image-pool">
                                <SortableContext
                                    items={getImagesForContainer('image-pool').map(img => img.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    {getImagesForContainer('image-pool').map((image) => (
                                        <SortableImage
                                            key={image.id}
                                            image={image}
                                            isDragging={image.id === activeId}
                                            onImageClick={handleImageClick}
                                            onContextMenu={handleImageRightClick}
                                            isSelected={selectedImages.has(image.id)}
                                            isDragMode={isDragMode}
                                            setlistImageInfo={setlistImageInfo}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </Droppable>
                    </div>

                    <DragOverlay>
                        {activeId && isDragMode ? (
                            <DraggableImage
                                song={songs.find(img => img.id === activeId)}
                                dragOverlay
                                isDragMode={isDragMode}
                                setlistImageInfo={setlistImageInfo}
                            />
                        ) : null}
                    </DragOverlay>
                </div>
            </DndContext>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>Edit Row</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Row Name"
                        fullWidth
                        value={editingRow.name}
                        onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                        sx={{ mb: 2 }}
                    />
                    <Box sx={{ mb: 1 }}>Row Color:</Box>
                    <Grid container spacing={1}>
                        {TIER_COLORS.map((color) => (
                            <Grid item key={color.value}>
                                <Tooltip title={color.name} arrow>
                                    <Box
                                        onClick={() => setEditingRow({ ...editingRow, color: color.value })}
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            backgroundColor: color.value,
                                            border: '2px solid',
                                            borderColor: editingRow.color === color.value ? '#000' : 'transparent',
                                            borderRadius: 1,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            '&:hover': {
                                                opacity: 0.8
                                            }
                                        }}
                                    >
                                        {editingRow.color === color.value && (
                                            <Check sx={{
                                                color: getContrastColor(color.value)
                                            }} />
                                        )}
                                    </Box>
                                </Tooltip>
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleRowSave}>Save</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Tierlist;
