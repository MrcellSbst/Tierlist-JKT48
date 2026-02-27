import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { activeMemberFiles, exMemberFiles, tim_love, tim_dream, tim_passion } from './data/memberData';
import './roulette.css';


// ─── Constants ───────────────────────────────────────────────────────────────
const STANDARD_GEN_COUNT = 13;
const V_GEN_COUNT = 2;

const SEGMENT_COLORS = [
    '#E50014', '#C8003D', '#FF4D6D', '#FF006E',
    '#8338EC', '#3A86FF', '#06D6A0', '#FFB703',
    '#FB8500', '#E63946', '#457B9D', '#2DC653',
    '#9B2226', '#AE2012', '#CA6702', '#BB3E03',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatMemberName = (filename) => {
    if (!filename || typeof filename !== 'string') return '';
    const baseName = filename.split('/').pop().split('.')[0];
    const parts = baseName.split('_').filter(Boolean);
    const firstPart = parts[0] || '';
    if (/^jkt48vgen\d+$/i.test(firstPart)) {
        return parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    if (firstPart && firstPart.toUpperCase() === 'JKT48V') {
        const rest = parts.slice(1);
        const afterGen = rest[0]?.toLowerCase().startsWith('gen') ? rest.slice(1) : rest;
        return afterGen.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    if (parts[0] && parts[0].toLowerCase().startsWith('gen')) {
        return parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const TEAM_MAP = {
    team_love: tim_love,
    team_dream: tim_dream,
    team_passion: tim_passion,
};

const matchesGeneration = (filename, generation) => {
    if (generation === 'all') return true;
    const baseFilename = filename.includes('/') ? filename.split('/').pop() : filename;
    // Team filter
    if (generation.startsWith('team_')) {
        const teamList = TEAM_MAP[generation];
        return teamList ? teamList.includes(baseFilename) : false;
    }
    if (generation === 'genvall') {
        return /^JKT48VGen\d+_/i.test(baseFilename) || /^JKT48V_Gen\d+_/i.test(baseFilename);
    }
    if (generation.toLowerCase().startsWith('genv')) {
        const vGenNumber = generation.slice(4);
        return baseFilename.startsWith(`JKT48V_Gen${vGenNumber}_`) || baseFilename.startsWith(`JKT48VGen${vGenNumber}_`);
    }
    if (generation.toLowerCase().startsWith('gen')) {
        const prefix = `Gen${generation.slice(3)}_`;
        return baseFilename.startsWith(prefix);
    }
    return true;
};

// Cryptographically-random integer in [0, max)
const cryptoRandInt = (max) => {
    if (max <= 0) return 0;
    const arr = new Uint32Array(1);
    let result;
    do {
        crypto.getRandomValues(arr);
        result = arr[0] % max;
    } while (arr[0] - result + (max - 1) >= 0x100000000); // rejection sampling to avoid bias
    return result;
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
const ConfettiCanvas = ({ active }) => {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const particlesRef = useRef([]);
    const drainingRef = useRef(false);
    const [visible, setVisible] = useState(false);

    // Cancel on unmount only
    useEffect(() => {
        return () => cancelAnimationFrame(animRef.current);
    }, []);

    useEffect(() => {
        if (active) {
            // Cancel any lingering frame, reset drain flag
            cancelAnimationFrame(animRef.current);
            drainingRef.current = false;
            setVisible(true);

            const canvas = canvasRef.current;
            if (!canvas) return;

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');

            const onResize = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            };
            window.addEventListener('resize', onResize);

            const colors = ['#E50014', '#FFB703', '#06D6A0', '#8338EC', '#3A86FF', '#FF006E', '#FB8500', '#FFFFFF'];
            particlesRef.current = Array.from({ length: 180 }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                r: Math.random() * 7 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: Math.random() * 3 + 2,
                angle: Math.random() * 360,
                spin: (Math.random() - 0.5) * 6,
                wobble: Math.random() * 10,
                wobbleSpeed: Math.random() * 0.05 + 0.02,
                wobbleOffset: Math.random() * Math.PI * 2,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
            }));

            let frame = 0;
            const draw = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                frame++;

                particlesRef.current = particlesRef.current
                    .map(p => {
                        const newY = p.y + p.speed;
                        const newAngle = p.angle + p.spin;
                        const wobbleX = p.x + Math.sin(frame * p.wobbleSpeed + p.wobbleOffset) * p.wobble;

                        // Wider fade zone when draining so pieces dissolve before exiting
                        const fadeStart = drainingRef.current ? canvas.height * 0.35 : canvas.height * 0.72;
                        const fadeLen = drainingRef.current ? canvas.height * 0.65 : canvas.height * 0.28;
                        const opacity = newY > fadeStart ? Math.max(0, 1 - (newY - fadeStart) / fadeLen) : 1;

                        ctx.save();
                        ctx.globalAlpha = opacity;
                        ctx.translate(wobbleX, newY);
                        ctx.rotate((newAngle * Math.PI) / 180);
                        ctx.fillStyle = p.color;
                        if (p.shape === 'rect') {
                            ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
                        } else {
                            ctx.beginPath();
                            ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.restore();

                        if (drainingRef.current) {
                            // Don't recycle — remove once fully off-screen
                            return newY > canvas.height + p.r ? null : { ...p, y: newY, angle: newAngle };
                        }
                        // Normal mode: recycle at top
                        return { ...p, y: newY > canvas.height ? -p.r : newY, angle: newAngle };
                    })
                    .filter(Boolean);

                // Self-terminate when drain is complete
                if (drainingRef.current && particlesRef.current.length === 0) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    window.removeEventListener('resize', onResize);
                    setVisible(false);
                    return; // stop scheduling frames
                }

                animRef.current = requestAnimationFrame(draw);
            };
            draw();

            // NOTE: no cleanup return here — we intentionally let the loop
            // keep running after active→false so the drain can complete.
            // The unmount effect above handles the final cancel.
            return () => window.removeEventListener('resize', onResize);
        } else {
            // Signal the running loop to drain
            drainingRef.current = true;
        }
    }, [active]);

    return (
        <canvas
            ref={canvasRef}
            className="roulette-confetti-canvas"
            style={{ pointerEvents: 'none', display: visible ? 'block' : 'none' }}
        />
    );
};



// ─── Spinning Wheel ───────────────────────────────────────────────────────────
const RouletteWheelCanvas = ({ entries, spinning, onSpinEnd, targetIndex, spinDuration }) => {
    const canvasRef = useRef(null);
    const animRef = useRef(null);       // spin animation frame
    const idleAnimRef = useRef(null);   // idle animation frame
    const startTimeRef = useRef(null);
    const startAngleRef = useRef(0);
    const currentAngleRef = useRef(0);
    const lastIdleTimeRef = useRef(null);

    const IDLE_SPEED = 0.09; // radians per second (~5°/s)

    const drawWheel = useCallback((angle) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 8;
        const n = entries.length;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (n === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#aaa';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No entries', cx, cy);
            return;
        }

        const sliceAngle = (Math.PI * 2) / n;

        entries.forEach((entry, i) => {
            const startA = angle + i * sliceAngle;
            const endA = startA + sliceAngle;
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

            // Segment fill
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startA, endA);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label — radial orientation, always readable
            const mid = startA + sliceAngle / 2;
            const labelR = radius * 0.60;
            const lx = cx + labelR * Math.cos(mid);
            const ly = cy + labelR * Math.sin(mid);

            ctx.save();
            ctx.translate(lx, ly);
            const isRightHalf = Math.cos(mid) >= 0;
            ctx.rotate(isRightHalf ? mid : mid + Math.PI);

            const maxFontSize = n > 30 ? 14 : n > 20 ? 17 : n > 12 ? 20 : 24;
            let fontSize = maxFontSize;
            const maxWidth = radius * 0.72;
            ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;

            while (ctx.measureText(entry.label).width > maxWidth && fontSize > 8) {
                fontSize--;
                ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
            }

            const label = entry.label.length > 18 ? entry.label.slice(0, 16) + '…' : entry.label;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(label, 0, fontSize / 3);
            ctx.restore();
        });

        // Center circle
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#cccccc');
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [entries]);

    // Easing: ease-out-cubic then end at exact stop
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    // ── Idle rotation loop ──
    useEffect(() => {
        if (spinning) {
            // Pause idle when a spin is in progress
            cancelAnimationFrame(idleAnimRef.current);
            lastIdleTimeRef.current = null;
            return;
        }

        const idleTick = (timestamp) => {
            if (lastIdleTimeRef.current !== null) {
                const dt = (timestamp - lastIdleTimeRef.current) / 1000; // seconds
                currentAngleRef.current += IDLE_SPEED * dt;
                drawWheel(currentAngleRef.current);
            }
            lastIdleTimeRef.current = timestamp;
            idleAnimRef.current = requestAnimationFrame(idleTick);
        };

        lastIdleTimeRef.current = null; // reset so no delta jump on resume
        idleAnimRef.current = requestAnimationFrame(idleTick);

        return () => {
            cancelAnimationFrame(idleAnimRef.current);
            lastIdleTimeRef.current = null;
        };
    }, [spinning, drawWheel]);

    // ── Spin animation ──
    useEffect(() => {
        if (!spinning || entries.length === 0 || targetIndex == null) return;

        // Stop idle first
        cancelAnimationFrame(idleAnimRef.current);

        const sliceAngle = (Math.PI * 2) / entries.length;
        const fullSpins = 8 + cryptoRandInt(5);
        const normalizedTarget = (-Math.PI / 2 - sliceAngle / 2 - targetIndex * sliceAngle + Math.PI * 2 * 100) % (Math.PI * 2);

        const currentNorm = ((currentAngleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const targetNorm = ((normalizedTarget % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let delta = targetNorm - currentNorm;
        if (delta < 0) delta += Math.PI * 2;
        const totalRotation = fullSpins * Math.PI * 2 + delta;
        const finalAngle = currentAngleRef.current + totalRotation;

        startTimeRef.current = null;
        const beginAngle = currentAngleRef.current;

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / spinDuration, 1);
            const eased = easeOutCubic(progress);
            const angle = beginAngle + totalRotation * eased;

            currentAngleRef.current = angle;
            drawWheel(angle);

            if (progress < 1) {
                animRef.current = requestAnimationFrame(animate);
            } else {
                currentAngleRef.current = finalAngle;
                drawWheel(finalAngle);
                onSpinEnd();
            }
        };
        animRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spinning, targetIndex]);

    // Initial draw
    useEffect(() => {
        drawWheel(currentAngleRef.current);
    }, [drawWheel]);

    return (
        <canvas
            ref={canvasRef}
            width={680}
            height={680}
            className="roulette-wheel-canvas"
        />
    );
};


// ─── Custom Roulette Panel ────────────────────────────────────────────────────
const CustomRoulettePanel = ({ id, roulette, onChange, onRemove }) => {
    const handleNameChange = (e) => onChange({ ...roulette, name: e.target.value });
    const handleEntriesChange = (e) => onChange({ ...roulette, rawText: e.target.value });
    const handleRemoveOnPickChange = (e) => onChange({ ...roulette, removeOnPick: e.target.checked });

    const handleFillActive = () => {
        const names = activeMemberFiles.map(f => formatMemberName(f)).filter(Boolean);
        onChange({ ...roulette, rawText: names.join('\n') });
    };

    return (
        <div className="custom-roulette-panel">
            <div className="custom-roulette-header">
                <input
                    className="custom-roulette-name-input"
                    value={roulette.name}
                    onChange={handleNameChange}
                    placeholder="Roulette name…"
                />
                <button className="custom-roulette-remove-btn" onClick={() => onRemove(id)} title="Remove roulette">✕</button>
            </div>
            <button className="custom-roulette-fill-btn" onClick={handleFillActive} title="Replace entries with all active members">
                ＋ Fill with Active Members
            </button>
            <textarea
                className="custom-roulette-textarea"
                value={roulette.rawText}
                onChange={handleEntriesChange}
                placeholder={"Enter one entry per line…\ne.g.\nEntry A\nEntry B\nEntry C"}
                rows={5}
            />
            <div className="custom-roulette-footer">
                <label className="custom-roulette-toggle">
                    <input
                        type="checkbox"
                        checked={!!roulette.removeOnPick}
                        onChange={handleRemoveOnPickChange}
                    />
                    <span>Remove on pick</span>
                </label>
                <span className="custom-roulette-count">
                    {roulette.rawText.split('\n').filter(l => l.trim()).length} entries
                </span>
            </div>
        </div>
    );
};

// ─── Generation Checkbox Dropdown ─────────────────────────────────────────────
const GenCheckboxDropdown = ({ selectedGenerations, onChange }) => {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const btnRef = useRef(null);

    const allGens = useMemo(() => {
        const gens = [{ value: 'all', label: 'All Generations' }];
        for (let i = 1; i <= STANDARD_GEN_COUNT; i++) gens.push({ value: `gen${i}`, label: `Generation ${i}` });
        gens.push({ value: 'genvall', label: 'All Virtual Generations' });
        for (let i = 1; i <= V_GEN_COUNT; i++) gens.push({ value: `genv${i}`, label: `JKT48V Gen ${i}` });
        // Teams
        gens.push({ value: 'team_love', label: '💗 Tim Love', group: 'Teams' });
        gens.push({ value: 'team_dream', label: '✨ Tim Dream', group: 'Teams' });
        gens.push({ value: 'team_passion', label: '🔥 Tim Passion', group: 'Teams' });
        return gens;
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Recompute position whenever it opens or the window scrolls/resizes
    useEffect(() => {
        if (!open || !btnRef.current) return;
        const update = () => {
            const rect = btnRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open]);

    const handleToggle = (value) => {
        if (value === 'all') { onChange(['all']); return; }
        const without = selectedGenerations.filter(g => g !== 'all' && g !== value);
        if (selectedGenerations.includes(value)) {
            onChange(without.length === 0 ? ['all'] : without);
        } else {
            onChange([...without, value]);
        }
    };

    const label = selectedGenerations.includes('all')
        ? 'All Generations'
        : selectedGenerations.length === 1
            ? allGens.find(g => g.value === selectedGenerations[0])?.label || selectedGenerations[0]
            : `${selectedGenerations.length} selected`;

    return (
        <div className="gen-dropdown" ref={dropdownRef}>
            <button ref={btnRef} className="gen-dropdown-btn" onClick={() => setOpen(o => !o)}>
                <span>{label}</span>
                <span className="gen-dropdown-arrow">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div
                    className="gen-dropdown-menu"
                    style={{
                        position: 'fixed',
                        top: menuPos.top,
                        left: menuPos.left,
                        width: menuPos.width,
                    }}
                >
                    {allGens.map((gen, idx) => (
                        <React.Fragment key={gen.value}>
                            {/* Divider + group heading before first team entry */}
                            {gen.group === 'Teams' && allGens[idx - 1]?.group !== 'Teams' && (
                                <div className="gen-dropdown-group-divider">
                                    <span className="gen-dropdown-group-label">Teams</span>
                                </div>
                            )}
                            <label className="gen-dropdown-item">
                                <input
                                    type="checkbox"
                                    checked={selectedGenerations.includes(gen.value)}
                                    onChange={() => handleToggle(gen.value)}
                                />
                                <span>{gen.label}</span>
                            </label>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};


// ─── Result Overlay ───────────────────────────────────────────────────────────
const ResultOverlay = ({ result, onHide, onContinue, resultRef }) => {
    if (!result) return null;
    return (
        <div className="result-overlay" onClick={(e) => { if (e.target === e.currentTarget) onHide(); }}>
            <div className="result-card" ref={resultRef}>
                <div className="result-badge">Result!</div>
                {result.imgSrc && (
                    <div className="result-img-wrap">
                        <img src={result.imgSrc} alt={result.label} className="result-img" />
                    </div>
                )}
                {!result.imgSrc && (
                    <div className="result-icon-placeholder">🎯</div>
                )}
                <div className="result-name">{result.label}</div>
                <div className="result-roulette-source">from: {result.source}</div>
                <div className="result-actions">
                    <button className="result-btn result-btn-ok" onClick={onContinue}>OK, Continue</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Roulette Page ───────────────────────────────────────────────────────
const RoulettePage = () => {
    const navigate = useNavigate();

    // Filters
    const [memberType, setMemberType] = useState('active');
    const [selectedGenerations, setSelectedGenerations] = useState(['all']);

    // Active roulette tab (index: 0 = member roulette, 1+ = custom)
    const [activeTab, setActiveTab] = useState(0);

    // Custom roulettes
    const [customRoulettes, setCustomRoulettes] = useState([]);

    // Spin state
    const [spinning, setSpinning] = useState(false);
    const [targetIndex, setTargetIndex] = useState(null);
    const SPIN_DURATION = 5000; // ms

    // Result
    const [result, setResult] = useState(null);
    const [resultHistory, setResultHistory] = useState([]);
    const [showResult, setShowResult] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Removed history (members removed after being picked, until reset)
    const [removedMemberIndexes, setRemovedMemberIndexes] = useState(new Set());

    // Shuffle order: null = default order, otherwise a permuted index array over currentEntries
    const [shuffleOrder, setShuffleOrder] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);

    const resultRef = useRef(null);

    // ── Build member entry list ──
    const memberEntries = useMemo(() => {
        const list = [];
        const generations = selectedGenerations.includes('all') ? ['all'] : selectedGenerations;

        const addFile = (filename, isActive) => {
            const matchesAnyGen = generations.some(gen => matchesGeneration(filename, gen));
            if (!matchesAnyGen) return;
            const name = formatMemberName(filename);
            if (!name) return;
            const imgSrc = isActive
                ? `/asset/member_active/${filename}`
                : `/asset/exmember/${filename.replace(/\\/g, '/')}`;
            list.push({ label: name, imgSrc, source: 'Member Roulette' });
        };

        if (memberType === 'active' || memberType === 'all') {
            activeMemberFiles.forEach(f => addFile(f, true));
        }
        if (memberType === 'ex' || memberType === 'all') {
            exMemberFiles.forEach(f => addFile(f, false));
        }
        return list;
    }, [memberType, selectedGenerations]);

    // Remaining members not yet removed
    const remainingMemberEntries = useMemo(() => {
        return memberEntries.filter((_, i) => !removedMemberIndexes.has(i));
    }, [memberEntries, removedMemberIndexes]);

    // Current tab's entries — base order
    const currentEntries = useMemo(() => {
        if (activeTab === 0) return remainingMemberEntries;
        const custom = customRoulettes[activeTab - 1];
        if (!custom) return [];
        return custom.rawText
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(label => ({ label, imgSrc: null, source: custom.name || 'Custom Roulette' }));
    }, [activeTab, remainingMemberEntries, customRoulettes]);

    // Apply shuffle order on top of base entries, sync when base changes
    // Auto-shuffle whenever the entry list changes (page load, filter/tab switch)
    useEffect(() => {
        if (currentEntries.length === 0) { setShuffleOrder(null); return; }
        const indices = Array.from({ length: currentEntries.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = cryptoRandInt(i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffleOrder(indices);
    }, [currentEntries]);

    const displayEntries = useMemo(() => {
        if (!shuffleOrder || shuffleOrder.length !== currentEntries.length) return currentEntries;
        return shuffleOrder.map(i => currentEntries[i]);
    }, [currentEntries, shuffleOrder]);

    // ── Spin handler ──
    const handleSpin = () => {
        if (spinning || displayEntries.length === 0) return;
        const idx = cryptoRandInt(displayEntries.length);
        setTargetIndex(idx);
        setSpinning(true);
        setShowResult(false);
        setShowConfetti(false);
    };

    const handleSpinEnd = useCallback(() => {
        if (targetIndex == null || displayEntries.length === 0) { setSpinning(false); return; }
        const picked = displayEntries[targetIndex];
        const pickedEntry = { ...picked };
        setResult(pickedEntry);
        setResultHistory(prev => [pickedEntry, ...prev]);
        setSpinning(false);
        setShowResult(true);

        // Trigger confetti
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4500);

        // If it's the member roulette, mark the member as removed
        if (activeTab === 0) {
            const realIndex = memberEntries.findIndex((e, i) =>
                !removedMemberIndexes.has(i) &&
                e.label === picked.label &&
                e.imgSrc === picked.imgSrc
            );
            if (realIndex !== -1) {
                setRemovedMemberIndexes(prev => new Set([...prev, realIndex]));
            }
        }

        // If it's a custom roulette with removeOnPick enabled, remove the picked entry from rawText
        if (activeTab !== 0) {
            const custom = customRoulettes[activeTab - 1];
            if (custom && custom.removeOnPick) {
                let removed = false;
                const newLines = custom.rawText.split('\n').filter(line => {
                    if (!removed && line.trim() === picked.label) {
                        removed = true;
                        return false;
                    }
                    return true;
                });
                setCustomRoulettes(prev => prev.map(r =>
                    r.id === custom.id ? { ...r, rawText: newLines.join('\n') } : r
                ));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetIndex, displayEntries, activeTab, memberEntries, removedMemberIndexes, customRoulettes]);

    // ── Reset ──
    const handleReset = () => {
        setRemovedMemberIndexes(new Set());
        setResult(null);
        setResultHistory([]);
        setShowResult(false);
        setShowConfetti(false);
        setSpinning(false);
        setTargetIndex(null);
        // Shuffle immediately after reset (currentEntries will re-compute; useEffect above handles it)
        // But removedMemberIndexes is async, so re-shuffle manually with full memberEntries length
        const baseLength = activeTab === 0 ? memberEntries.length : currentEntries.length;
        if (baseLength > 0) {
            const indices = Array.from({ length: baseLength }, (_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = cryptoRandInt(i + 1);
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            setShuffleOrder(indices);
        }
    };

    // ── Shuffle ──
    // Crypto Fisher-Yates shuffle of indices
    const handleShuffle = () => {
        if (spinning || currentEntries.length === 0) return;
        const indices = Array.from({ length: currentEntries.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = cryptoRandInt(i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffleOrder(indices);
        // Brief animation feedback
        setIsShuffling(true);
        setTimeout(() => setIsShuffling(false), 500);
    };


    // ── Custom roulette management ──
    const addCustomRoulette = () => {
        const newId = Date.now();
        const newR = { id: newId, name: `Custom Roulette ${customRoulettes.length + 1}`, rawText: '', removeOnPick: false };
        setCustomRoulettes(prev => [...prev, newR]);
        setActiveTab(customRoulettes.length + 1);
    };

    const updateCustomRoulette = (id, updated) => {
        setCustomRoulettes(prev => prev.map(r => r.id === id ? updated : r));
    };

    const removeCustomRoulette = (id) => {
        const idx = customRoulettes.findIndex(r => r.id === id);
        setCustomRoulettes(prev => prev.filter(r => r.id !== id));
        if (activeTab === idx + 1) setActiveTab(0);
        else if (activeTab > idx + 1) setActiveTab(t => t - 1);
    };

    // Viewport reset on mount
    useEffect(() => {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
        }
    }, []);

    // ── Dynamic browser tab title ──
    useEffect(() => {
        const BASE = 'JKT48 Roulette';
        let tabName;
        if (activeTab === 0) {
            tabName = 'Member Roulette';
        } else {
            const custom = customRoulettes[activeTab - 1];
            tabName = custom ? (custom.name || `Custom Roulette ${activeTab}`) : BASE;
        }
        document.title = `${tabName} – ${BASE}`;

        return () => {
            document.title = 'JKT48 Tierlist - Buat Peringkat Member Favoritmu!';
        };
    }, [activeTab, customRoulettes]);

    const remaining = activeTab === 0 ? remainingMemberEntries.length : currentEntries.length;
    const total = activeTab === 0 ? memberEntries.length : currentEntries.length;

    return (
        <div className="roulette-page">
            {/* Confetti overlay */}
            <ConfettiCanvas active={showConfetti} />

            {/* Result overlay */}
            {showResult && result && (
                <ResultOverlay
                    result={result}
                    onHide={() => setShowResult(false)}
                    onContinue={() => setShowResult(false)}
                    resultRef={resultRef}
                />
            )}

            {/* ── Header ── */}
            <header className="roulette-header">
                <button className="roulette-back-btn" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <div className="roulette-header-title">
                    <h1>JKT48 Roulette</h1>
                </div>
                <div className="roulette-header-actions">
                    <button
                        className={`roulette-action-btn roulette-shuffle-btn ${isShuffling ? 'shuffling' : ''}`}
                        onClick={handleShuffle}
                        title="Shuffle wheel order"
                        disabled={spinning || currentEntries.length === 0}
                    >
                        🔀 Shuffle
                    </button>
                    <button
                        className="roulette-action-btn"
                        onClick={handleReset}
                        title="Reset roulette"
                        disabled={spinning}
                    >
                        🔄 Reset
                    </button>
                </div>
            </header>

            {/* ── Tabs ── */}
            <div className="roulette-tabs-bar">
                <button
                    className={`roulette-tab ${activeTab === 0 ? 'active' : ''}`}
                    onClick={() => setActiveTab(0)}
                >
                    👥 Member Roulette
                </button>
                {customRoulettes.map((r, i) => (
                    <button
                        key={r.id}
                        className={`roulette-tab ${activeTab === i + 1 ? 'active' : ''}`}
                        onClick={() => setActiveTab(i + 1)}
                    >
                        ✏️ {r.name || `Custom ${i + 1}`}
                    </button>
                ))}
                <button className="roulette-tab roulette-tab-add" onClick={addCustomRoulette}>
                    + Custom Roulette
                </button>
            </div>

            {/* ── Main layout ── */}
            <div className="roulette-main">

                {/* ── Left panel: controls ── */}
                <aside className="roulette-sidebar">
                    {activeTab === 0 ? (
                        <>
                            <div className="sidebar-section">
                                <label className="sidebar-label">Member Type</label>
                                <select
                                    className="sidebar-select"
                                    value={memberType}
                                    onChange={e => { setMemberType(e.target.value); setRemovedMemberIndexes(new Set()); }}
                                >
                                    <option value="active">Active Members</option>
                                    <option value="ex">Ex Members</option>
                                    <option value="all">All Members</option>
                                </select>
                            </div>

                            <div className="sidebar-section">
                                <label className="sidebar-label">Generation/Team</label>
                                <GenCheckboxDropdown
                                    selectedGenerations={selectedGenerations}
                                    onChange={(gens) => { setSelectedGenerations(gens); setRemovedMemberIndexes(new Set()); }}
                                />
                            </div>

                            <div className="sidebar-section">
                                <div className="sidebar-stat-box">
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-label">Pool</span>
                                        <div className="sidebar-stat-row">
                                            <span className="sidebar-stat-value">{remaining}</span>
                                            <span className="sidebar-stat-divider">/ {total}</span>
                                        </div>
                                    </div>
                                    <div className="sidebar-stat">
                                        <span className="sidebar-stat-label">Picked</span>
                                        <span className="sidebar-stat-value picked">{total - remaining}</span>
                                    </div>
                                </div>
                                <div className="sidebar-progress-bar">
                                    <div
                                        className="sidebar-progress-fill"
                                        style={{ width: total > 0 ? `${((total - remaining) / total) * 100}%` : '0%' }}
                                    />
                                </div>
                            </div>

                            {/* Results history list */}
                            {resultHistory.length > 0 && (
                                <div className="sidebar-section sidebar-history-section">
                                    <div className="sidebar-history-header">
                                        <label className="sidebar-label">Results History</label>
                                        <span className="sidebar-history-count">{resultHistory.length}</span>
                                    </div>
                                    <div className="sidebar-history-list">
                                        {resultHistory.map((entry, idx) => (
                                            <div
                                                key={idx}
                                                className={`sidebar-history-item ${idx === 0 ? 'latest' : ''}`}
                                                onClick={() => { setResult(entry); setShowResult(true); }}
                                                title="Click to view result"
                                            >
                                                <span className="history-item-num">#{resultHistory.length - idx}</span>
                                                {entry.imgSrc
                                                    ? <img src={entry.imgSrc} alt={entry.label} className="history-item-img" />
                                                    : <span className="history-item-emoji">🎯</span>
                                                }
                                                <div className="history-item-info">
                                                    <span className="history-item-name">{entry.label}</span>
                                                    <span className="history-item-source">{entry.source}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        customRoulettes[activeTab - 1] && (
                            <div className="sidebar-section">
                                <label className="sidebar-label">Edit Roulette</label>
                                <CustomRoulettePanel
                                    id={customRoulettes[activeTab - 1].id}
                                    roulette={customRoulettes[activeTab - 1]}
                                    onChange={(updated) => updateCustomRoulette(customRoulettes[activeTab - 1].id, updated)}
                                    onRemove={removeCustomRoulette}
                                />
                            </div>
                        )
                    )}

                    {/* Results history — shown on ALL tabs */}
                    {activeTab !== 0 && resultHistory.length > 0 && (
                        <div className="sidebar-section sidebar-history-section">
                            <div className="sidebar-history-header">
                                <label className="sidebar-label">Results History</label>
                                <span className="sidebar-history-count">{resultHistory.length}</span>
                            </div>
                            <div className="sidebar-history-list">
                                {resultHistory.map((entry, idx) => (
                                    <div
                                        key={idx}
                                        className={`sidebar-history-item ${idx === 0 ? 'latest' : ''}`}
                                        onClick={() => { setResult(entry); setShowResult(true); }}
                                        title="Click to view result"
                                    >
                                        <span className="history-item-num">#{resultHistory.length - idx}</span>
                                        {entry.imgSrc
                                            ? <img src={entry.imgSrc} alt={entry.label} className="history-item-img" />
                                            : <span className="history-item-emoji">🎯</span>
                                        }
                                        <div className="history-item-info">
                                            <span className="history-item-name">{entry.label}</span>
                                            <span className="history-item-source">{entry.source}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>


                {/* ── Center: wheel ── */}
                <section className="roulette-center">
                    <div className="roulette-wheel-wrapper">
                        {/* Pointer arrow */}
                        <div className="roulette-pointer">▼</div>

                        {/* Glow ring */}
                        <div className={`roulette-glow-ring ${spinning ? 'spinning-glow' : ''}`}>
                            <RouletteWheelCanvas
                                entries={displayEntries}
                                spinning={spinning}
                                targetIndex={targetIndex}
                                spinDuration={SPIN_DURATION}
                                onSpinEnd={handleSpinEnd}
                            />
                        </div>
                    </div>

                    {/* Spin button */}
                    <button
                        className={`roulette-spin-btn ${spinning ? 'spinning' : ''}`}
                        onClick={handleSpin}
                        disabled={spinning || displayEntries.length === 0}
                    >
                        {spinning ? (
                            <span className="spin-btn-inner">
                                <span className="spin-dot-1">●</span>
                                <span className="spin-dot-2">●</span>
                                <span className="spin-dot-3">●</span>
                            </span>
                        ) : (
                            currentEntries.length === 0 ? 'No Entries' : 'SPIN!'
                        )}
                    </button>

                    {displayEntries.length === 0 && (
                        <p className="roulette-empty-hint">
                            {activeTab === 0
                                ? 'No members match the selected filters.'
                                : 'Add entries in the panel on the left.'}
                        </p>
                    )}

                    {/* ── Mobile-only Results History ── */}
                    {resultHistory.length > 0 && (
                        <div className="mobile-history-panel">
                            <div className="mobile-history-header">
                                <span className="mobile-history-title">Results History</span>
                                <span className="sidebar-history-count">{resultHistory.length}</span>
                            </div>
                            <div className="mobile-history-list">
                                {resultHistory.map((entry, idx) => (
                                    <div
                                        key={idx}
                                        className={`sidebar-history-item ${idx === 0 ? 'latest' : ''}`}
                                    >
                                        <span className="history-item-num">#{resultHistory.length - idx}</span>
                                        {entry.imgSrc
                                            ? <img src={entry.imgSrc} alt={entry.label} className="history-item-avatar" />
                                            : <span className="history-item-emoji">🎯</span>
                                        }
                                        <div className="history-item-info">
                                            <span className="history-item-name">{entry.label}</span>
                                            <span className="history-item-source">{entry.source}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default RoulettePage;
