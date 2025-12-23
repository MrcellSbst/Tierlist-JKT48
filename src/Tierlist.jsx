import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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

const TIER_COLORS = [
    { name: 'Red', value: '#FF7F7F' },
    { name: 'Orange', value: '#FFBF7F' },
    { name: 'Yellow', value: '#FFFF7F' },
    { name: 'Light Green', value: '#BFFF7F' },
    { name: 'Green', value: '#7FFF7F' },
    { name: 'Aqua', value: '#7FFFFF' },
    { name: 'Light Blue', value: '#7FBFFF' },
    { name: 'Blue', value: '#7F7FFF' },
    { name: 'Purple', value: '#BF7FFF' },
    { name: 'Pink', value: '#FF7FFF' },
    { name: 'Brown', value: '#BF7F3F' },
    { name: 'Gray', value: '#BFBFBF' },
    { name: 'Dark Gray', value: '#7F7F7F' },
    { name: 'White', value: '#FFFFFF' }
];

// Helper function to calculate contrasting text color
const getContrastColor = (hexcolor) => {
    // Convert hex to RGB
    const r = parseInt(hexcolor.substr(1,2), 16);
    const g = parseInt(hexcolor.substr(3,2), 16);
    const b = parseInt(hexcolor.substr(5,2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

const initialRows = [
    { id: 'S', name: 'S Tier', color: '#FF7F7F' },
    { id: 'A', name: 'A Tier', color: '#FFBF7F' },
    { id: 'B', name: 'B Tier', color: '#FFDF7F' },
    { id: 'C', name: 'C Tier', color: '#FFFF7F' },
    { id: 'D', name: 'D Tier', color: '#7FFF7F' }
];

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



// Helper function to properly format setlist names
const formatSetlistName = (filename) => {
    return filename
        .split('.')[0]  // Remove file extension
        .split('_')
        .join(' ');
};

// Add new helper function for formatting video names
const formatVideoName = (filename) => {
    // Remove file extension
    let name = filename.split('.')[0];
    
    // Remove special prefixes
    name = name.replace(/^_New_Era_Special_Performance_Video[_–]?/, '');
    name = name.replace(/^360°_VR_＂/, '');
    name = name.replace(/＂$/, '');
    
    // Replace underscores with spaces
    name = name.replace(/_/g, ' ');
    
    // Remove anything in parentheses at the end if it's a translation
    name = name.replace(/\s*\([^)]*\)$/, '');
    
    return name;
};

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

const Droppable = ({id, children}) => {
    const {setNodeRef, isOver} = useDroppable({
        id: id,
    });

    return (
        <div 
            ref={setNodeRef} 
            className={`droppable ${isOver ? 'is-over' : ''}`}
            style={{ height: '100%' }}
        >
            {children}
        </div>
    );
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

const TierRow = ({ row, onMove, onEdit, onClear, onDelete, isFirstRow }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const headerRef = useRef(null);
    const nameRef = useRef(null);
    const buttonRef = useRef(null);
    const baseFontPxRef = useRef(null);
    const [nameFontPx, setNameFontPx] = useState(null);
    
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (action) => {
        handleClose();
        switch(action) {
            case 'up':
                onMove(row.id, 'up');
                break;
            case 'down':
                onMove(row.id, 'down');
                break;
            case 'edit':
                onEdit(row);
                break;
            case 'clear':
                onClear(row.id);
                break;
            case 'delete':
                onDelete(row.id);
                break;
            default:
                break;
        }
    };

    const textColor = getContrastColor(row.color);

    // Dynamically fit the tier name text within the header without moving the button
    const adjustNameFont = () => {
        const headerEl = headerRef.current;
        const nameEl = nameRef.current;
        const buttonEl = buttonRef.current;
        if (!headerEl || !nameEl || !buttonEl) return;

        const cs = window.getComputedStyle(headerEl);
        const padLeft = parseFloat(cs.paddingLeft || '0');
        const padRight = parseFloat(cs.paddingRight || '0');
        const contentWidth = headerEl.clientWidth - padLeft - padRight;
        const buttonWidth = buttonEl.offsetWidth || 0;
        const gap = 8; // margin-left on button
        const available = Math.max(0, contentWidth - buttonWidth - gap);

        // Determine base font size from computed style once
        if (!baseFontPxRef.current) {
            const nameCs = window.getComputedStyle(nameEl);
            baseFontPxRef.current = parseFloat(nameCs.fontSize || '18'); // default ~1.1rem
        }

        // Start from base
        let target = baseFontPxRef.current;
        nameEl.style.fontSize = `${target}px`;

        // Measure the longest word against available width so we avoid mid-word breaks
        const measure = () => {
            const nameCs = window.getComputedStyle(nameEl);
            const fontFamily = nameCs.fontFamily || 'sans-serif';
            const fontWeight = nameCs.fontWeight || '400';

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.font = `${fontWeight} ${baseFontPxRef.current}px ${fontFamily}`;
                const words = String(row.name || '').split(/\s+/).filter(Boolean);
                const maxWordWidth = words.reduce((max, w) => Math.max(max, ctx.measureText(w).width), 0);
                if (maxWordWidth > 0 && available > 0 && maxWordWidth > available) {
                    const ratio = available / maxWordWidth;
                    target = Math.max(10, Math.floor(baseFontPxRef.current * ratio));
                } else {
                    target = baseFontPxRef.current;
                }
            }
            setNameFontPx(target);
        };

        // Use rAF to ensure DOM styles applied before measuring
        requestAnimationFrame(measure);
    };

    useLayoutEffect(() => {
        adjustNameFont();
        const onResize = () => adjustNameFont();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        adjustNameFont();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row.name]);

    return (
        <div 
            className="row-header" 
            style={{ 
                backgroundColor: row.color,
                borderTopLeftRadius: isFirstRow ? '8px' : '0',
                borderTopRightRadius: '0',
                overflow: 'hidden' // ensure contents don't spill out
            }}
            ref={headerRef}
        >
            <span 
                style={{ 
                    color: textColor,
                    flex: 1,
                    minWidth: 0,
                    // Allow wrapping instead of truncating
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    fontSize: nameFontPx ? `${nameFontPx}px` : undefined
                }}
                ref={nameRef}
                title={row.name}
            >
                {row.name}
            </span>
            <IconButton 
                onClick={handleClick}
                size="small"
                style={{ color: textColor, flex: '0 0 auto', marginLeft: 8 }}
                ref={buttonRef}
            >
                <Settings />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                <MenuItem onClick={() => handleAction('up')}>
                    <ListItemIcon>
                        <ArrowUpward fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Move Up</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('down')}>
                    <ListItemIcon>
                        <ArrowDownward fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Move Down</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('edit')}>
                    <ListItemIcon>
                        <Edit fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit Name</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('clear')}>
                    <ListItemIcon>
                        <Delete fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Clear Row</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                        <Delete fontSize="small" sx={{ color: 'error.main' }} />
                    </ListItemIcon>
                    <ListItemText>Delete Row</ListItemText>
                </MenuItem>
            </Menu>
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
    const [selectedImage, setSelectedImage] = useState(null);
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
        
        // Only count as a change if the number actually changed
        if (currentAvailable !== availableCount) {
            setAvailableCount(currentAvailable);
            setLastAvailableCount(availableCount);
            setChangeCounter(prev => prev + 1);
            console.log('Available count changed:', currentAvailable, 'Change counter:', changeCounter + 1);
        }
    }, [images]);

    // Auto-save effect
    useEffect(() => {
        console.log('Change counter:', changeCounter);
        if (changeCounter >= 5) {  // Changed from 2 to 5
            console.log('Auto-saving draft...');
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
            console.log('Draft auto-saved');
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
        console.log('Managing drafts, isAutoSave:', isAutoSave);
        const storageKey = isAutoSave ? 'tierlistAutoSaveDrafts' : 'tierlistManualDrafts';
        const maxDrafts = isAutoSave ? 3 : 5;
        
        let drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
        console.log('Current drafts:', drafts);
        drafts = drafts.filter(d => d.type === tierlistType); // Only keep drafts of the same type
        
        // Add new draft
        drafts.unshift({
            ...newDraft,
            type: tierlistType,
            completion: calculateCompletion(newDraft.images),
            isAutoSave,
            id: Date.now()  // Unique ID for the draft
        });
        
        // Keep only the most recent drafts
        drafts = drafts.slice(0, maxDrafts);
        console.log('Updated drafts:', drafts);
        
        localStorage.setItem(storageKey, JSON.stringify(drafts));
    };

    useEffect(() => {
        const tierlistType = localStorage.getItem('tierlistType') || 'member';
        const memberType = localStorage.getItem('memberType') || 'active';
        const generation = localStorage.getItem('generation') || 'all';
        const videoType = localStorage.getItem('videoType') || 'all';
        const draftId = localStorage.getItem('currentDraftId');
        
        setTierlistType(tierlistType);
        console.log('Initial load with:', { tierlistType, memberType, generation, videoType, draftId });

        // Load the base image list
        let imageList = [];

        if (tierlistType === 'setlist') {
            imageList = setlistFiles.map((filename, index) => ({
                id: `setlist-${filename}`,
                src: `/asset/Setlist/${filename}`,
                name: formatSetlistName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else if (tierlistType === 'ramadan') {
            imageList = ssRamadanFiles.map((filename, index) => ({
                id: `ramadan-${filename}`,
                src: `/asset/SSRamadan/${filename}`,
                name: formatSetlistName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else if (tierlistType === 'video') {
            let videoFiles = [];
            if (videoType === 'all') {
                videoFiles = [...spvFiles, ...mvFiles];
            } else if (videoType === 'mv') {
                videoFiles = mvFiles;
            } else if (videoType === 'spv') {
                videoFiles = spvFiles;
            }
            
            imageList = videoFiles.map((filename, index) => ({
                id: `video-${filename}`,
                src: `/asset/SPV_MV/${filename}`,
                name: formatVideoName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else {
            // Helper function to check if a filename matches the generation
            const matchesGeneration = (filename) => {
                if (generation === 'all') return true;
                if (generation === 'genvall') {
                    const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;
                    return /^JKT48VGen\d+_/i.test(baseFilename) || /^JKT48V_Gen\d+_/i.test(baseFilename);
                }

                const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;

                // Handle JKT48V generations generically: genv1, genv2, ...
                if (generation.toLowerCase().startsWith('genv')) {
                    const vGenNumber = generation.slice(4); // after 'genv'
                    const vPrefixUnderscore = `JKT48V_Gen${vGenNumber}_`;
                    const vPrefixCompact = `JKT48VGen${vGenNumber}_`;
                    return baseFilename.startsWith(vPrefixUnderscore) || baseFilename.startsWith(vPrefixCompact);
                }

                // Handle regular generations: gen1, gen2, ...
                if (generation.toLowerCase().startsWith('gen')) {
                    const prefix = `Gen${generation.slice(3)}_`;
                    return baseFilename.startsWith(prefix);
                }

                // Fallback: if pattern unknown, include
                return true;
            };
            
            let currentIndex = 0;
            
            // Load active members if needed
            if (memberType === 'active' || memberType === 'all') {
                const activeMemberImages = activeMemberFiles
                    .filter(filename => matchesGeneration(filename))
                    .map((filename) => ({
                        id: `member-${filename}`,
                        src: `/asset/member_active/${filename}`,
                        name: formatMemberName(filename),
                        isTimLove: timLoveSet.has(filename.toLowerCase()),
                        containerId: 'image-pool',
                        originalIndex: currentIndex++
                    }));
                imageList = [...imageList, ...activeMemberImages];
            }

            // Load ex-members if needed
            if (memberType === 'ex' || memberType === 'all') {
                const exMembersList = exMemberFiles
                    .filter(filename => matchesGeneration(filename))
                    .map((filename) => ({
                        id: `member-${filename}`,
                        src: `/asset/exmember/${filename.replace(/\\/g, '/')}`,
                        name: formatMemberName(filename),
                        isTimLove: timLoveSet.has(filename.toLowerCase()),
                        containerId: 'image-pool',
                        originalIndex: currentIndex++
                    }));
                imageList = [...imageList, ...exMembersList];
            }
        }

        // If we have a draft ID, try to load the draft
        if (draftId) {
            console.log('Loading draft with ID:', draftId);
            const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
            const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
            const allDrafts = [...manualDrafts, ...autoDrafts];
            
            const draftToLoad = allDrafts.find(d => d.id.toString() === draftId.toString());
            console.log('Found draft:', draftToLoad);

            if (draftToLoad) {
                // Apply draft data
                setRows(draftToLoad.rows || initialRows);
                setTierlistTitle(draftToLoad.title || '');

                // Apply image positions from draft
                imageList = imageList.map(img => {
                    const savedImage = draftToLoad.images.find(i => i.id === img.id);
                    if (savedImage) {
                        console.log(`Moving ${img.id} to ${savedImage.containerId}`);
                        return { ...img, containerId: savedImage.containerId };
                    }
                    return img;
                });
            }
        } else {
            // Starting fresh - use initial rows
            console.log('Starting fresh tierlist');
            setRows(initialRows);
            setTierlistTitle('');
        }

        // Set the final image list
        console.log('Setting final image list:', imageList);
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
                
                // Find all images in the target container
                const containerImages = newImages.filter(img => img.containerId === overId);
                
                // Find the index after the last image in the target container
                const lastContainerImageIndex = newImages.findIndex(img => 
                    img.containerId === overId && 
                    containerImages.indexOf(img) === containerImages.length - 1
                );
                
                // Create the updated image with new container
                const updatedImage = { ...activeImage, containerId: overId };
                
                // If there are no images in the container or we couldn't find the last image
                if (containerImages.length === 0 || lastContainerImageIndex === -1) {
                    // Just append to the end of the array
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
                
                // Find all images in the target container
                const containerImages = newImages.filter(img => img.containerId === overContainer);
                
                // Find the index after the last image in the target container
                const lastContainerImageIndex = newImages.findIndex(img => 
                    img.containerId === overContainer && 
                    containerImages.indexOf(img) === containerImages.length - 1
                );
                
                // Create the updated image with new container
                const updatedImage = { ...activeImage, containerId: overContainer };
                
                // If there are no images in the container or we couldn't find the last image
                if (containerImages.length === 0 || lastContainerImageIndex === -1) {
                    // Just append to the end of the array
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

    const getImagesForContainer = (containerId) => {
        const filteredImages = images.filter(img => {
            if (img.containerId !== containerId) return false;
    
            if (containerId === 'image-pool' && searchTerm) {
                if (!img.id || typeof img.id !== 'string') return false;

                const searchableName = parseNameForSearch(img.id);
                const searchableDisplay = `${searchableName} ${(img.name || '').toLowerCase()}`;
                const searchLower = searchTerm.toLowerCase();

                // Normalize search terms and merge patterns like "gen 1" -> "gen1"
                const rawWords = searchLower.split(/\s+/).filter(Boolean);
                const mergedWords = [];
                for (let i = 0; i < rawWords.length; i++) {
                    const word = rawWords[i];
                    const next = rawWords[i + 1];
                    if ((word === 'gen' || word === 'genv') && next && /^\d+$/.test(next)) {
                        mergedWords.push(`${word}${next}`);
                        i++; // skip next
                        continue;
                    }
                    mergedWords.push(word);
                }

                const searchableTokens = searchableName.split(/\s+/).filter(Boolean);

                // Require every search token to match: gens must match exact token; others substring match
                const matches = mergedWords.every(word => {
                    if (/^genv?\d+$/i.test(word)) {
                        const re = new RegExp(`\\b${word}\\b`, 'i');
                        return re.test(searchableName);
                    }
                    return searchableDisplay.includes(word);
                });

                return matches;
            }
    
            return true;
        });
    
        if (containerId === 'image-pool') {
            // Sort the image pool by immutable originalIndex so items
            // return to their initial positions when sent back to pool
            return filteredImages.sort((a, b) => a.originalIndex - b.originalIndex);
        }
    
        return filteredImages;
    };
    
    
    

    const activeImage = activeId ? images.find(img => img.id === activeId) : null;

    const handleReset = () => {
        // Reset rows to initial state
        setRows([...initialRows]);

        // Reset images to initial state
        const tierlistType = localStorage.getItem('tierlistType') || 'member';
        const memberType = localStorage.getItem('memberType') || 'active';
        const generation = localStorage.getItem('generation') || 'all';
        const videoType = localStorage.getItem('videoType') || 'all';

        let imageList = [];

        if (tierlistType === 'setlist') {
            imageList = setlistFiles.map((filename, index) => ({
                id: `setlist-${filename}`,
                src: `/asset/Setlist/${filename}`,
                name: formatSetlistName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else if (tierlistType === 'ramadan') {
            imageList = ssRamadanFiles.map((filename, index) => ({
                id: `ramadan-${filename}`,
                src: `/asset/SSRamadan/${filename}`,
                name: formatSetlistName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else if (tierlistType === 'video') {
            let videoFiles = [];
            if (videoType === 'all') {
                videoFiles = [...spvFiles, ...mvFiles];
            } else if (videoType === 'mv') {
                videoFiles = mvFiles;
            } else if (videoType === 'spv') {
                videoFiles = spvFiles;
            }
            
            imageList = videoFiles.map((filename, index) => ({
                id: `video-${filename}`,
                src: `/asset/SPV_MV/${filename}`,
                name: formatVideoName(filename),
                containerId: 'image-pool',
                originalIndex: index
            }));
        } else {
            // Helper function to check if a filename matches the generation
            const matchesGeneration = (filename) => {
                if (generation === 'all') return true;

                const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;

                // Handle JKT48V generations generically: genv1, genv2, ...
                if (generation.toLowerCase().startsWith('genv')) {
                    const vGenNumber = generation.slice(4); // after 'genv'
                    const vPrefix = `JKT48V_Gen${vGenNumber}_`;
                    return baseFilename.startsWith(vPrefix);
                }

                // Handle regular generations: gen1, gen2, ...
                if (generation.toLowerCase().startsWith('gen')) {
                    const prefix = `Gen${generation.slice(3)}_`;
                    return baseFilename.startsWith(prefix);
                }

                // Fallback: if pattern unknown, include
                return true;
            };
            
            let currentIndex = 0;
            
            // Load active members if needed
            if (memberType === 'active' || memberType === 'all') {
                const activeMemberImages = activeMemberFiles
                    .filter(filename => matchesGeneration(filename))
                    .map((filename) => ({
                        id: `member-${filename}`,
                        src: `/asset/member_active/${filename}`,
                        name: formatMemberName(filename),
                        isTimLove: timLoveSet.has(filename.toLowerCase()),
                        containerId: 'image-pool',
                        originalIndex: currentIndex++
                    }));
                imageList = [...imageList, ...activeMemberImages];
            }

            // Load ex-members if needed
            if (memberType === 'ex' || memberType === 'all') {
                const exMembersList = exMemberFiles
                    .filter(filename => matchesGeneration(filename))
                    .map((filename) => ({
                        id: `member-${filename}`,
                        src: `/asset/exmember/${filename.replace(/\\/g, '/')}`,
                        name: formatMemberName(filename),
                        isTimLove: timLoveSet.has(filename.toLowerCase()),
                        containerId: 'image-pool',
                        originalIndex: currentIndex++
                    }));
                imageList = [...imageList, ...exMembersList];
            }
        }

        setImages(imageList);
    };

    const handleSave = async () => {
        if (!tierlistRef.current) return;

        try {
            const rowsContainer = tierlistRef.current.querySelector('.tier-rows-container');
            if (!rowsContainer) return;

            // Ensure fonts and images are ready
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready.catch(() => {});
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
            cloneRowsContainer.style.width = `${rowsContainer.offsetWidth}px`;
            cloneRowsContainer.style.margin = '0';
            cloneRowsContainer.style.padding = '10px 20px';
            cloneRowsContainer.style.boxSizing = 'border-box';
            cloneRowsContainer.style.position = 'absolute';
            cloneRowsContainer.style.left = '-9999px';
            cloneRowsContainer.style.top = '0';
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

            const options = {
                quality: 1.0,
                bgcolor: '#1a1a2e',
                style: {
                    'background-color': '#1a1a2e'
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
        }
    };

    // Update input width based on content
    useEffect(() => {
        const updateWidth = () => {
            if (titleInputRef.current && tierlistRef.current) {
                // Get the width of the first tier row for reference
                const firstRow = tierlistRef.current.querySelector('.tier-row');
                if (!firstRow) return;

                const rowWidth = firstRow.offsetWidth;
                
                // Create a hidden span to measure text width
                const span = document.createElement('span');
                span.className = 'tierlist-title-measure';
                span.style.font = window.getComputedStyle(titleInputRef.current).font;
                span.textContent = tierlistTitle || titleInputRef.current.placeholder;
                document.body.appendChild(span);
                
                // Calculate width with padding
                const textWidth = span.offsetWidth;
                const padding = 24; // 12px padding on each side
                const newWidth = Math.min(Math.max(300, textWidth + padding), rowWidth); // between 300px and row width
                
                document.body.removeChild(span);
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
            // If clicking the same image that's selected, unselect it
            if (selectedImage?.id === image.id) {
                setSelectedImage(null);
            } else {
                // If clicking a different image, select it
                setSelectedImage(image);
            }
            // Add a small delay to prevent accidental double-clicks
            const currentTarget = image;
            setTimeout(() => {
                if (selectedImage?.id === currentTarget.id) {
                    setSelectedImage(null);
                }
            }, 300);
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
            // Always clear selection when right-clicking
            setSelectedImage(null);
        }
    };

    const handleTierClick = (tierId) => {
        if (!isDragMode && selectedImage) {
            setImages(prev => {
                const activeImage = prev.find(img => img.id === selectedImage.id);
                if (!activeImage) return prev;
                if (activeImage.containerId === tierId) return prev; // No change

                // Remove the image from its current position
                const newImages = prev.filter(img => img.id !== selectedImage.id);

                // Find all images currently in the target container
                const containerImages = newImages.filter(img => img.containerId === tierId);

                // Find the index after the last image in the target container (within array order)
                const lastContainerImageIndex = newImages.findIndex(img => 
                    img.containerId === tierId &&
                    containerImages.indexOf(img) === containerImages.length - 1
                );

                const updatedImage = { ...activeImage, containerId: tierId };

                // If container empty, or we couldn't find the last item, append to end
                if (containerImages.length === 0 || lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                // Insert right after the last image of that container
                newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                return newImages;
            });
            // Clear selection after placing
            setTimeout(() => setSelectedImage(null), 50);
        }
    };

    const getTierlistTypeDisplay = () => {
        switch(tierlistType) {
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
                                    cursor: (!isDragMode && selectedImage) ? 'pointer' : 'default',
                                    opacity: (!isDragMode && selectedImage) ? 0.8 : 1
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
                                            {getImagesForContainer(row.id).map((image) => (
                                                <SortableImage 
                                                    key={image.id} 
                                                    image={image}
                                                    isDragging={image.id === activeId}
                                                    onImageClick={handleImageClick}
                                                    onContextMenu={handleImageRightClick}
                                                    isSelected={selectedImage?.id === image.id}
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
                                        setSelectedImage(null);
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
                            startIcon={<Save />}
                            onClick={handleSave}
                            className="action-button"
                        >
                            Save as Image
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
                                {!isDragMode && selectedImage && (
                                    <span style={{ fontSize: '0.8em', marginLeft: '10px', color: '#4CAF50' }}>
                                        Selected: {selectedImage.name}
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
                                            isSelected={selectedImage?.id === image.id}
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
