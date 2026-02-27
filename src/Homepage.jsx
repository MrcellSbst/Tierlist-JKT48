import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';
import homepageLogo from '/asset/icon/HomepageLogo.png';
import tierlistLogo from './assets/icon/TierlistIcon.png';
import { setlistSongs } from './data/setlistSongs';
import { formatDistanceToNow } from 'date-fns';

// ── Landing page ───────────────────────────────────────────────────────────────
const Homepage = () => {
    const navigate = useNavigate();

    useEffect(() => {
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

    return (
        <div className="homepage-container">
            <img src={homepageLogo} alt="JKT48 Fan Tools Logo" className="app-logo" />
            <h1 className="title">MY JKT48 TIERLIST</h1>
            <div className="nav-buttons-container landing">
                <button className="nav-button" onClick={() => navigate('/homepagetierlist')}>
                    Tierlist Maker
                </button>
                <button className="nav-button" onClick={() => navigate('/dream-setlist')}>
                    Dream Setlist
                </button>
                <button className="nav-button" onClick={() => navigate('/roulette')}>
                    Member Roulette
                </button>
            </div>
        </div>
    );
};

// ── Tierlist type selector ─────────────────────────────────────────────────────
const HomepageTierlist = () => {
    const [tierlistType, setTierlistType] = useState('');
    const [selectedMemberType, setSelectedMemberType] = useState('active');
    const [selectedGeneration, setSelectedGeneration] = useState('all');
    const [selectedVideoType, setSelectedVideoType] = useState('all');
    const [selectedSetlist, setSelectedSetlist] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [drafts, setDrafts] = useState([]);
    const navigate = useNavigate();

    const hasSecondary =
        tierlistType === 'member' ||
        tierlistType === 'video' ||
        tierlistType === 'setlist_song';
    const secondaryHeight =
        tierlistType === 'member' ? 110 :
            tierlistType === 'video' || tierlistType === 'setlist_song' ? 60 : 0;

    const STANDARD_GEN_COUNT = 13;
    const V_GEN_COUNT = 2;

    useEffect(() => {
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

    useEffect(() => {
        if (!tierlistType) { setDrafts([]); return; }
        const manualDrafts = JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]');
        const autoDrafts = JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]');
        const relevantDrafts = [...manualDrafts, ...autoDrafts]
            .filter(draft => draft.type === tierlistType)
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        setDrafts(relevantDrafts);
    }, [tierlistType]);

    const handleTierlistTypeChange = (event) => {
        setTierlistType(event.target.value);
        if (event.target.value !== 'video') setSelectedVideoType('all');
        if (event.target.value !== 'setlist_song') setSelectedSetlist('');
    };

    const handleDraftSelect = (event) => {
        const draftId = event.target.value;
        if (!draftId) return;
        localStorage.setItem('currentDraftId', draftId);
        const allDrafts = [
            ...JSON.parse(localStorage.getItem('tierlistManualDrafts') || '[]'),
            ...JSON.parse(localStorage.getItem('tierlistAutoSaveDrafts') || '[]'),
        ];
        const draft = allDrafts.find(d => d.id.toString() === draftId);
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

    const selectStyle = {
        backgroundColor: 'white',
        color: 'black',
        border: '2px solid #E50014',
        borderRadius: '10px',
        padding: '12px 20px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        minWidth: '200px',
        width: '100%',
    };

    return (
        <div className="homepage-container">
            <button onClick={() => navigate('/')} className="back-button">
                ← Back to Homepage
            </button>

            {showPopup && (
                <div className="popup-message">
                    {!tierlistType ? 'Please select a tierlist type first!' : 'Please select a setlist first!'}
                </div>
            )}

            <img src={tierlistLogo} alt="JKT48 Tierlist Logo" className="app-logo" />
            <h1 className="title">JKT48 Tierlist</h1>

            <div className="nav-buttons-container">
                <select value={tierlistType} onChange={handleTierlistTypeChange} className="nav-button" style={selectStyle}>
                    <option value="">-- Select Tierlist Type --</option>
                    <option value="member">Member Tierlist</option>
                    <option value="setlist">Setlist Tierlist</option>
                    <option value="ramadan">Special Show Ramadan</option>
                    <option value="video">SPV and MV</option>
                    <option value="setlist_song">Setlist's Song</option>
                </select>

                {drafts.length > 0 && (
                    <select onChange={handleDraftSelect} className="nav-button" defaultValue="" style={selectStyle}>
                        <option value="">-- Load Draft --</option>
                        {drafts.map(draft => {
                            const timeAgo = formatDistanceToNow(new Date(draft.savedAt), { addSuffix: true })
                                .replace(' minutes', 'm').replace(' minute', 'm')
                                .replace(' hours', 'h').replace(' hour', 'h')
                                .replace(' days', 'd').replace(' day', 'd')
                                .replace(' ago', '').replace('about ', '');
                            const draftName = draft.title || 'Untitled';
                            const displayName = draft.isAutoSave ? `${draftName} (AutoSaved)` : draftName;
                            return (
                                <option key={draft.id} value={draft.id} style={{ backgroundColor: 'white', color: 'black' }}>
                                    {displayName} • {draft.completion}% • {timeAgo}
                                </option>
                            );
                        })}
                    </select>
                )}

                <div className={`secondary-slot ${hasSecondary ? 'has-secondary' : ''}`} style={{ minHeight: secondaryHeight }}>
                    {tierlistType === 'video' && (
                        <div className="member-dropdowns-container show">
                            <select value={selectedVideoType} onChange={e => setSelectedVideoType(e.target.value)} className="nav-button" style={selectStyle}>
                                <option value="all">SPV and MV</option>
                                <option value="mv">MV</option>
                                <option value="spv">SPV</option>
                            </select>
                        </div>
                    )}

                    {tierlistType === 'setlist_song' && (
                        <div className="member-dropdowns-container show">
                            <select value={selectedSetlist} onChange={e => setSelectedSetlist(e.target.value)} className="nav-button" style={selectStyle}>
                                <option value="">-- Select Setlist --</option>
                                {Object.keys(setlistSongs).map(setlist => (
                                    <option key={setlist} value={setlist}>{setlist}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {tierlistType === 'member' && (
                        <div className="member-dropdowns-container show">
                            <select value={selectedMemberType} onChange={e => setSelectedMemberType(e.target.value)} className="nav-button" style={selectStyle}>
                                <option value="active">Active Member</option>
                                <option value="ex">Ex Member</option>
                                <option value="all">All Member</option>
                            </select>
                            <select value={selectedGeneration} onChange={e => setSelectedGeneration(e.target.value)} className="nav-button" style={selectStyle}>
                                <option value="all">All Generations</option>
                                {Array.from({ length: STANDARD_GEN_COUNT }, (_, i) => i + 1).map(gen => (
                                    <option key={`std-${gen}`} value={`gen${gen}`}>Generation {gen}</option>
                                ))}
                                <option value="genvall">All Virtual Generations</option>
                                {Array.from({ length: V_GEN_COUNT }, (_, i) => i + 1).map(vgen => (
                                    <option key={`v-${vgen}`} value={`genv${vgen}`}>JKT48V Gen {vgen}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <button onClick={handleStart} className="nav-button" style={{
                    backgroundColor: '#E50014', color: 'white', border: 'none',
                    padding: '12px 20px', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: 'bold', fontSize: '16px', minWidth: '200px', width: '100%',
                }}>
                    Start Making Tierlist
                </button>
            </div>
        </div>
    );
};

export { HomepageTierlist };
export default Homepage;
