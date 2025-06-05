import React, { useState, useEffect, useRef } from 'react';
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
    mvFiles,
    spvFiles
} from './data/spv_mv';
import {
    setlistFiles,
    ssRamadanFiles
} from './data/specialshowData';

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

// Helper function to properly capitalize member names
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
    // Convert the setlist name to the image filename format
    const imageFilename = selectedSetlist.replace(/ /g, '_');

    return (
        <div
            className={`song-image ${isDragging ? 'dragging' : ''} ${dragOverlay ? 'overlay' : ''}`}
            style={style}
            onClick={() => !isDragMode && onImageClick && onImageClick(song)}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, song)}
        >
            <img 
                src={`/asset/Setlist/${imageFilename}.jpg`} 
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

    return (
        <div 
            className="row-header" 
            style={{ 
                backgroundColor: row.color,
                borderTopLeftRadius: isFirstRow ? '8px' : '0',
                borderTopRightRadius: '0'
            }}
        >
            <span style={{ color: textColor }}>{row.name}</span>
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
        const songList = setlistSongs[setlistName];
        
        if (songList) {
            const songs = songList.map((songName, index) => ({
                id: `song-${index}`,
                name: songName,
                containerId: 'image-pool',
                originalIndex: index
            }));
            setSongs(songs);
        }
    }, []);

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
        if (!isDragMode) return;  // Add this line to prevent drag in click mode
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        const overId = over.id;
        
        if (rows.find(row => row.id === overId) || overId === 'image-pool') {
            setSongs(prev => {
                const activeImage = prev.find(img => img.id === active.id);
                const overContainer = overId;
                
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
                id: `song-${index}`,
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
            // Get the dimensions from the original tier rows
            const rowsContainer = tierlistRef.current.querySelector('.tier-rows-container');
            if (!rowsContainer) return;

            // Get the width of the actual content area (including the drop area)
            const firstRow = rowsContainer.querySelector('.tier-row');
            if (!firstRow) return;
            const rowWidth = firstRow.offsetWidth;

            // Create a temporary container for the title and tierlist
            const tempContainer = document.createElement('div');
            tempContainer.style.backgroundColor = '#1a1a2e';
            tempContainer.style.padding = '10px 20px';  // Reduced padding
            tempContainer.style.display = 'flex';
            tempContainer.style.flexDirection = 'column';
            tempContainer.style.alignItems = 'flex-start';

            // Add the title if it exists
            if (tierlistTitle) {
                const titleContainer = document.createElement('div');
                titleContainer.style.width = `${rowWidth}px`;
                titleContainer.style.display = 'flex';
                titleContainer.style.justifyContent = 'center';
                titleContainer.style.marginBottom = '5px';
                titleContainer.style.marginTop = '0';  // Removed top margin
                titleContainer.style.padding = '0';

                const titleDiv = document.createElement('div');
                titleDiv.style.color = 'white';
                titleDiv.style.fontSize = '32px';
                titleDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
                titleDiv.style.whiteSpace = 'nowrap';
                titleDiv.textContent = tierlistTitle;
                titleDiv.style.textAlign = 'center';

                titleContainer.appendChild(titleDiv);
                tempContainer.appendChild(titleContainer);
            }

            // Clone and prepare the tierlist
            const tierlistClone = rowsContainer.cloneNode(true);
            
            // Remove any buttons and icons
            const elementsToRemove = tierlistClone.querySelectorAll('button, .MuiSvgIcon-root, .tierlist-title-container');
            elementsToRemove.forEach(el => el.remove());

            // Set the width of the container and tierlist
            tempContainer.style.width = `${rowWidth}px`;
            tierlistClone.style.width = '100%';
            tierlistClone.style.marginTop = '0';  // Ensure no extra margin at the top of the tierlist

            // Make sure each row maintains its width
            const rows = tierlistClone.querySelectorAll('.tier-row');
            rows.forEach(row => {
                row.style.width = '100%';
                row.style.marginTop = '0';  // Ensure no margins between rows
                // Make sure the droppable area takes full width
                const droppable = row.querySelector('.droppable');
                if (droppable) {
                    droppable.style.width = '100%';
                }
                // Make sure the tier content area takes full width
                const tierContent = row.querySelector('.tier-content');
                if (tierContent) {
                    tierContent.style.width = '100%';
                }
            });

            // Add the tierlist to the container
            tempContainer.appendChild(tierlistClone);
            
            // Add to document temporarily for rendering
            document.body.appendChild(tempContainer);

            const options = {
                quality: 1.0,
                bgcolor: '#1a1a2e',
                style: {
                    'background-color': '#1a1a2e'
                }
            };

            try {
                const dataUrl = await domtoimage.toPng(tempContainer, options);
                const link = document.createElement('a');
                link.download = 'jkt48-tierlist.png';
                link.href = dataUrl;
                link.click();
            } catch (pngError) {
                console.warn('PNG generation failed, trying blob...', pngError);
                const blob = await domtoimage.toBlob(tempContainer, options);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'jkt48-tierlist.png';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }

            // Clean up
            document.body.removeChild(tempContainer);
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

    return (
        <div className="tierlist-page">
            <header className="header">
                <IconButton 
                    className="back-button"
                    onClick={() => navigate('/')}
                    size="large"
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

                    <div className="button-container">
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