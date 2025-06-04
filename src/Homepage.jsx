import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';
import logo from './assets/icon/TierlistIcon.png';
import { setlistSongs } from './data/setlistSongs';

const Homepage = () => {
    const [tierlistType, setTierlistType] = useState('');
    const [selectedMemberType, setSelectedMemberType] = useState('active');
    const [selectedGeneration, setSelectedGeneration] = useState('all');
    const [selectedVideoType, setSelectedVideoType] = useState('all');
    const [selectedSetlist, setSelectedSetlist] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const navigate = useNavigate();

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

    const handleStart = () => {
        if (!tierlistType) {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 3000);
            return;
        }

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
            {showPopup && (
                <div className="popup-message">
                    {!tierlistType ? "Please select a tierlist type first!" : "Please select a setlist first!"}
                </div>
            )}
            <img src={logo} alt="JKT48 Tierlist Logo" className="app-logo" />
            <h1 className="title">JKT48 Tierlist</h1>
            <div className="dropdown-container">
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
                        {Array.from({ length: 13 }, (_, i) => i + 1).map(gen => (
                            <option key={gen} value={`gen${gen}`}>Generation {gen}</option>
                        ))}
                        <option value="genv1">JKT48V Gen 1</option>
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