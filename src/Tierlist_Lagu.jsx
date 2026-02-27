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
import { setlistSongs } from './data/setlistSongs';
import './Tierlist.css';
import './TierlistPage_Lagu.css';
import logo from './assets/icon/TierlistIcon.png';

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
    const r = parseInt(hexcolor.substr(1, 2), 16);
    const g = parseInt(hexcolor.substr(3, 2), 16);
    const b = parseInt(hexcolor.substr(5, 2), 16);

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
    const parts = filename.split('.')[0].split('_');

    // Special handling for JKT48V members
    if (parts[0] === 'JKT48V') {
        return parts.slice(3).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // Regular handling for other members
    return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

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

const Droppable = ({ id, children }) => {
    const { setNodeRef, isOver } = useDroppable({
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

const DraggableImage = ({ song, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.05)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : 'none'
    };

    // Get the selected setlist from localStorage
    const selectedSetlist = localStorage.getItem('selectedSetlist') || "Aturan Anti Cinta";

    // Map of special cases where the filename differs from the standard format
    const specialCases = {
        "BELIEVE": "BELIEVE",
        "Fly! Team T": "Fly!_Team_T",
        "Ingin Bertemu": "Ingin_Bertemu"
    };

    // Get the filename, either from special cases or by standard formatting
    const imageFilename = specialCases[selectedSetlist] ||
        selectedSetlist
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('_');

    // Special case for file extension
    const extension = selectedSetlist === "Ingin Bertemu" ? 'webp' : 'jpg';

    return (
        <div
            className={`song-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick && onImageClick(song)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, song)}
        >
            <img
                src={`/asset/Setlist/${imageFilename}.${extension}`}
                alt={song.name}
                className="song-background"
            />
            <div className="song-name">{song.name}</div>
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
                song={image}
                isDragging={isDragging}
                onImageClick={isDragMode ? onImageClick : null}
                onContextMenu={onContextMenu}
                isSelected={isSelected}
                isDragMode={isDragMode}
            />
        </div>
    );
};

const TierRow = ({ row, onMove, onEdit, onClear, onDelete, isFirstRow, children }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleAction = (action) => {
        handleClose();
        switch (action) {
            case 'up': onMove(row.id, 'up'); break;
            case 'down': onMove(row.id, 'down'); break;
            case 'edit': onEdit(row); break;
            case 'clear': onClear(row.id); break;
            case 'delete': onDelete(row.id); break;
            default: break;
        }
    };

    const textColor = getContrastColor(row.color);

    return (
        <div
            className="row-header"
            style={{
                backgroundColor: row.color,
                borderTopLeftRadius: isFirstRow ? '8px' : '0',
                borderTopRightRadius: '0',
            }}
        >
            <span
                className="row-name-label"
                title={row.name}
                style={{ color: textColor }}
            >
                {row.name}
            </span>
            <IconButton
                onClick={handleClick}
                size="small"
                style={{ color: textColor, flex: '0 0 auto', marginLeft: 8 }}
            >
                <Settings />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
                <MenuItem onClick={() => handleAction('up')}>
                    <ListItemIcon><ArrowUpward fontSize="small" /></ListItemIcon>
                    <ListItemText>Move Up</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('down')}>
                    <ListItemIcon><ArrowDownward fontSize="small" /></ListItemIcon>
                    <ListItemText>Move Down</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('edit')}>
                    <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit Name</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('clear')}>
                    <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
                    <ListItemText>Clear Row</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
                    <ListItemIcon><Delete fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                    <ListItemText>Delete Row</ListItemText>
                </MenuItem>
            </Menu>
            {children}
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
    const [selectedImage, setSelectedImage] = useState(null);
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
        console.log('Loading songs for setlist:', setlistName);

        // Load songs for the selected setlist
        const songList = setlistSongs[setlistName].map((songName, index) => ({
            id: `song-${songName}`,
            name: songName,
            containerId: 'image-pool',
            originalIndex: index
        }));
        console.log('Initial song list:', songList);

        // First set the initial song list
        setSongs(songList);

        // Then check for draft loading
        const draftId = localStorage.getItem('currentDraftId');
        console.log('Current draft ID:', draftId);

        if (draftId) {
            const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
            const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');

            // Combine all drafts
            const allDrafts = [...manualDrafts, ...autoDrafts];
            console.log('Available drafts:', allDrafts);

            // Find the specific draft
            const draftToLoad = allDrafts.find(d => d.id.toString() === draftId.toString());
            console.log('Found draft to load:', draftToLoad);

            if (draftToLoad) {
                console.log('Loading draft with rows:', draftToLoad.rows);
                console.log('Loading draft with songs:', draftToLoad.songs);

                // Set the rows first
                setRows(draftToLoad.rows || initialRows);
                setTierlistTitle(draftToLoad.title || '');

                // Update song positions from draft
                const updatedSongs = songList.map(song => {
                    // Find the saved song by matching both ID and name for extra safety
                    const savedSong = draftToLoad.songs.find(s =>
                        s.id === song.id ||
                        (s.id === `song-${song.name}` || s.id === `song-${song.id}`)
                    );
                    console.log(`Mapping song ${song.id}:`, {
                        found: !!savedSong,
                        newContainer: savedSong?.containerId || 'image-pool'
                    });
                    return savedSong ? { ...song, containerId: savedSong.containerId } : song;
                });

                console.log('Final updated songs:', updatedSongs);
                setSongs(updatedSongs);
            } else {
                console.log('No matching draft found for ID:', draftId);
            }
        } else {
            console.log('No draft ID found, starting fresh');
        }

        // Clear the current draft ID after loading
        localStorage.removeItem('currentDraftId');
    }, []);

    // Track changes in available items count
    useEffect(() => {
        const currentAvailable = songs.filter(song => song.containerId === 'image-pool').length;

        // Only count as a change if the number actually changed
        if (currentAvailable !== availableCount) {
            setAvailableCount(currentAvailable);
            setLastAvailableCount(availableCount);
            setChangeCounter(prev => prev + 1);
            console.log('Available count changed:', currentAvailable, 'Change counter:', changeCounter + 1);
        }
    }, [songs]);

    // ── Sync row-header widths so all rows share the same column width ──
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

        const totalW = Math.ceil(maxTextPx + padH + buttonW);
        headers.forEach(h => { h.style.width = `${totalW}px`; });
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
        const activeImage = songs.find(img => img.id === active.id);
        const overContainer = overId;

        // Check if moving to a different container
        if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            setSongs(prev => {
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

    const getImagesForContainer = (containerId) => {
        const filteredImages = songs.filter(img => {
            const matchesContainer = img.containerId === containerId;
            const matchesSearch = containerId === 'image-pool'
                ? img.name.toLowerCase().includes(searchTerm.toLowerCase())
                : true;
            return matchesContainer && matchesSearch;
        });
        // Sort by original index when in image pool
        if (containerId === 'image-pool') {
            return filteredImages.sort((a, b) => a.originalIndex - b.originalIndex);
        }
        return filteredImages;
    };

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

    const handleSave = async () => {
        if (!tierlistRef.current) return;

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
            cloneRowsContainer.style.width = `${rowsContainer.offsetWidth}px`;
            cloneRowsContainer.style.margin = '0';
            cloneRowsContainer.style.padding = '10px 20px';
            cloneRowsContainer.style.boxSizing = 'border-box';
            cloneRowsContainer.style.position = 'absolute';
            cloneRowsContainer.style.left = '-9999px';
            cloneRowsContainer.style.top = '0';
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

            const options = {
                quality: 1.0,
                bgcolor: '#1a1a2e',
                width: captureWidth,
                height: captureHeight,
                style: {
                    'background-color': '#1a1a2e',
                    width: `${captureWidth}px`,
                    height: `${captureHeight}px`
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
        if (!isDragMode) {
            if (image.containerId !== 'image-pool') {
                setSongs(prev => prev.map(img =>
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
            setSongs(prev => {
                const newImages = prev.map(img =>
                    img.id === selectedImage.id
                        ? { ...img, containerId: tierId }
                        : img
                );
                // Clear selection after placing
                setTimeout(() => setSelectedImage(null), 50);
                return newImages;
            });
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
        console.log('Change counter:', changeCounter);
        if (changeCounter >= 2) {
            console.log('Auto-saving draft...');
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

            // Show auto-save indicator
            setShowAutoSave(true);
            setTimeout(() => setShowAutoSave(false), 2000);
            console.log('Draft auto-saved');
        }
    }, [changeCounter, rows, songs, tierlistTitle, selectedSetlist]);

    // Function to manage drafts in localStorage
    const manageDrafts = (newDraft, isAutoSave = false) => {
        console.log('Managing drafts, isAutoSave:', isAutoSave);
        const storageKey = isAutoSave ? 'tierlistAutoSaveDrafts' : 'tierlistManualDrafts';
        const maxDrafts = isAutoSave ? 3 : 5;

        let drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
        console.log('Current drafts:', drafts);
        drafts = drafts.filter(d => d.type === 'song' && d.setlist === selectedSetlist); // Only keep drafts of the same type and setlist

        // Add new draft
        drafts.unshift({
            ...newDraft,
            type: 'song',
            setlist: selectedSetlist,
            completion: calculateCompletion(newDraft.songs),
            isAutoSave,
            id: Date.now()  // Unique ID for the draft
        });

        // Keep only the most recent drafts
        drafts = drafts.slice(0, maxDrafts);
        console.log('Updated drafts:', drafts);

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
                    </div>

                    <div className="image-pool-container">
                        <div className="image-pool-header">
                            <h2>
                                {selectedSetlist} Songs ({getImagesForContainer('image-pool').length})
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
                                song={songs.find(img => img.id === activeId)}
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
