import React, { useState } from 'react';
import { useDroppable, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import {
    Settings,
    ArrowUpward,
    ArrowDownward,
    Edit,
    Delete,
} from '@mui/icons-material';

// ─── Tier color palette ────────────────────────────────────────────────────────
export const TIER_COLORS = [
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

// ─── Initial tier row definitions ──────────────────────────────────────────────
export const initialRows = [
    { id: 'S', name: 'S Tier', color: '#FF7F7F' },
    { id: 'A', name: 'A Tier', color: '#FFBF7F' },
    { id: 'B', name: 'B Tier', color: '#FFDF7F' },
    { id: 'C', name: 'C Tier', color: '#FFFF7F' },
    { id: 'D', name: 'D Tier', color: '#7FFF7F' }
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns '#000000' or '#FFFFFF' for maximum contrast against the given hex bg color. */
export const getContrastColor = (hexcolor) => {
    const r = parseInt(hexcolor.substr(1, 2), 16);
    const g = parseInt(hexcolor.substr(3, 2), 16);
    const b = parseInt(hexcolor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

/** Converts a setlist filename like "Aturan_Anti_Cinta.jpg" → "Aturan Anti Cinta". */
export const formatSetlistName = (filename) =>
    filename.split('.')[0].split('_').join(' ');

/** Cleans up SPV/MV filenames into human-readable titles. */
export const formatVideoName = (filename) => {
    let name = filename.split('.')[0];
    name = name.replace(/^_New_Era_Special_Performance_Video[_–]?/, '');
    name = name.replace(/^360°_VR_＂/, '');
    name = name.replace(/＂$/, '');
    name = name.replace(/_/g, ' ');
    name = name.replace(/\s*\([^)]*\)$/, '');
    return name;
};

// ─── DnD drop animation config ─────────────────────────────────────────────────
export const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: '0.5' } },
    }),
};

// ─── Droppable wrapper ─────────────────────────────────────────────────────────
export const Droppable = ({ id, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
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

// ─── TierRow ───────────────────────────────────────────────────────────────────
/**
 * Renders the coloured header for a tier row with a settings context menu.
 * Accepts an optional `children` prop (used by Tierlist_Lagu to embed controls
 * inside the header).
 */
export const TierRow = ({ row, onMove, onEdit, onClear, onDelete, isFirstRow, children }) => {
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
