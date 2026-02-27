import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Button, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Paper, Switch, FormControlLabel, Typography, Box, IconButton, Menu, ListItemIcon, ListItemText, Autocomplete, InputAdornment } from '@mui/material';
import { Settings, ArrowUpward, ArrowDownward, Edit, Delete, Save, Search, ArrowBack, Info } from '@mui/icons-material';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, pointerWithin, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import domtoimage from 'dom-to-image-more';
import dreamSetlistSongs from './data/DreamSetlist_Songs';
import { activeMemberFiles, exMemberFiles } from './data/memberData';
import logo from './assets/icon/TierlistIcon.png';
import './Dream_Setlist.css';
import { useNavigate } from 'react-router-dom';
import ViewportManager from './components/ViewportManager';

const TIER_ROWS = [
    { id: 'inti', name: 'Tim Inti', color: '#FF7F7F' },
    { id: 'backup', name: 'Tim Backup', color: '#7FBFFF' },
];

const SONG_TABLE_ROWS = [
    { no: 'M01', type: 'main' },
    { no: 'M02', type: 'main' },
    { no: 'M03', type: 'main' },
    { no: 'M04', type: 'main' },
    { no: 'US1', type: 'us' },
    { no: 'US2', type: 'us' },
    { no: 'US3', type: 'us' },
    { no: 'US4', type: 'us' },
    { no: 'US5', type: 'us' },
    { no: 'M10', type: 'main' },
    { no: 'M11', type: 'main' },
    { no: 'M12', type: 'main' },
    { no: 'M13', type: 'main' },
    { no: 'EN01', type: 'en' },
    { no: 'EN02', type: 'en' },
    { no: 'EN03', type: 'en' },
].map(row => ({ ...row, song: '', members: [], backupMembers: [] }));

const getContrastColor = (hexcolor) => {
    const r = parseInt(hexcolor.substr(1, 2), 16);
    const g = parseInt(hexcolor.substr(3, 2), 16);
    const b = parseInt(hexcolor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

const formatMemberName = (filename) => {
    if (!filename || typeof filename !== 'string') return '';
    const baseName = filename.split('/').pop().split('.')[0];
    const parts = baseName.split('_');
    if (parts[0] && parts[0].toUpperCase() === 'JKT48V') {
        const genIndex = parts.findIndex(part => part.toLowerCase().startsWith('gen'));
        if (genIndex !== -1 && parts.length > genIndex + 1) {
            return parts.slice(genIndex + 1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }
        return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }
    if (parts[0] && parts[0].toLowerCase().startsWith('gen')) {
        return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }
    return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const parseNameForSearch = (filename) => {
    if (!filename || typeof filename !== 'string') return '';

    const baseName = filename.split('/').pop().split('.')[0];
    const parts = baseName.split('_');

    let genPart = '';
    let nameParts = [];

    if (parts[0].toUpperCase() === 'JKT48V') {
        const genIndex = parts.findIndex(p => p.toLowerCase().startsWith('gen'));
        if (genIndex !== -1) {
            genPart = parts[genIndex];
            nameParts = parts.slice(genIndex + 1);
        } else {
            nameParts = parts.slice(1);
        }
    } else if (parts[0].toLowerCase().startsWith('gen')) {
        genPart = parts[0];
        nameParts = parts.slice(1);
    } else {
        nameParts = parts;
    }

    return (genPart + ' ' + nameParts.join(' ')).toLowerCase();
};

const DraggableImage = ({ image, isDragging, dragOverlay, onImageClick, onContextMenu, isSelected, isDragMode, isInTable = false }) => {
    const style = {
        opacity: isSelected ? 0.5 : isDragging ? 0.3 : 1,
        cursor: isDragMode ? (dragOverlay ? 'grabbing' : 'grab') : 'pointer',
        position: dragOverlay ? 'fixed' : 'relative',
        transform: dragOverlay ? 'scale(1.05)' : 'none',
        zIndex: dragOverlay ? 999 : 1,
        border: isSelected ? '2px solid #4CAF50' : 'none',
        ...(isInTable ? {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        } : {})
    };

    const imageStyle = isInTable ? {
        width: '100%',
        height: 'auto',
        objectFit: 'cover',
        aspectRatio: '1/1',
        borderRadius: '4px'
    } : {};

    const nameStyle = isInTable ? {
        fontSize: '0.8rem',
        textAlign: 'center',
        marginTop: '4px',
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    } : {};

    const handleContextMenu = (e) => {
        e.preventDefault(); // Prevent default context menu
        if (image.containerId !== 'image-pool') {
            onContextMenu && onContextMenu(e, image);
        }
    };

    return (
        <div
            className={`member-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''}`}
            style={style}
            onClick={() => onImageClick && onImageClick(image)}
            onContextMenu={handleContextMenu}
        >
            <img src={image.src} alt={image.name} style={imageStyle} />
            <div className="member-name" style={nameStyle}>{image.name}</div>
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
        >
            <DraggableImage
                image={image}
                isDragging={isDragging}
                onImageClick={onImageClick}
                onContextMenu={onContextMenu}
                isSelected={isSelected}
                isDragMode={isDragMode}
            />
        </div>
    );
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

const TierRow = ({ row, onMove, onEdit, onClear, onDelete, isFirstRow }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (action) => {
        handleClose();
        switch (action) {
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

    return (
        <div
            className="row-header"
            style={{
                backgroundColor: row.color,
                borderTopLeftRadius: isFirstRow ? '8px' : '0',
                borderTopRightRadius: '0',
                color: textColor
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
                style={{ color: textColor }}
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

const DreamSetlist = () => {
    // Add state for welcome dialog
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);

    // Step state: 0 = start, 1 = member select, 2 = song select
    const [step, setStep] = useState(0);
    const [memberType, setMemberType] = useState('active');
    const [isDragMode, setIsDragMode] = useState(false);
    const [rows, setRows] = useState(TIER_ROWS);
    const [images, setImages] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [songTable, setSongTable] = useState(SONG_TABLE_ROWS.map(row => ({ ...row, song: '', members: [], backupMembers: [] })));
    const [title, setTitle] = useState('');
    const tierlistRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredImages, setFilteredImages] = useState([]);
    const navigate = useNavigate();

    // Check if it's first visit when component mounts
    useEffect(() => {
        setShowWelcomeDialog(true);
    }, []);

    // Handle welcome dialog close
    const handleWelcomeDialogClose = () => {
        setShowWelcomeDialog(false);
    };

    // Step 1: Member type selection
    useEffect(() => {
        if (step === 1) {
            let memberFiles = [];
            if (memberType === 'active') memberFiles = activeMemberFiles;
            else if (memberType === 'ex') memberFiles = exMemberFiles;
            else memberFiles = [...activeMemberFiles, ...exMemberFiles];
            const imageList = memberFiles.map((filename, idx) => {
                // For ex-members, the filename already includes the generation folder
                const isExMember = filename.includes('/');
                const src = isExMember ?
                    `/asset/exmember/${filename}` :
                    `/asset/member_active/${filename}`;

                return {
                    id: `member-${filename}`,
                    src,
                    name: formatMemberName(filename),
                    containerId: 'image-pool',
                    originalIndex: idx
                };
            });
            setImages(imageList);
            setRows(TIER_ROWS);
        }
    }, [step, memberType]);

    // Add effect to filter images based on search
    useEffect(() => {
        if (step === 1) {
            const filtered = images.filter(image => {
                const searchString = parseNameForSearch(image.src);
                return searchString.includes(searchTerm.toLowerCase());
            });
            setFilteredImages(filtered);
        }
    }, [searchTerm, images, step]);

    // ── Sync row-header widths so all rows share the same column width ──
    useLayoutEffect(() => {
        // tierlistRef wraps the capture area, not the tier rows — use the
        // tier-rows-container directly instead
        const tierRowsContainer = document.querySelector('.tier-rows-container');
        if (!tierRowsContainer) return;
        const headers = Array.from(tierRowsContainer.querySelectorAll('.row-header'));
        if (headers.length === 0) return;

        // Canvas-based measurement: find widest word across all row names
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Read font from the first label (or fall back)
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

        // Padding + button
        const firstHeader = headers[0];
        const cs = window.getComputedStyle(firstHeader);
        const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const btn = firstHeader.querySelector('button');
        const buttonW = btn ? btn.offsetWidth + 8 : 44;

        const totalW = Math.ceil(maxTextPx + padH + buttonW);
        headers.forEach(h => { h.style.width = `${totalW}px`; });
    }, [rows, step]);


    // Step 2: Save to localStorage and prepare song table
    const handleNextFromMember = () => {
        const tierData = rows.map(row => ({
            id: row.id,
            name: row.name,
            members: images.filter(img => img.containerId === row.id)
        }));
        localStorage.setItem('dreamSetlistMemberTiers', JSON.stringify(tierData));
        localStorage.setItem('dreamSetlistMemberPool', JSON.stringify(images));
        setStep(2);
    };

    // Step 3: Load member pool from localStorage
    useEffect(() => {
        if (step === 2) {
            const pool = JSON.parse(localStorage.getItem('dreamSetlistMemberPool') || '[]');
            setImages(pool.filter(img => img.containerId === 'inti' || img.containerId === 'backup'));
            setIsDragMode(false); // Force click-to-place mode in step 2
        }
    }, [step]);

    // DnD setup
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
        if (!isDragMode) return;
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
                if (activeImage.containerId === overId) return prev;

                const newImages = prev.filter(img => img.id !== active.id);
                const containerImages = newImages.filter(img => img.containerId === overId);
                const lastContainerImageIndex = newImages.findIndex(img =>
                    img.containerId === overId &&
                    containerImages.indexOf(img) === containerImages.length - 1
                );

                const updatedImage = { ...activeImage, containerId: overId };

                if (containerImages.length === 0 || lastContainerImageIndex === -1) {
                    return [...newImages, updatedImage];
                }

                newImages.splice(lastContainerImageIndex + 1, 0, updatedImage);
                return newImages;
            });
        }
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
    };

    // Click-to-assign for member selection
    const handleImageClick = (image) => {
        if (!isDragMode) {
            if (selectedImage?.id === image.id) {
                // If clicking the same image that's selected, just deselect it
                setSelectedImage(null);
            } else {
                // If clicking a different image, select it
                setSelectedImage(image);
            }
        }
    };

    const handleImageRightClick = (e, image) => {
        e.preventDefault(); // Prevent default context menu
        if (image.containerId !== 'image-pool') {
            setImages(prev => {
                // Get all images except the one being moved
                const otherImages = prev.filter(img => img.id !== image.id);

                // Create updated version of the image for the pool
                const updatedImage = {
                    ...image,
                    containerId: 'image-pool'
                };

                // Find the correct position based on originalIndex
                const insertIndex = otherImages.findIndex(img =>
                    img.containerId === 'image-pool' && img.originalIndex > image.originalIndex
                );

                if (insertIndex === -1) {
                    // If no higher index found, append to the end
                    return [...otherImages, updatedImage];
                } else {
                    // Insert at the correct position
                    return [
                        ...otherImages.slice(0, insertIndex),
                        updatedImage,
                        ...otherImages.slice(insertIndex)
                    ];
                }
            });

            // Clear selection if in click-to-place mode
            if (!isDragMode) {
                setSelectedImage(null);
            }
        }
    };

    const handleTierClick = (tierId) => {
        if (!isDragMode && selectedImage) {
            setImages(prev => {
                // Get all images in the target tier
                const tierImages = prev.filter(img => img.containerId === tierId);

                // Create new array with all images except the selected one
                const otherImages = prev.filter(img => img.id !== selectedImage.id);

                // Create updated version of selected image
                const updatedImage = {
                    ...selectedImage,
                    containerId: tierId,
                    originalIndex: tierImages.length > 0
                        ? Math.max(...tierImages.map(img => img.originalIndex)) + 1
                        : 0
                };

                // Return new array with selected image at the end
                return [...otherImages, updatedImage];
            });

            // Clear selection after placing
            setTimeout(() => setSelectedImage(null), 50);
        }
    };

    // Song table handlers
    const handleSongChange = (idx, songId) => {
        setSongTable(prev => prev.map((row, i) => i === idx ? { ...row, song: songId } : row));
    };
    // Update handleAssignMemberToSong to handle arrays
    const handleAssignMemberToSong = (idx, member, isBackup = false) => {
        setSongTable(prev => prev.map((row, i) => {
            if (i === idx) {
                const memberArray = isBackup ? row.backupMembers : row.members;
                // Check if member is already in the array
                const memberExists = memberArray.some(m => m.id === member.id);
                if (!memberExists) {
                    return {
                        ...row,
                        [isBackup ? 'backupMembers' : 'members']: [...memberArray, member]
                    };
                }
            }
            return row;
        }));
    };

    // DnD for song table (step 3)
    const handleSongTableDragStart = (event) => { if (!isDragMode) return; setActiveId(event.active.id); };
    // Update handleSongTableDragOver to handle both member types
    const handleSongTableDragOver = (event) => {
        if (!isDragMode) return;
        const { active, over } = event;
        if (!over) return;
        const overId = over.id;
        if (overId.startsWith('songcell-') || overId.startsWith('backupcell-')) {
            const idx = parseInt(overId.replace(overId.startsWith('backupcell-') ? 'backupcell-' : 'songcell-', ''));
            const isBackup = overId.startsWith('backupcell-');
            const member = images.find(img => img.id === active.id);
            handleAssignMemberToSong(idx, member, isBackup);
        }
    };
    const handleSongTableDragEnd = (event) => { setActiveId(null); };

    // Click-to-assign for song table
    // Update handleSongCellClick to handle both member types
    const handleSongCellClick = (idx, isBackup = false) => {
        if (!isDragMode && selectedImage) {
            handleAssignMemberToSong(idx, selectedImage, isBackup);
            setSelectedImage(null);
        }
    };

    // Update handleSongTableMemberRightClick to fix deletion issue
    const handleSongTableMemberRightClick = (e, idx, memberId, isBackup = false) => {
        e.preventDefault();
        const row = songTable[idx];
        const memberArray = isBackup ? row.backupMembers : row.members;
        const member = memberArray.find(m => m.id === memberId);

        if (member) {
            // Check if this member appears multiple times in the song table
            const totalAppearances = songTable.reduce((count, row) => {
                const inMembers = row.members.filter(m => m.id === memberId).length;
                const inBackup = row.backupMembers.filter(m => m.id === memberId).length;
                return count + inMembers + inBackup;
            }, 0);

            // Remove one instance from the current cell
            setSongTable(prev => prev.map((row, i) =>
                i === idx ? {
                    ...row,
                    [isBackup ? 'backupMembers' : 'members']: memberArray.filter((m, index) => {
                        if (m.id === memberId) {
                            // Find the index of this specific instance
                            const instanceIndex = memberArray.findIndex((instance, i) =>
                                instance.id === memberId && i >= index
                            );
                            // Only remove if it's the last instance
                            return instanceIndex !== index;
                        }
                        return true;
                    })
                } : row
            ));

            // If this was the last instance of the member in the song table,
            // return it to its original tier pool
            if (totalAppearances === 1) {
                const originalTier = images.find(img => img.id === memberId)?.containerId;
                if (originalTier === 'inti' || originalTier === 'backup') {
                    setImages(prev => {
                        // Get all images except the one being moved
                        const otherImages = prev.filter(img => img.id !== memberId);

                        // Create updated version of the image for its original tier
                        const updatedImage = {
                            ...member,
                            containerId: originalTier
                        };

                        // Return new array with member back in its original tier
                        return [...otherImages, updatedImage];
                    });
                }
            }
        }
    };

    // Add save to image functionality
    const handleSave = async () => {
        try {
            const node = tierlistRef.current;
            if (!node) return;

            const dataUrl = await domtoimage.toJpeg(node, {
                quality: 0.95,
                bgcolor: '#1a1a2e'
            });

            const link = document.createElement('a');
            link.download = `${title || 'Dream_Setlist'}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error saving image:', error);
        }
    };

    return (
        <>
            <ViewportManager />
            <div className="tierlist-page" style={{
                backgroundColor: '#1a1a2e',
                minHeight: '100vh',
                padding: '20px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'scale(var(--viewport-scale, 1))',
                transformOrigin: 'top center'
            }}>
                {/* Add Welcome Dialog */}
                <Dialog
                    open={showWelcomeDialog}
                    onClose={handleWelcomeDialogClose}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        style: {
                            backgroundColor: '#2a2a3e',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.12)'
                        }
                    }}
                >
                    <DialogTitle sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}>
                        <Info sx={{ color: '#4CAF50' }} />
                        Cara Menggunakan Dream Setlist
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: '#4CAF50' }}>
                            Langkah 1: Pilih Member
                        </Typography>

                        <Box sx={{ ml: 2, mb: 3 }}>
                            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                1. Klik member untuk memilih
                            </Typography>
                            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                2. Klik Tim Inti atau Tim Backup untuk menempatkan member
                            </Typography>
                            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                3. Klik kanan member untuk mengembalikan ke pool
                            </Typography>

                        </Box>

                        <Typography variant="h6" gutterBottom sx={{ color: '#4CAF50' }}>
                            Langkah 2: Pilih Lagu & Posisi
                        </Typography>

                        <Box sx={{ ml: 2 }}>
                            <Typography variant="body1" paragraph>
                                1. Pilih lagu untuk setiap nomor urut
                            </Typography>
                            <Typography variant="body1" paragraph>
                                2. Klik member untuk memilih
                            </Typography>
                            <Typography variant="body1" paragraph>
                                3. Klik kolom Tim Inti atau Tim Backup untuk menempatkan (untuk Group Song mohon untuk hanya meletakan Member Center)
                            </Typography>
                            <Typography variant="body1">
                                4. Klik kanan pada member untuk menghapus dari posisi
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{
                        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '16px 24px'
                    }}>
                        <Button
                            onClick={handleWelcomeDialogClose}
                            variant="contained"
                            sx={{
                                bgcolor: '#4CAF50',
                                '&:hover': {
                                    bgcolor: '#45a049'
                                }
                            }}
                        >
                            Mengerti
                        </Button>
                    </DialogActions>
                </Dialog>

                <header className="header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '30px',
                    backgroundColor: 'rgba(42, 42, 62, 0.95)',
                    borderRadius: '0',
                    width: '100%',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    padding: '10px 20px'
                }}>
                    <IconButton
                        onClick={() => navigate('/')}
                        sx={{
                            color: 'white',
                            mr: 2,
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            }
                        }}
                    >
                        <ArrowBack />
                    </IconButton>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        <img src={logo} alt="JKT48 Tierlist Logo" className="header-logo" style={{
                            width: '50px',
                            height: '50px',
                            marginRight: '15px'
                        }} />
                        <h1 className="header-title" style={{
                            margin: 0,
                            fontSize: '24px',
                            fontWeight: 'bold'
                        }}>Dream Setlist JKT48</h1>
                    </div>
                </header>
                <div className="tierlist-container" style={{
                    width: '100%',
                    maxWidth: '1200px',
                    marginTop: '80px' // Add margin to account for fixed header
                }}>
                    {step === 0 && (
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            mt: 8
                        }}>
                            <Typography variant="h4" sx={{
                                mb: 4,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                color: 'white'
                            }}>
                                Pilih Status Member
                            </Typography>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                width: '100%',
                                maxWidth: '400px'
                            }}>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        setMemberType('active');
                                        setStep(1);
                                    }}
                                    sx={{
                                        py: 2,
                                        borderRadius: 3,
                                        backgroundColor: '#FF7F7F',
                                        fontSize: '1.1rem',
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: '#FF6B6B'
                                        }
                                    }}
                                >
                                    Active Member
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        setMemberType('ex');
                                        setStep(1);
                                    }}
                                    sx={{
                                        py: 2,
                                        borderRadius: 3,
                                        backgroundColor: '#7F7FFF',
                                        fontSize: '1.1rem',
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: '#6B6BFF'
                                        }
                                    }}
                                >
                                    Ex Member
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        setMemberType('all');
                                        setStep(1);
                                    }}
                                    sx={{
                                        py: 2,
                                        borderRadius: 3,
                                        backgroundColor: '#BFBFBF',
                                        fontSize: '1.1rem',
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: '#A6A6A6'
                                        }
                                    }}
                                >
                                    All Member
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => navigate('/')}
                                    sx={{
                                        py: 2,
                                        borderRadius: 3,
                                        backgroundColor: 'white',
                                        color: '#1a1a2e',
                                        fontSize: '1.1rem',
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: '#f5f5f5'
                                        }
                                    }}
                                >
                                    Back to Homepage
                                </Button>
                            </Box>
                        </Box>
                    )}
                    {step === 1 && (
                        <>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%',
                                gap: 3
                            }}>
                                <Typography variant="h4" sx={{
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    color: 'white',
                                    mb: 2
                                }}>
                                    Pilih Member ke Tim Inti & Tim Backup
                                </Typography>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    padding: '15px 20px',
                                    borderRadius: '16px',
                                    mb: 2
                                }}>
                                    <Box sx={{ color: 'white', textAlign: 'left' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                            Click to Place Mode
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block', color: '#aaa' }}>
                                            Click member to select, click again to return to pool
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        onClick={handleNextFromMember}
                                        sx={{
                                            py: 1.5,
                                            px: 4,
                                            borderRadius: 3,
                                            backgroundColor: '#4CAF50',
                                            fontSize: '1.1rem',
                                            textTransform: 'none',
                                            '&:hover': {
                                                backgroundColor: '#45a049'
                                            }
                                        }}
                                    >
                                        Next
                                    </Button>
                                </Box>
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={pointerWithin}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={() => setActiveId(null)}
                                >
                                    <Box sx={{
                                        width: '100%',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: '16px',
                                        p: 2
                                    }}>
                                        <div className="tier-rows-container">
                                            {rows.map((row, idx) => (
                                                <div
                                                    key={row.id}
                                                    className={`tier-row ${idx === 0 ? 'first-tier-row' : ''}`}
                                                    onClick={() => handleTierClick(row.id)}
                                                    style={{
                                                        cursor: (!isDragMode && selectedImage) ? 'pointer' : 'default',
                                                        opacity: (!isDragMode && selectedImage) ? 0.8 : 1
                                                    }}
                                                >
                                                    <TierRow
                                                        row={row}
                                                        onMove={(id, direction) => {
                                                            const currentIndex = rows.findIndex(r => r.id === id);
                                                            if (direction === 'up' && currentIndex > 0) {
                                                                const newRows = arrayMove(rows, currentIndex, currentIndex - 1);
                                                                setRows(newRows);
                                                            } else if (direction === 'down' && currentIndex < rows.length - 1) {
                                                                const newRows = arrayMove(rows, currentIndex, currentIndex + 1);
                                                                setRows(newRows);
                                                            }
                                                        }}
                                                        onEdit={(row) => {
                                                            const newName = prompt('Enter new name for ' + row.name + ':');
                                                            if (newName && newName.trim() !== '') {
                                                                setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: newName.trim() } : r));
                                                            }
                                                        }}
                                                        onClear={(id) => {
                                                            setImages(prev => prev.map(img =>
                                                                img.containerId === id
                                                                    ? { ...img, containerId: 'image-pool' }
                                                                    : img
                                                            ));
                                                        }}
                                                        onDelete={(id) => {
                                                            setImages(prev => prev.map(img =>
                                                                img.containerId === id
                                                                    ? { ...img, containerId: 'image-pool' }
                                                                    : img
                                                            ));
                                                            setRows(prev => prev.filter(r => r.id !== id));
                                                        }}
                                                        isFirstRow={idx === 0}
                                                    />
                                                    <Droppable id={row.id}>
                                                        <div className="tier-content">
                                                            <SortableContext
                                                                items={images.filter(img => img.containerId === row.id).map(img => img.id)}
                                                                strategy={rectSortingStrategy}
                                                            >
                                                                {images.filter(img => img.containerId === row.id).map((image) => (
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
                                    </Box>
                                    <Box sx={{
                                        width: '100%',
                                        mt: 3,
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: '16px',
                                        p: 2
                                    }}>
                                        <Typography variant="h6" sx={{
                                            color: 'white',
                                            mb: 2,
                                            pl: 2,
                                            fontWeight: 'bold'
                                        }}>
                                            Pool Member
                                        </Typography>
                                        <Box sx={{ px: 2, mb: 2 }}>
                                            <TextField
                                                fullWidth
                                                placeholder="Search member by name or generation..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Search sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        color: 'white',
                                                        '& fieldset': {
                                                            borderColor: 'rgba(255, 255, 255, 0.23)',
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: 'rgba(255, 255, 255, 0.4)',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#4CAF50',
                                                        },
                                                    },
                                                    '& .MuiInputBase-input::placeholder': {
                                                        color: 'rgba(255, 255, 255, 0.5)',
                                                        opacity: 1,
                                                    },
                                                }}
                                            />
                                        </Box>
                                        <Droppable id="image-pool">
                                            <div className="image-pool">
                                                <SortableContext
                                                    items={(searchTerm ? filteredImages : images)
                                                        .filter(img => img.containerId === 'image-pool')
                                                        .map(img => img.id)}
                                                    strategy={rectSortingStrategy}
                                                >
                                                    {(searchTerm ? filteredImages : images)
                                                        .filter(img => img.containerId === 'image-pool')
                                                        .map((image) => (
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
                                    </Box>
                                    <DragOverlay>
                                        {activeId && isDragMode ? (
                                            <DraggableImage
                                                image={images.find(img => img.id === activeId)}
                                                dragOverlay
                                                isDragMode={isDragMode}
                                            />
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            </Box>
                        </>
                    )}
                    {step === 2 && (
                        <Paper sx={{ p: 2, background: 'rgba(26,26,46,0.95)', color: 'white', borderRadius: 2 }}>
                            <Box sx={{
                                mb: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                flexWrap: 'wrap'
                            }}>
                                <Box sx={{ flex: 1, minWidth: '200px' }}>
                                    <TextField
                                        fullWidth
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter title..."
                                        variant="standard"
                                        sx={{
                                            input: { color: 'white', fontSize: '1.5rem' },
                                            '& .MuiInput-underline:before': {
                                                borderBottomColor: 'rgba(255, 255, 255, 0.42)',
                                            },
                                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
                                                borderBottomColor: 'rgba(255, 255, 255, 0.87)',
                                            },
                                            '& .MuiInput-underline:after': {
                                                borderBottomColor: '#4CAF50',
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<Save />}
                                        onClick={handleSave}
                                        sx={{
                                            bgcolor: '#4CAF50',
                                            '&:hover': {
                                                bgcolor: '#45a049'
                                            }
                                        }}
                                    >
                                        Save Image
                                    </Button>
                                </Box>
                            </Box>
                            <div ref={tierlistRef} style={{
                                backgroundColor: '#1a1a2e',
                                padding: '20px',
                                borderRadius: '8px'
                            }}>
                                <Typography variant="h6" sx={{
                                    color: 'white',
                                    textAlign: 'center',
                                    mb: 2,
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold'
                                }}>
                                    {title || 'Dream Setlist JKT48'}
                                </Typography>
                                <table className="dreamsetlist-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Judul Lagu</th>
                                            <th>{rows.find(row => row.id === 'inti')?.name || 'Tim Inti'} </th>
                                            <th>{rows.find(row => row.id === 'backup')?.name || 'Tim Backup'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {songTable.map((row, idx) => (
                                            <tr key={row.no}>
                                                <td>{row.no}</td>
                                                <td>
                                                    <Autocomplete
                                                        value={dreamSetlistSongs.find(song => song.id === row.song) || null}
                                                        onChange={(event, newValue) => handleSongChange(idx, newValue?.id || '')}
                                                        options={dreamSetlistSongs}
                                                        getOptionLabel={(option) => option.title}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                variant="standard"
                                                                placeholder="Pilih Lagu"
                                                                sx={{
                                                                    minWidth: 200,
                                                                    '& .MuiInputBase-root': {
                                                                        color: 'white',
                                                                        '&:before': {
                                                                            borderBottomColor: 'rgba(255, 255, 255, 0.42)',
                                                                        },
                                                                        '&:hover:not(.Mui-disabled):before': {
                                                                            borderBottomColor: 'rgba(255, 255, 255, 0.87)',
                                                                        },
                                                                        '&.Mui-focused:after': {
                                                                            borderBottomColor: '#4CAF50',
                                                                        }
                                                                    },
                                                                    '& .MuiAutocomplete-endAdornment': {
                                                                        '& .MuiSvgIcon-root': {
                                                                            color: 'rgba(255, 255, 255, 0.54)',
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                        sx={{
                                                            '& .MuiAutocomplete-listbox': {
                                                                backgroundColor: '#2a2a3e',
                                                                color: 'white',
                                                            },
                                                            '& .MuiAutocomplete-option': {
                                                                '&:hover': {
                                                                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                                                },
                                                                '&.Mui-focused': {
                                                                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td
                                                    onClick={() => handleSongCellClick(idx, false)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        minWidth: 120,
                                                        padding: '8px',
                                                        verticalAlign: 'top'
                                                    }}
                                                    id={`songcell-${idx}`}
                                                >
                                                    <div className="member-grid" style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                                                        gap: '12px',
                                                        minHeight: '80px',
                                                        padding: '4px'
                                                    }}>
                                                        {row.members.length > 0 ? (
                                                            row.members.map(member => (
                                                                <div
                                                                    key={member.id}
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        aspectRatio: '1/1.2' // Account for name below image
                                                                    }}
                                                                >
                                                                    <DraggableImage
                                                                        image={member}
                                                                        isDragMode={false}
                                                                        onContextMenu={(e) => handleSongTableMemberRightClick(e, idx, member.id, false)}
                                                                        isInTable={true}
                                                                    />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span style={{
                                                                color: '#aaa',
                                                                gridColumn: '1/-1',
                                                                alignSelf: 'center',
                                                                textAlign: 'center',
                                                                padding: '8px'
                                                            }}>
                                                                Pilih Member
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td
                                                    onClick={() => handleSongCellClick(idx, true)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        minWidth: 120,
                                                        padding: '8px',
                                                        verticalAlign: 'top'
                                                    }}
                                                    id={`backupcell-${idx}`}
                                                >
                                                    <div className="member-grid" style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                                                        gap: '12px',
                                                        minHeight: '80px',
                                                        padding: '4px'
                                                    }}>
                                                        {row.backupMembers.length > 0 ? (
                                                            row.backupMembers.map(member => (
                                                                <div
                                                                    key={member.id}
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        aspectRatio: '1/1.2' // Account for name below image
                                                                    }}
                                                                >
                                                                    <DraggableImage
                                                                        image={member}
                                                                        isDragMode={false}
                                                                        onContextMenu={(e) => handleSongTableMemberRightClick(e, idx, member.id, true)}
                                                                        isInTable={true}
                                                                    />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span style={{
                                                                color: '#aaa',
                                                                gridColumn: '1/-1',
                                                                alignSelf: 'center',
                                                                textAlign: 'center',
                                                                padding: '8px'
                                                            }}>
                                                                Pilih Member
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="image-pool-container" style={{ marginTop: '20px' }}>
                                {rows.map(row => (
                                    <div key={row.id} style={{ marginBottom: '20px' }}>
                                        <Typography variant="h6" color="white" sx={{ mb: 1 }}>{row.name}</Typography>
                                        <div className="image-pool" style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            padding: '12px'
                                        }}>
                                            {images.filter(image => image.containerId === row.id).map(image => (
                                                <DraggableImage
                                                    key={image.id}
                                                    image={image}
                                                    isDragging={false}
                                                    onImageClick={handleImageClick}
                                                    isSelected={selectedImage?.id === image.id}
                                                    isDragMode={false}
                                                    isInTable={false}
                                                />
                                            ))}
                                            {images.filter(image => image.containerId === row.id).length === 0 && (
                                                <Typography variant="body2" color="rgba(255,255,255,0.5)" sx={{ p: 2, textAlign: 'center' }}>
                                                    No members in {row.name}
                                                </Typography>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Paper>
                    )}
                </div>
            </div>
        </>
    );
};

export default DreamSetlist;