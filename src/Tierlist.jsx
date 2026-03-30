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
import './Tierlist.css';
import './TierlistPage_Lagu.css';
import logo from './assets/icon/TierlistIcon.png';
import * as memberData from './data/memberData';
import {
    mvFiles,
    spvFiles
} from './data/spv_mv';
import { setlistFiles } from './data/SetlistData';
import { ssRamadanFiles } from './data/specialshowData';
import {
    TIER_COLORS, getContrastColor, initialRows,
    formatSetlistName, formatVideoName,
    dropAnimation, Droppable, TierRow,
} from './components/TierlistShared';



// Format member names from filenames (handles JKT48V prefixes)
const formatMemberName = (filename) => {
    if (!filename || typeof filename !== 'string') return '';

    const baseName = filename.split('/').pop().split('.')[0]; // ambil bagian terakhir dari path & tanpa extension
    const parts = baseName.split('_').filter(Boolean);
    const firstPart = parts[0] || '';

    // New naming: JKT48VGen1_Name...
    if (/^jkt48vgen\d+$/i.test(firstPart)) {
        return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // Kalau prefix JKT48V
    if (firstPart && firstPart.toUpperCase() === 'JKT48V') {
        // Hilangkan prefix JKT48V dan gen token jika ada (Gen1, Gen2, ...)
        const rest = parts.slice(1);
        const afterGen = rest[0]?.toLowerCase().startsWith('gen') ? rest.slice(1) : rest;
        return afterGen.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // Untuk GenX members (seperti Gen3_shania_gracia)
    if (parts[0] && parts[0].toLowerCase().startsWith('gen')) {
        return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // fallback umum, jika tidak match pola di atas
    return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};


const parseNameForSearch = (filename) => {
    if (!filename || typeof filename !== 'string') return '';

    // Strip common ID prefixes (member-, setlist-, ramadan-, video-) before parsing
    const rawBase = filename.split('/').pop().split('.')[0];
    const baseName = rawBase.replace(/^(member|setlist|ramadan|video)-/i, '');
    const parts = baseName.split('_').filter(Boolean);
    const firstPart = parts[0] || '';
    const brandTokens = [];

    let genPart = '';
    let nameParts = [];

    if (/^jkt48vgen\d+$/i.test(firstPart)) {
        const numMatch = firstPart.match(/\d+/);
        const genNum = numMatch ? numMatch[0] : '';
        genPart = genNum ? `genv${genNum}` : '';
        nameParts = parts.slice(1);
        brandTokens.push('jkt48v');
    } else if (firstPart.toUpperCase() === 'JKT48V') {
        // Drop the JKT48V prefix
        const rest = parts.slice(1);
        const genToken = rest[0]?.toLowerCase().startsWith('gen') ? rest[0] : '';
        const numMatch = genToken.match(/\d+/);
        const genNum = numMatch ? numMatch[0] : '';
        genPart = genNum ? `genv${genNum}` : '';
        nameParts = genToken ? rest.slice(1) : rest;
        brandTokens.push('jkt48v');
    } else if (parts[0].toLowerCase().startsWith('gen')) {
        genPart = parts[0];
        nameParts = parts.slice(1);
    } else {
        nameParts = parts;
    }

    const searchableParts = [...brandTokens, genPart, ...nameParts].filter(Boolean);
    const searchable = searchableParts.join(' ').toLowerCase();



    return searchable;
};

// Data helpers
const activeMemberFiles = memberData.activeMemberFiles || [];
const exMemberFiles = memberData.exMemberFiles || [];
const timLoveList = memberData.tim_love || [];
const timLoveSet = new Set(timLoveList.map(f => f.toLowerCase()));

// Shared image-list builder — used by both initial load and handleReset
const buildImageList = (tierlistTypeParam, memberType, generation, videoType) => {
    let imageList = [];

    if (tierlistTypeParam === 'setlist') {
        imageList = setlistFiles.map((filename, index) => ({
            id: `setlist-${filename}`,
            src: `/asset/Setlist/${filename}`,
            name: formatSetlistName(filename),
            containerId: 'image-pool',
            originalIndex: index
        }));
    } else if (tierlistTypeParam === 'ramadan') {
        imageList = ssRamadanFiles.map((filename, index) => ({
            id: `ramadan-${filename}`,
            src: `/asset/SSRamadan/${filename}`,
            name: formatSetlistName(filename),
            containerId: 'image-pool',
            originalIndex: index
        }));
    } else if (tierlistTypeParam === 'video') {
        let videoFiles = [];
        if (videoType === 'all') videoFiles = [...spvFiles, ...mvFiles];
        else if (videoType === 'mv') videoFiles = mvFiles;
        else if (videoType === 'spv') videoFiles = spvFiles;

        imageList = videoFiles.map((filename, index) => ({
            id: `video-${filename}`,
            src: `/asset/SPV_MV/${filename}`,
            name: formatVideoName(filename),
            containerId: 'image-pool',
            originalIndex: index
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
            if (generation.toLowerCase().startsWith('gen')) {
                return base.startsWith(`Gen${generation.slice(3)}_`);
            }
            return true;
        };

        let currentIndex = 0;
        if (memberType === 'active' || memberType === 'all') {
            const active = activeMemberFiles
                .filter(matchesGeneration)
                .map((filename) => ({
                    id: `member-${filename}`,
                    src: `/asset/member_active/${filename}`,
                    name: formatMemberName(filename),
                    isTimLove: timLoveSet.has(filename.toLowerCase()),
                    containerId: 'image-pool',
                    originalIndex: currentIndex++
                }));
            imageList = [...imageList, ...active];
        }
        if (memberType === 'ex' || memberType === 'all') {
            const ex = exMemberFiles
                .filter(matchesGeneration)
                .map((filename) => ({
                    id: `member-${filename}`,
                    src: `/asset/exmember/${filename.replace(/\\/g, '/')}`,
                    name: formatMemberName(filename),
                    isTimLove: timLoveSet.has(filename.toLowerCase()),
                    containerId: 'image-pool',
                    originalIndex: currentIndex++
                }));
            imageList = [...imageList, ...ex];
        }
    }

    return imageList;
};



const DraggableImage = ({ image, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.05)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : 'none'
    };

    const handleContextMenu = (e) => {
        e.preventDefault(); // Prevent default context menu
        // Allow right-click return in both modes when not in image pool
        if (image.containerId !== 'image-pool') {
            onContextMenu && onContextMenu(e, image);
        }
    };

    return (
        <div
            className={`member-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''} ${image.isTimLove ? 'love' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick && onImageClick(image)}
            onContextMenu={handleContextMenu}
        >
            <img src={image.src} alt={image.name} />
            <div className="member-name">{image.name}</div>
            {image.isTimLove && (
                <div className="love-hearts" aria-hidden="true">
                    <span className="heart heart-1">💖</span>
                    <span className="heart heart-2">💕</span>
                    <span className="heart heart-3">💗</span>
                </div>
            )}
        </div>
    );
};

const SortableImage = ({ image, isDragging, onImageClick, onContextMenu, isSelected, isDragMode }) => {
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
                image={image}
                isDragging={isDragging}
                onImageClick={isDragMode ? onImageClick : null}
                onContextMenu={onContextMenu}
                isSelected={isSelected}
                isDragMode={isDragMode}
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
    const [images, setImages] = useState([]);
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
    const [moveCounter, setMoveCounter] = useState(0);
    const [showAutoSave, setShowAutoSave] = useState(false);
    const [availableCount, setAvailableCount] = useState(0);
    const [lastAvailableCount, setLastAvailableCount] = useState(0);
    const [changeCounter, setChangeCounter] = useState(0);

    // Track changes in available items count
    useEffect(() => {
        const currentAvailable = images.filter(img => img.containerId === 'image-pool').length;
        if (currentAvailable !== availableCount) {
            setAvailableCount(currentAvailable);
            setLastAvailableCount(availableCount);
            setChangeCounter(prev => prev + 1);
        }
    }, [images]);

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

        // Measure current droppable widths BEFORE changing header widths.
        // Cap each guarantee to (containerWidth - headerWidth) so a tier-row that
        // is already inflated (e.g. many members) can't feed that inflation back
        // into the minWidth and make the row even wider.
        const containerWidth = container.closest('.tier-rows-container')
            ? container.closest('.tier-rows-container').getBoundingClientRect().width
            : (document.querySelector('.tier-rows-container')?.getBoundingClientRect().width || 1200);

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



    // Auto-save effect
    useEffect(() => {
        if (changeCounter >= 5) {
            const draft = {
                type: tierlistType,
                rows: rows,
                images: images.map(img => ({
                    id: img.id,
                    containerId: img.containerId
                })),
                title: tierlistTitle,
                savedAt: new Date().toISOString(),
                isAutoSave: true
            };
            manageDrafts(draft, true);
            setChangeCounter(0);
        }
    }, [changeCounter, rows, images, tierlistTitle, tierlistType]);

    // Function to calculate completion percentage
    const calculateCompletion = (draftImages) => {
        const totalImages = draftImages.length;
        const placedImages = draftImages.filter(img => img.containerId !== 'image-pool').length;
        return Math.round((placedImages / totalImages) * 100);
    };

    // Function to manage drafts in localStorage
    const manageDrafts = (newDraft, isAutoSave = false) => {
        const storageKey = isAutoSave ? 'tierlistAutoSaveDrafts' : 'tierlistManualDrafts';
        const maxDrafts = isAutoSave ? 3 : 5;

        let drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
        drafts = drafts.filter(d => d.type === tierlistType);
        drafts.unshift({
            ...newDraft,
            type: tierlistType,
            completion: calculateCompletion(newDraft.images),
            isAutoSave,
            id: Date.now()
        });
        drafts = drafts.slice(0, maxDrafts);
        localStorage.setItem(storageKey, JSON.stringify(drafts));
    };

    useEffect(() => {
        const tierlistType = localStorage.getItem('tierlistType') || 'member';
        const memberType = localStorage.getItem('memberType') || 'active';
        const generation = localStorage.getItem('generation') || 'all';
        const videoType = localStorage.getItem('videoType') || 'all';
        const draftId = localStorage.getItem('currentDraftId');

        setTierlistType(tierlistType);

        let imageList = buildImageList(tierlistType, memberType, generation, videoType);

        if (draftId) {
            const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
            const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
            const allDrafts = [...manualDrafts, ...autoDrafts];
            const draftToLoad = allDrafts.find(d => d.id.toString() === draftId.toString());

            if (draftToLoad) {
                setRows(draftToLoad.rows || initialRows);
                setTierlistTitle(draftToLoad.title || '');
                imageList = imageList.map(img => {
                    const savedImage = draftToLoad.images.find(i => i.id === img.id);
                    return savedImage ? { ...img, containerId: savedImage.containerId } : img;
                });
            }
        } else {
            setRows(initialRows);
            setTierlistTitle('');
        }

        setImages(imageList);
    }, []);

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

    const handleDragStart = (event) => {
        if (!isDragMode) return;  // Add this line to prevent drag in click mode
        const { active } = event;
        setActiveId(active.id);
    };

    const handleDragOver = (event) => {
        if (!isDragMode) return;
        const { active, over } = event;
        if (!over) return;

        const overId = over.id;

        // If we're over another image
        if (images.find(img => img.id === overId)) {
            const activeImage = images.find(img => img.id === active.id);
            const overImage = images.find(img => img.id === overId);

            // If they're in the same container
            if (activeImage.containerId === overImage.containerId) {
                setImages(prev => {
                    const activeIndex = prev.findIndex(img => img.id === active.id);
                    const overIndex = prev.findIndex(img => img.id === overId);
                    return arrayMove(prev, activeIndex, overIndex);
                });
            }
        }
        // If we're over a droppable container
        else if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            setImages(prev => {
                const activeImage = prev.find(img => img.id === active.id);
                if (activeImage.containerId === overId) return prev; // No change if same container

                // Remove the dragged image from its current position
                const newImages = prev.filter(img => img.id !== active.id);

                // Find the last index in the array belonging to the target container — O(n)
                let lastContainerImageIndex = -1;
                for (let idx = 0; idx < newImages.length; idx++) {
                    if (newImages[idx].containerId === overId) lastContainerImageIndex = idx;
                }

                // Create the updated image with new container
                const updatedImage = { ...activeImage, containerId: overId };

                if (lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                // Insert after the last image in the container
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

        // If we're over another image
        if (images.find(img => img.id === overId)) {
            const activeImage = images.find(img => img.id === active.id);
            const overImage = images.find(img => img.id === overId);

            // If they're in the same container
            if (activeImage.containerId === overImage.containerId) {
                setImages(prev => {
                    const activeIndex = prev.findIndex(img => img.id === active.id);
                    const overIndex = prev.findIndex(img => img.id === overId);
                    return arrayMove(prev, activeIndex, overIndex);
                });
            }
        }
        // If we're over a droppable container
        else if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            const activeImage = images.find(img => img.id === active.id);
            const overContainer = overId;

            setImages(prev => {
                // Remove the dragged image from its current position
                const newImages = prev.filter(img => img.id !== active.id);

                // Find the last index in the array belonging to the target container — O(n)
                let lastContainerImageIndex = -1;
                for (let idx = 0; idx < newImages.length; idx++) {
                    if (newImages[idx].containerId === overContainer) lastContainerImageIndex = idx;
                }

                // Create the updated image with new container
                const updatedImage = { ...activeImage, containerId: overContainer };

                if (lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                // Insert after the last image in the container
                newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                return newImages;
            });
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
        setImages(prevImages =>
            prevImages.map(img =>
                img.containerId === rowId
                    ? { ...img, containerId: 'image-pool' }
                    : img
            )
        );
    };

    const handleRowDelete = (rowId) => {
        // Move all images from the row to the image pool
        setImages(prevImages =>
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

    // Pre-group images by containerId — rebuilt only when `images` state changes,
    // not on every render. O(1) lookup inside getImagesForContainer during drag.
    const imagesByContainer = useMemo(() => {
        const map = {};
        for (const img of images) {
            if (!map[img.containerId]) map[img.containerId] = [];
            map[img.containerId].push(img);
        }
        return map;
    }, [images]);

    const getImagesForContainer = useCallback((containerId) => {
        const containerImages = imagesByContainer[containerId] || [];

        if (containerId === 'image-pool' && searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const rawWords = searchLower.split(/\s+/).filter(Boolean);
            const mergedWords = [];
            for (let i = 0; i < rawWords.length; i++) {
                const word = rawWords[i];
                const next = rawWords[i + 1];
                if ((word === 'gen' || word === 'genv') && next && /^\d+$/.test(next)) {
                    mergedWords.push(`${word}${next}`);
                    i++;
                    continue;
                }
                mergedWords.push(word);
            }

            const filtered = containerImages.filter(img => {
                if (!img.id || typeof img.id !== 'string') return false;
                const searchableName = parseNameForSearch(img.id);
                const searchableDisplay = `${searchableName} ${(img.name || '').toLowerCase()}`;
                return mergedWords.every(word => {
                    if (/^genv?\d+$/i.test(word)) {
                        const re = new RegExp(`\\b${word}\\b`, 'i');
                        return re.test(searchableName);
                    }
                    return searchableDisplay.includes(word);
                });
            });

            return filtered.sort((a, b) => a.originalIndex - b.originalIndex);
        }

        if (containerId === 'image-pool') {
            return [...containerImages].sort((a, b) => a.originalIndex - b.originalIndex);
        }

        return containerImages;
    }, [imagesByContainer, searchTerm]);




    const activeImage = activeId ? images.find(img => img.id === activeId) : null;

    const handleReset = () => {
        setRows([...initialRows]);
        const tierlistTypeVal = localStorage.getItem('tierlistType') || 'member';
        const memberType = localStorage.getItem('memberType') || 'active';
        const generation = localStorage.getItem('generation') || 'all';
        const videoType = localStorage.getItem('videoType') || 'all';
        setImages(buildImageList(tierlistTypeVal, memberType, generation, videoType));
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
            // Use scrollWidth to capture full row width (not just the visible viewport)
            cloneRowsContainer.style.width = `${rowsContainer.scrollWidth}px`;
            cloneRowsContainer.style.margin = '0';
            cloneRowsContainer.style.padding = '10px 20px';
            cloneRowsContainer.style.boxSizing = 'border-box';
            cloneRowsContainer.style.position = 'absolute';
            cloneRowsContainer.style.left = '-9999px';
            cloneRowsContainer.style.top = '0';
            // ← Reset the centering transform — it's inherited from the CSS class
            // and would shift the content sideways during dom-to-image capture
            cloneRowsContainer.style.transform = 'none';
            cloneRowsContainer.style.opacity = '1';

            // Hide title row if title is empty
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

            // Export at 2× (or the device's own DPR, whichever is higher) for
            // sharp results on Retina displays and when the image is zoomed in.
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

                // Use canvas for text measurement — no DOM insertion/removal needed
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.font = window.getComputedStyle(titleInputRef.current).font;
                const text = tierlistTitle || titleInputRef.current.placeholder || '';
                const textWidth = Math.ceil(ctx.measureText(text).width);
                const padding = 24;
                const newWidth = Math.min(Math.max(300, textWidth + padding), rowWidth);

                setInputWidth(newWidth);

                // Update position for header title
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
        if (isDragMode) {
            if (image.containerId !== 'image-pool') {
                setImages(prev => prev.map(img =>
                    img.id === image.id
                        ? { ...img, containerId: 'image-pool' }
                        : img
                ));
            }
        } else {
            if (image.containerId !== 'image-pool') {
                setImages(prev => prev.map(img =>
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
            setImages(prev => {
                let newImages = [...prev];

                for (const selId of selectedImages) {
                    const activeImage = newImages.find(img => img.id === selId);
                    if (!activeImage || activeImage.containerId === tierId) continue;

                    // Remove the image from its current position
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

    const handleSaveDraft = () => {
        const draft = {
            type: tierlistType,
            rows: rows,
            images: images.map(img => ({
                id: img.id,
                containerId: img.containerId
            })),
            title: tierlistTitle,
            savedAt: new Date().toISOString()
        };
        manageDrafts(draft, false);
        alert('Tierlist saved as draft!');
    };

    const handleClearDraft = () => {
        if (window.confirm('Are you sure you want to clear all saved drafts?')) {
            localStorage.removeItem('tierlistManualDrafts');
            localStorage.removeItem('tierlistAutoSaveDrafts');
            localStorage.removeItem('currentDraftId');
            alert('All drafts cleared!');
        }
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
                        <Typography variant="body1" sx={{ mt: 2, color: '#ff69b4' }}>
                            <strong>Disclaimer:</strong> Pembuat Website ini tidak bertanggung jawab atas segala akibat dari membagikan hasil tierlist ini. Berani membagikan tierlist ini berarti pengguna berani menanggung segala resiko yang muncul (termasuk donfol).
                        </Typography>
                        <Typography sx={{ mt: 2, color: '#ff69b4', textAlign: 'center' }}>
                            <h2>꧁⎝ 𓆩༺✧༻𓆪 ⎠꧂</h2>
                        </Typography>
                        <Typography sx={{ mt: 2, color: '#ff69b4', textAlign: 'center' }}>
                            <h2>˚˖𓍢ִ໋🌷͙֒✧˚.🎀༘⋆HIDUP TIM LOVE ˚˖𓍢ִ໋🌷͙֒✧˚.🎀༘⋆</h2>
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
                                placeholder={"Click Here to Add Title"}
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
                        <Button
                            variant="contained"
                            color="info"
                            startIcon={<Save />}
                            onClick={handleSaveDraft}
                            className="action-button"
                        >
                            Save Draft
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<Delete />}
                            onClick={handleClearDraft}
                            className="action-button"
                        >
                            Clear Draft
                        </Button>
                    </div>

                    <div className="image-pool-container">
                        <div className="image-pool-header">
                            <h2>
                                Available {getTierlistTypeDisplay()}s ({getImagesForContainer('image-pool').length})
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
                                    placeholder={`Search ${tierlistType === 'setlist' ? 'setlists' : 'members'}...`}
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
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </Droppable>
                    </div>

                    <DragOverlay>
                        {activeId && isDragMode ? (
                            <DraggableImage
                                image={images.find(img => img.id === activeId)}
                                dragOverlay
                                isDragMode={isDragMode}
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
                        sx={{
                            mb: 2,
                            '& .MuiInputBase-input': {
                                color: 'white',
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255, 255, 255, 0.7)',
                            },
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#90caf9',
                                },
                            },
                        }}
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
                    <Button
                        onClick={() => setDialogOpen(false)}
                        sx={{ color: 'white' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRowSave}
                        sx={{ color: 'white' }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Tierlist;
