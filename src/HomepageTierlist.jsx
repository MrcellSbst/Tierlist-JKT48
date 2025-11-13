import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomepageTierlist.css';
import logo from './assets/icon/TierlistIcon.png';
import { setlistSongs } from './data/setlistSongs';
import { formatDistanceToNow } from 'date-fns';

const Homepage = () => {
    const [tierlistType, setTierlistType] = useState('');
    const [selectedMemberType, setSelectedMemberType] = useState('active');
    const [selectedGeneration, setSelectedGeneration] = useState('all');
    const [selectedVideoType, setSelectedVideoType] = useState('all');
    const [selectedSetlist, setSelectedSetlist] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [drafts, setDrafts] = useState([]);
    const navigate = useNavigate();

    // Configure how many standard and JKT48V generations to show in dropdowns
    const STANDARD_GEN_COUNT = 13; // Gen1..Gen13
    const V_GEN_COUNT = 2;         // JKT48V Gen1..GenV_COUNT

    useEffect(() => {
        // Reset viewport meta tag
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
        } else {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
            document.head.appendChild(meta);
        }
    }, []);

    // Load available drafts when tierlist type changes
    useEffect(() => {
        if (!tierlistType) {
            setDrafts([]);
            return;
        }

        const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        
        // Filter drafts based on tierlist type and sort by date
        const relevantDrafts = [...manualDrafts, ...autoDrafts]
            .filter(draft => draft.type === tierlistType)
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        setDrafts(relevantDrafts);
    }, [tierlistType]);

    const handleTierlistTypeChange = (event) => {
        setTierlistType(event.target.value);
        // Reset video type when changing tierlist type
        if (event.target.value !== 'video') {
            setSelectedVideoType('all');
        }
        // Reset setlist selection when changing tierlist type
        if (event.target.value !== 'setlist_song') {
            setSelectedSetlist('');
        }
    };

    const handleMemberTypeChange = (event) => {
        setSelectedMemberType(event.target.value);
    };

    const handleGenerationChange = (event) => {
        setSelectedGeneration(event.target.value);
    };

    const handleVideoTypeChange = (event) => {
        setSelectedVideoType(event.target.value);
    };

    const handleSetlistChange = (event) => {
        setSelectedSetlist(event.target.value);
    };

    const handleDraftSelect = (event) => {
        const draftId = event.target.value;
        if (!draftId) return;

        console.log('Selected draft ID:', draftId);

        // Store the selected draft ID
        localStorage.setItem('currentDraftId', draftId);
        console.log('Stored draft ID in localStorage:', localStorage.getItem('currentDraftId'));

        // Get the draft details
        const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        const allDrafts = [...manualDrafts, ...autoDrafts];
        const draft = allDrafts.find(d => d.id.toString() === draftId);
        console.log('Found draft:', draft);

        // Navigate to the appropriate tierlist page
        if (draft.type === 'song') {
            localStorage.setItem('selectedSetlist', draft.setlist);
            navigate('/tierlist_lagu');
        } else {
            localStorage.setItem('tierlistType', draft.type);
            navigate('/tierlist');
        }
    };

    const handleStart = () => {
        if (!tierlistType) {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 3000);
            return;
        }

        // Just clear current draft ID to ensure fresh start
        // but don't clear saved drafts!
        localStorage.removeItem('currentDraftId');

        if (tierlistType === 'setlist' || tierlistType === 'ramadan') {
            localStorage.setItem('tierlistType', tierlistType);
            navigate('/tierlist');
        } else if (tierlistType === 'video') {
            localStorage.setItem('tierlistType', 'video');
            localStorage.setItem('videoType', selectedVideoType);
            navigate('/tierlist');
        } else if (tierlistType === 'setlist_song') {
            if (!selectedSetlist) {
                setShowPopup(true);
                setTimeout(() => setShowPopup(false), 3000);
                return;
            }
            localStorage.setItem('tierlistType', 'setlist_song');
            localStorage.setItem('selectedSetlist', selectedSetlist);
            navigate('/tierlist_lagu');
        } else {
            localStorage.setItem('tierlistType', 'member');
            localStorage.setItem('memberType', selectedMemberType);
            localStorage.setItem('generation', selectedGeneration);
            navigate('/tierlist');
        }
    };

    return (
        <div className="homepage-container">
            <button 
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    backgroundColor: '#E50014',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    transition: 'all 0.3s ease'
                }}
            >
                Back to Homepage
            </button>
            {showPopup && (
                <div className="popup-message">
                    {!tierlistType ? "Please select a tierlist type first!" : "Please select a setlist first!"}
                </div>
            )}
            <img src={logo} alt="JKT48 Tierlist Logo" className="app-logo" />
            <h1 className="title">JKT48 Tierlist</h1>
            <div className="dropdown-container">
                <div className="dropdown-row">
                <select 
                    value={tierlistType} 
                    onChange={handleTierlistTypeChange}
                    className="member-dropdown"
                >
                    <option value="">-- Select Tierlist Type --</option>
                    <option value="member">Member Tierlist</option>
                    <option value="setlist">Setlist Tierlist</option>
                    <option value="ramadan">Special Show Ramadan</option>
                    <option value="video">SPV and MV</option>
                    <option value="setlist_song">Setlist's Song</option>
                </select>

                    {drafts.length > 0 && (
                        <select
                            onChange={handleDraftSelect}
                            className="draft-dropdown"
                            defaultValue=""
                            style={{
                                backgroundColor: 'white',
                                color: 'black',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid rgba(0, 0, 0, 0.23)',
                                fontSize: '16px'
                            }}
                        >
                            <option value="">-- Load Draft --</option>
                            {drafts.map(draft => {
                                const timeAgo = formatDistanceToNow(new Date(draft.savedAt), { addSuffix: true });
                                const shortTimeAgo = timeAgo
                                    .replace(' minutes', 'm')
                                    .replace(' minute', 'm')
                                    .replace(' hours', 'h')
                                    .replace(' hour', 'h')
                                    .replace(' days', 'd')
                                    .replace(' day', 'd')
                                    .replace(' ago', '')
                                    .replace('about ', '');
                                
                                const draftName = draft.title || 'Untitled';
                                const displayName = draft.isAutoSave ? `${draftName} (AutoSaved)` : draftName;
                                
                                return (
                                    <option 
                                        key={draft.id} 
                                        value={draft.id}
                                        style={{
                                            backgroundColor: 'white',
                                            color: 'black'
                                        }}
                                    >
                                        {displayName} • {draft.completion}% • {shortTimeAgo}
                                    </option>
                                );
                            })}
                        </select>
                    )}
                </div>

                {/* Video type dropdown */}
                <div className={`member-dropdowns-container ${tierlistType === 'video' ? 'show' : ''}`}>
                    <select 
                        value={selectedVideoType} 
                        onChange={handleVideoTypeChange}
                        className="member-dropdown"
                    >
                        <option value="all">SPV and MV</option>
                        <option value="mv">MV</option>
                        <option value="spv">SPV</option>
                    </select>
                </div>

                {/* Setlist selection dropdown */}
                <div className={`member-dropdowns-container ${tierlistType === 'setlist_song' ? 'show' : ''}`}>
                    <select 
                        value={selectedSetlist} 
                        onChange={handleSetlistChange}
                        className="member-dropdown"
                    >
                        <option value="">-- Select Setlist --</option>
                        {Object.keys(setlistSongs).map(setlist => (
                            <option key={setlist} value={setlist}>{setlist}</option>
                        ))}
                    </select>
                </div>

                {/* Member type dropdowns */}
                <div className={`member-dropdowns-container ${tierlistType === 'member' ? 'show' : ''}`}>
                    <select 
                        value={selectedMemberType} 
                        onChange={handleMemberTypeChange}
                        className="member-dropdown"
                    >
                        <option value="active">Active Member</option>
                        <option value="ex">Ex Member</option>
                        <option value="all">All Member</option>
                    </select>
                    <select 
                        value={selectedGeneration} 
                        onChange={handleGenerationChange}
                        className="member-dropdown"
                    >
                        <option value="all">All Generations</option>
                        {Array.from({ length: STANDARD_GEN_COUNT }, (_, i) => i + 1).map(gen => (
                            <option key={`std-${gen}`} value={`gen${gen}`}>Generation {gen}</option>
                        ))}
                        {Array.from({ length: V_GEN_COUNT }, (_, i) => i + 1).map(vgen => (
                            <option key={`v-${vgen}`} value={`genv${vgen}`}>JKT48V Gen {vgen}</option>
                        ))}
                    </select>
                </div>

                <button 
                    onClick={handleStart}
                    className="start-button"
                >
                    Start Making Tierlist
                </button>
            </div>
        </div>
    );
};

export default Homepage; 
