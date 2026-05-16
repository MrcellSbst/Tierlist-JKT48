import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container, Typography, Box, Paper, Alert, Button, Chip, Link,
  Tabs, Tab, Avatar, Divider, Accordion, AccordionSummary, AccordionDetails,
  IconButton, Select, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { ArrowBack, ArrowForward, ConfirmationNumber, TheaterComedy, Person, VideoCameraFront, Download, PieChart as PieChartIcon, TrendingUp, CalendarToday, AutoAwesome } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth } from 'date-fns';
import domtoimage from 'dom-to-image-more';
import { activeMemberFiles, exMemberFiles } from './data/memberData.js';

// Use date-only (YYYY-MM-DD) for dedup — ignore time to avoid timezone issues.
function dateOnly(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : '';
}

function ticketDedupKey(ticket) {
  const tx     = ticket.transaction_numbers?.[0] || '';
  const ref    = ticket.reference_code || '';
  const status = ticket.raffle_status ?? 'null';
  return `${tx}|${dateOnly(ticket.date)}|${dateOnly(ticket.expired_date)}|${ref}|${status}`;
}

// ─── Ticket processor — deduplicates by exact record key + classifies ─────────
function processTickets(data) {
  const seenTransactions = new Set();
  const validTickets = [];

  for (const ticket of data) {
    // Skip LOSE raffle tickets
    if (ticket.raffle_status === 'LOSE') continue;

    const dedupKey = ticketDedupKey(ticket);

    // Skip duplicate entries (keep only first valid occurrence)
    if (dedupKey && seenTransactions.has(dedupKey)) continue;
    if (dedupKey) seenTransactions.add(dedupKey);

    const name = ticket.name || '';
    const type = ticket.ticket_type;
    let eventType;

    if (type === 'EXCLUSIVE') {
      if (name.includes('Meet & Greet')) eventType = 'Meet and Greet';
      else if (name.includes('2Shot'))   eventType = '2Shot';
      else                               eventType = 'Video Call';
    } else if (type === 'EVENT') {
      if (name.toLowerCase().includes('video call')) eventType = 'Video Call (Event)';
      else                                           eventType = 'Event';
    } else if (type === 'SHOW') {
      switch (ticket.jkt48_member_type) {
        case 'TRAINEE': eventType = 'Show (Trainee)';    break;
        case 'LOVE':    eventType = 'Show (Sub-unit)';   break;
        case 'ALL':     eventType = 'Show (All Member)'; break;
        default:        eventType = 'Show';              break;
      }
    } else {
      eventType = 'Unknown';
    }

    validTickets.push({ ...ticket, eventType });
  }

  return validTickets;
}

// ─── Palette ─────────────────────────────────────────────────────────────────
const COLORS = [
  '#E50014', '#ff6b8a', '#ff9f43', '#ffd32a',
  '#0abde3', '#48dbfb', '#1dd1a1', '#10ac84',
  '#5f27cd', '#a29bfe', '#fd79a8', '#fdcb6e',
];

// ─── Custom Bar Chart Tooltip with Total ──────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <Box sx={{ bgcolor: '#0d0d1a', border: '1px solid rgba(229,0,20,0.3)', borderRadius: 2, p: 1.5, minWidth: 140 }}>
      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, mb: 0.5 }}>{label}</Typography>
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: p.color, flexShrink: 0 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, flex: 1 }}>{p.name}</Typography>
          <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{p.value.toLocaleString()} P</Typography>
        </Box>
      ))}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', mt: 0.5, pt: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Total</Typography>
        <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{total.toLocaleString()} P</Typography>
      </Box>
    </Box>
  );
}

// ─── Reusable ranked list card ────────────────────────────────────────────────
function RankedList({ title, icon, data, valueLabel = '', colorKey }) {
  const max = data[0]?.value || 1;
  return (
    <Paper sx={{ p: 3, bgcolor: '#1a1a2e', borderRadius: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      {data.length === 0 ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No data</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          {data.map((item, i) => (
            <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 20, textAlign: 'right', flexShrink: 0 }}>
                {i + 1}
              </Typography>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                    {item.name}
                  </Typography>
                  <Chip
                    label={`${item.value}${valueLabel}`}
                    size="small"
                    sx={{ bgcolor: colorKey || COLORS[i % COLORS.length], color: '#fff', fontWeight: 700, fontSize: 11 }}
                  />
                </Box>
                <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      width: `${(item.value / max) * 100}%`,
                      bgcolor: colorKey || COLORS[i % COLORS.length],
                      borderRadius: 2,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#E50014', icon }) {
  return (
    <Paper sx={{
      p: 2.5,
      bgcolor: '#1a1a2e',
      borderRadius: 3,
      border: `1px solid ${color}33`,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
    }}>
      <Box sx={{
        width: 48, height: 48, borderRadius: '50%',
        bgcolor: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {React.cloneElement(icon, { sx: { color, fontSize: 24 } })}
      </Box>
      <Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{label}</Typography>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{value}</Typography>
      </Box>
    </Paper>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getMemberPhotoUrl(memberName) {
  if (!memberName) return null;
  const parts = memberName.trim().split(/\s+/);
  const searchName = parts.map(p => p.toLowerCase()).join('_');

  const allFiles = [...activeMemberFiles, ...exMemberFiles];
  for (const file of allFiles) {
    const base = file.replace(/^.*\//, '').replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').toLowerCase();
    const cleanBase = base.replace(/^(gen\d+|jkt48vgen\d+)_/, '');
    if (cleanBase === searchName || cleanBase.includes(searchName) || searchName.includes(cleanBase)) {
      const isEx = exMemberFiles.includes(file);
      return `/asset/${isEx ? 'exmember' : 'member_active'}/${file}`;
    }
  }
  const first = parts[0] || '';
  const last = parts.slice(1).join('_') || first;
  return `https://jkt48.com/api/v1/storages/media/jkt48-member/${first.toLowerCase()}_${last.toLowerCase()}.jpg`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TicketHistory = () => {
  const [ticketsData, setTicketsData] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [pointsData, setPointsData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(25);
  const [txCategoryFilter, setTxCategoryFilter] = useState('all');
  const [ticketYear, setTicketYear] = useState('all');
  const [showWrapped, setShowWrapped] = useState(false);
  const [viewMode, setViewMode] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [userProfile, setUserProfile] = useState({ full_name: '', nickname: '', created_date: '', oshimen_name: '' });
  const [topupRevealed, setTopupRevealed] = useState(false);
  const wrappedRef = useRef(null);
  const navigate = useNavigate();

  const handleWrappedExport = async () => {
    if (!wrappedRef.current || exporting) return;
    setExporting(true);
    try {
      const btn = wrappedRef.current.querySelector('.screenshot-btn');
      if (btn) btn.style.display = 'none';

      if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
      await Promise.all(Array.from(wrappedRef.current.querySelectorAll('img')).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));

      const clone = wrappedRef.current.cloneNode(true);
      const CONTENT_W = 480;
      Object.assign(clone.style, {
        backgroundColor: '#1a1a2e',
        width: `${CONTENT_W}px`,
        maxWidth: 'none',
        margin: '0 auto',
        padding: '32px',
        boxSizing: 'border-box',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '0',
        opacity: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      });
      const strip = (el) => {
        if (!el?.style) return;
        el.style.animation = 'none'; el.style.transition = 'none';
        if (el.style.opacity) el.style.opacity = '1';
        if (el.tagName === 'SPAN' || el.tagName === 'P' || el.tagName === 'DIV' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4' || el.tagName === 'H5' || el.tagName === 'H6') {
          el.style.textAlign = 'center';
        }
        [...(el.children || [])].forEach(strip);
      };
      strip(clone);
      document.body.appendChild(clone);

      const W = CONTENT_W, H = clone.scrollHeight;
      clone.style.width = `${W}px`;
      clone.style.height = `${H}px`;
      const SCALE = Math.max(2, window.devicePixelRatio || 1);
      const opts = {
        quality: 1.0, bgcolor: '#1a1a2e', width: W, height: H, scale: SCALE,
        style: { 'background-color': '#1a1a2e', width: `${W}px`, height: `${H}px`, transform: 'none' },
        cacheBust: true,
      };

      let url;
      try {
        url = await domtoimage.toPng(clone, opts);
      } catch {
        const blob = await domtoimage.toBlob(clone, opts);
        url = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.download = `jkt48-wrapped-${ticketYear}.png`;
      a.href = url;
      a.click();
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);

      document.body.removeChild(clone);
      if (btn) btn.style.display = '';
    } catch (e) {
      console.error('Export failed:', e);
      const btn = wrappedRef.current?.querySelector('.screenshot-btn');
      if (btn) btn.style.display = '';
    }
    setExporting(false);
  };

  const loadTickets = () => {
    try {
      const raw = localStorage.getItem('jkt48_tickets_history');
      if (!raw) {
        setError('No ticket data found. Use the Chrome extension on jkt48.com first.');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.data || !Array.isArray(parsed.data)) {
        setError('Invalid ticket data structure.');
        return;
      }
      setTicketsData(parsed.data);
      setError('');
    } catch (e) {
      setError('Error loading ticket data: ' + e.message);
    }
  };

  const loadPointsHistory = () => {
    try {
      const raw = localStorage.getItem('jkt48_points_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data && Array.isArray(parsed.data)) {
          setPointsData(parsed.data);
        }
      }
    } catch (e) {
      console.error('Error loading points history:', e);
    }
  };

  const loadUserProfile = () => {
    try {
      const raw = localStorage.getItem('jkt48_user_profile');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserProfile(parsed);
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
  };

  useEffect(() => {
    loadTickets();
    loadPointsHistory();
    loadUserProfile();
    const onTicketUpdate = () => loadTickets();
    const onPointsUpdate = () => loadPointsHistory();
    const onProfileUpdate = () => loadUserProfile();
    const onStorage = (e) => {
      if (e.key === 'jkt48_tickets_history' || e.key === null) loadTickets();
      if (e.key === 'jkt48_points_history' || e.key === null) loadPointsHistory();
      if (e.key === 'jkt48_user_profile' || e.key === null) loadUserProfile();
    };
    window.addEventListener('JKT48_TICKETS_HISTORY_UPDATED', onTicketUpdate);
    window.addEventListener('JKT48_POINTS_HISTORY_UPDATED', onPointsUpdate);
    window.addEventListener('JKT48_USER_PROFILE_UPDATED', onProfileUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('JKT48_TICKETS_HISTORY_UPDATED', onTicketUpdate);
      window.removeEventListener('JKT48_POINTS_HISTORY_UPDATED', onPointsUpdate);
      window.removeEventListener('JKT48_USER_PROFILE_UPDATED', onProfileUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const getPointDelta = (row) => {
    const bp = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
    if (bp !== 0) return bp;
    const op = (row.operation || row.category || '').toUpperCase();
    if (op === 'POINT_REFUND') {
      const qty = parseInt(String(row.quantity || '0').replace(/[P,]/g, '').trim()) || 0;
      return qty;
    }
    return 0;
  };

  // ─── Stats computation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const availableYears = new Set();
    ticketsData.forEach(t => {
      if (t.date) availableYears.add(t.date.slice(0, 4));
    });

    const filtered = ticketYear === 'all'
      ? ticketsData
      : ticketsData.filter(t => t.date && t.date.slice(0, 4) === ticketYear);

    const txToPoints = {};
    pointsData.forEach(row => {
      if (row.status === 'PENDING') return;
      const id = (row.id || '').trim();
      const bp = getPointDelta(row);
      if (id && bp !== 0) txToPoints[id] = bp;
    });

    const vcMngByMember = {};
    const twoShotByMember = {};
    const showWinByLabel = {};
    const showLoseByLabel = {};
    const theaterApplyByLabel = {};
    const theaterApplyDetails = {};

    let totalVcMng = 0, total2Shot = 0, totalShowWin = 0, totalShowLose = 0;

    for (const ticket of filtered) {
      const { ticket_type, ticket_label, name, member_name, raffle_status, used_count } = ticket;
      const label = ticket_label || name;
      const bought = parseInt(ticket.bought_count || '1') || 1;

      if (ticket_type === 'SHOW') {
        const isLose = raffle_status === 'LOSE';
        const rawUsed = parseInt(used_count || '0');
        const isWin = used_count === '1' || rawUsed > 0;

        // Phantom check: win ticket but 0 P actually spent → fake record
        let isPhantom = false;
        if (isWin) {
          const txIds = ticket.transaction_numbers || [];
          let totalSpent = 0;
          for (const txId of txIds) {
            totalSpent += txToPoints[txId] || 0;
          }
          if (totalSpent === 0) isPhantom = true;
        }

        if (isLose) {
          showLoseByLabel[label] = (showLoseByLabel[label] || 0) + bought;
          totalShowLose += bought;
        }
        if (isWin && !isPhantom) {
          showWinByLabel[label] = (showWinByLabel[label] || 0) + bought;
          totalShowWin += bought;
        }
        if ((isLose || (isWin && !isPhantom))) {
          theaterApplyByLabel[label] = (theaterApplyByLabel[label] || 0) + bought;
          if (!theaterApplyDetails[label]) theaterApplyDetails[label] = [];
          theaterApplyDetails[label].push({
            txKey: ticket.transaction_numbers?.[0] || 'N/A',
            raffle_status,
            used_count: used_count || '0',
            date: ticket.date,
            expired_date: ticket.expired_date,
            reference_code: ticket.reference_code,
            is_phantom: isPhantom,
          });
        }
      } else if (ticket_type === 'EXCLUSIVE' || ticket_type === 'EVENT') {
        if (raffle_status !== 'LOSE') {
          const txIds = ticket.transaction_numbers || [];
          let totalSpent = 0;
          for (const txId of txIds) { totalSpent += txToPoints[txId] || 0; }
          if (totalSpent === 0) continue; // phantom record

          const mem = ticket.member_name;
          const refCode = (ticket.reference_code || '').trim();
          let isTwoShot = false;

          if (refCode && txToPoints[refCode] === -180000) {
            isTwoShot = true;
          } else {
            for (const txId of txIds) {
              if (txToPoints[txId] === -180000) {
                isTwoShot = true;
                break;
              }
            }
          }

          if (isTwoShot && mem) {
            twoShotByMember[mem] = (twoShotByMember[mem] || 0) + bought;
            total2Shot += bought;
          } else if (mem) {
            vcMngByMember[mem] = (vcMngByMember[mem] || 0) + bought;
            totalVcMng += bought;
          }
        }
      }
    }

    const toSorted = (obj) =>
      Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return {
      vcMngByMember:   toSorted(vcMngByMember),
      twoShotByMember: toSorted(twoShotByMember),
      showWinNull:     toSorted(showWinByLabel),
      showLose:        toSorted(showLoseByLabel),
      theaterApply:    toSorted(theaterApplyByLabel),
      theaterApplyDetails,
      totalVcMng, total2Shot, totalShowWin, totalShowLose,
      totalApply: totalShowWin + totalShowLose,
      totalTickets: totalShowWin + totalShowLose + totalVcMng + total2Shot,
      availableYears: Array.from(availableYears).sort().reverse(),
    };
  }, [ticketsData, ticketYear, pointsData]);

  // ─── Wrapped Stats ──────────────────────────────────────────────────────────
  const wrappedStats = useMemo(() => {
    const yearFiltered = ticketYear === 'all'
      ? ticketsData
      : ticketsData.filter(t => t.date && t.date.slice(0, 4) === ticketYear);

    const txToPoints = {};
    pointsData.forEach(row => {
      if (row.status === 'PENDING') return;
      const id = (row.id || '').trim();
      const bp = getPointDelta(row);
      if (id && bp !== 0) txToPoints[id] = bp;
    });

    const vcMngByMember = {};
    const twoShotByMember = {};
    const showWinByLabel = {};
    const showLoseByLabel = {};
    const theaterApplyByLabel = {};

    let totalVcMng = 0, total2Shot = 0, totalShowWin = 0, totalShowLose = 0;

    for (const ticket of yearFiltered) {
      const { ticket_type, ticket_label, name, member_name, raffle_status, used_count } = ticket;
      const label = ticket_label || name;
      const bought = parseInt(ticket.bought_count || '1') || 1;

      if (ticket_type === 'SHOW') {
        const isLose = raffle_status === 'LOSE';
        const rawUsed = parseInt(used_count || '0');
        const isWin = used_count === '1' || rawUsed > 0;

        let isPhantom = false;
        if (isWin) {
          const txIds = ticket.transaction_numbers || [];
          let totalSpent = 0;
          for (const txId of txIds) { totalSpent += txToPoints[txId] || 0; }
          if (totalSpent === 0) isPhantom = true;
        }

        if (isLose) { showLoseByLabel[label] = (showLoseByLabel[label] || 0) + bought; totalShowLose += bought; }
        if (isWin && !isPhantom) { showWinByLabel[label] = (showWinByLabel[label] || 0) + bought; totalShowWin += bought; }
        if (isLose || (isWin && !isPhantom)) theaterApplyByLabel[label] = (theaterApplyByLabel[label] || 0) + bought;
      } else if (ticket_type === 'EXCLUSIVE' || ticket_type === 'EVENT') {
        if (raffle_status !== 'LOSE') {
          const txIds = ticket.transaction_numbers || [];
          let totalSpent = 0;
          for (const txId of txIds) { totalSpent += txToPoints[txId] || 0; }
          if (totalSpent === 0) continue; // phantom record

          const mem = ticket.member_name;
          const refCode = (ticket.reference_code || '').trim();
          let isTwoShot = false;
          if (refCode && txToPoints[refCode] === -180000) isTwoShot = true;
          else { for (const txId of txIds) { if (txToPoints[txId] === -180000) { isTwoShot = true; break; } } }
          if (isTwoShot && mem) { twoShotByMember[mem] = (twoShotByMember[mem] || 0) + bought; total2Shot += bought; }
          else if (mem) { vcMngByMember[mem] = (vcMngByMember[mem] || 0) + bought; totalVcMng += bought; }
        }
      }
    }

    const toSorted = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const topSetlists = toSorted(showWinByLabel).slice(0, 3);
    const mostApplied = toSorted(theaterApplyByLabel).slice(0, 3);
    const topVC = toSorted(vcMngByMember).slice(0, 3);
    const top2Shot = toSorted(twoShotByMember).slice(0, 3);
    const totalApply = totalShowWin + totalShowLose;
    const winrate = totalApply > 0 ? ((totalShowWin / totalApply) * 100).toFixed(1) : 0;
    const username = userProfile.full_name || ticketsData[0]?.member_name || 'Fan';
    const yearLabel = ticketYear === 'all'
      ? (stats.availableYears.length > 1 ? `${stats.availableYears[stats.availableYears.length - 1]} - ${stats.availableYears[0]}` : stats.availableYears[0] || '')
      : ticketYear;
    const totalTopup = pointsData.reduce((sum, row) => {
      const purpose = (row.purpose || '').trim().toUpperCase();
      const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
      return purpose === 'PEMBELIAN POIN JKT48' && points > 0 ? sum + points : sum;
    }, 0);

    const createdDate = userProfile.created_date || '';
    const oshimenName = userProfile.oshimen_name || '';
    let daysSince = 0;
    if (createdDate) {
      const created = new Date(createdDate);
      if (!isNaN(created.getTime())) {
        daysSince = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return { topSetlists, mostApplied, topVC, top2Shot, winrate, username, yearLabel, totalTopup, totalShowWin, totalShowLose, createdDate, daysSince, oshimenName };
  }, [ticketsData, ticketYear, pointsData, stats.availableYears]);

  // ─── Points History Stats ──────────────────────────────────────────────────
  const pointsStats = useMemo(() => {
    const calculateCurrentPoints = () => {
      return pointsData.reduce((total, row) => {
        if (row.status === 'PENDING') return total;
        const bonus = parseInt(String(row.bonusPoints || '0').replace(/[P,]/g, '').trim()) || 0;
        return total + getPointDelta(row) + bonus;
      }, 0);
    };

    const calculateTotalSpend = () => {
      return pointsData.reduce((total, row) => {
        if ((row.purpose || '').trim() === 'Masa Berlaku Habis') return total;
        if (row.status === 'PENDING') return total;
        const points = getPointDelta(row);
        return total + (points < 0 ? Math.abs(points) : 0);
      }, 0);
    };

    const calculateTotalTopup = () => {
      return pointsData.reduce((total, row) => {
        const purpose = (row.purpose || '').trim().toUpperCase();
        const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
        const bonus = parseInt(String(row.bonusPoints || '0').replace(/[P,]/g, '').trim()) || 0;
        if (purpose === 'PEMBELIAN POIN JKT48' && points > 0) {
          return total + points + bonus;
        }
        return total;
      }, 0);
    };

    const calculateTotalExpired = () => {
      return pointsData.reduce((total, row) => {
        if (row.status === 'PENDING') return total;
        const purpose = (row.purpose || '').trim().toUpperCase();
        const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
        if (purpose === 'MASA BERLAKU HABIS') {
          return total + Math.abs(points);
        }
        return total;
      }, 0);
    };

    const calculateTotalServiceCharged = () => {
      return pointsData.reduce((total, row) => {
        const sc = parseFloat(row.serviceCharge) || 0;
        return total + sc;
      }, 0);
    };

    const calculateTotalBonus = () => {
      return pointsData.reduce((total, row) => {
        if (row.status === 'PENDING') return total;
        const bonus = parseInt(String(row.bonusPoints || '0').replace(/[P,]/g, '').trim()) || 0;
        return total + bonus;
      }, 0);
    };

    const mapCategoryLabel = (raw) => {
      if (!raw || raw === '-') return 'Others';
      const upper = raw.toUpperCase().trim();
      if (upper === 'VC/MNG' || upper === 'EXCLUSIVE') return 'VC/MnG';
      if (upper === 'OFC_REGISTER') return 'Membership Official';
      return raw;
    };

    const categoryData = {};
    const monthlyData = {};
    const yearlyData = {};
    const availableYears = new Set();
    const uniqueCategories = new Set();
    const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    allMonths.forEach(month => {
      monthlyData[`${month} ${selectedYear}`] = { month };
    });

    pointsData.forEach(row => {
      if (row.status === 'PENDING') return;
      const purp = (row.purpose || '').trim();
      if (purp === 'Pembelian Poin JKT48' || purp === 'Masa Berlaku Habis') return;

      const points = getPointDelta(row);
      if (points >= 0) return;

      let categoryRaw = (row.category || '').trim();
      if (categoryRaw === '-' || categoryRaw === '') categoryRaw = 'Others';
      const category = mapCategoryLabel(categoryRaw);
      uniqueCategories.add(category);

      const spendingAmount = Math.abs(points);
      categoryData[category] = (categoryData[category] || 0) + spendingAmount;

      try {
        let date;
        if (row.date && String(row.date).match(/^\d{4}-\d{2}-\d{2}/)) {
          date = new Date(row.date);
        } else {
          const parts = String(row.date || '').split(' ');
          const day = parts[0] || '1';
          const month = parts[1] || 'Januari';
          const year = parts[2] || '2020';
          const monthMap = {
            'Januari': 'January', 'Februari': 'February', 'Maret': 'March',
            'April': 'April', 'Mei': 'May', 'Juni': 'June',
            'Juli': 'July', 'Agustus': 'August', 'September': 'September',
            'Oktober': 'October', 'November': 'November', 'Desember': 'December'
          };
          const englishMonth = monthMap[month] || month;
          date = new Date(`${year}-${englishMonth}-${day}`);
        }

        if (isNaN(date.getTime())) date = new Date();

        const monthKey = format(startOfMonth(date), 'MMM yyyy');
        const yearKey = format(date, 'yyyy');
        availableYears.add(yearKey);

        if (yearKey === selectedYear) {
          if (!monthlyData[monthKey]) monthlyData[monthKey] = { month: monthKey.split(' ')[0] };
          monthlyData[monthKey][category] = (monthlyData[monthKey][category] || 0) + spendingAmount;
        }

        if (!yearlyData[yearKey]) yearlyData[yearKey] = { year: yearKey };
        yearlyData[yearKey][category] = (yearlyData[yearKey][category] || 0) + spendingAmount;
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    });

    const sortedMonthly = allMonths.map(month => {
      const mKey = `${month} ${selectedYear}`;
      return monthlyData[mKey] || { month };
    });

    const sortedYearly = Object.values(yearlyData).sort((a, b) => a.year.localeCompare(b.year));
    const categories = Object.entries(categoryData)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      currentPoints: calculateCurrentPoints(),
      totalSpend: calculateTotalSpend(),
      totalTopup: calculateTotalTopup(),
      totalExpired: calculateTotalExpired(),
      totalServiceCharged: calculateTotalServiceCharged(),
      totalBonus: calculateTotalBonus(),
      categories,
      monthly: sortedMonthly,
      yearly: sortedYearly,
      availableYears: Array.from(availableYears).sort().reverse(),
      uniqueCategoryNames: Array.from(uniqueCategories)
    };
  }, [pointsData, selectedYear]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Top bar */}
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        bgcolor: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
        px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: '1px solid rgba(229,0,20,0.2)',
      }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/')}
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          Back
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <ConfirmationNumber sx={{ color: '#E50014' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            JKT48 Ticket History
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minHeight: '100vh', bgcolor: '#0d0d1a', pt: '72px', pb: 6 }}>
        <Container maxWidth="xl">

          {/* Error / empty state */}
          {error && (
            <Alert
              severity="info"
              sx={{ mt: 3, mb: 2, bgcolor: 'rgba(229,0,20,0.1)', color: '#fff', border: '1px solid rgba(229,0,20,0.3)' }}
              action={
                <Button size="small" sx={{ color: '#E50014' }} onClick={loadTickets}>Retry</Button>
              }
            >
              {error}
              {error.includes('extension') && (
                <Box sx={{ mt: 1 }}>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    <li>Install the JKT48 Points History Exporter extension</li>
                    <li>Go to <Link href="https://jkt48.com" target="_blank" sx={{ color: '#E50014' }}>jkt48.com</Link></li>
                    <li>Click the 🎀 button → <strong>Get Data!</strong></li>
                    <li>Come back here</li>
                  </ol>
                </Box>
              )}
            </Alert>
          )}

          {ticketsData.length > 0 && (
            <>
              {showWrapped && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, px: 2 }}>
                  {/* Wrapped Card */}
                  <Box ref={wrappedRef} sx={{ width: '100%', maxWidth: 480, bgcolor: '#1a1a2e', borderRadius: 4, p: 4, position: 'relative', overflow: 'hidden' }}>
                    {/* Background decoration */}
                    <Box sx={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', bgcolor: 'rgba(229,0,20,0.06)', pointerEvents: 'none' }} />
                    <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(229,0,20,0.04)', pointerEvents: 'none' }} />

                    {/* Title */}
                    <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900, textAlign: 'center', mb: 0.5, position: 'relative' }}>
                      {wrappedStats.username ? `${wrappedStats.username}'s` : ''} JKT48 Wrapped
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2, position: 'relative' }}>
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>{wrappedStats.yearLabel || 'All'}</Typography>
                    </Box>

                    {/* Profile */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, position: 'relative' }}>
                      {wrappedStats.oshimenName && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,1)', fontWeight: 600, mb: 1 }}>
                          Oshimen:
                        </Typography>
                      )}
                      {(() => {
                        const photoName = wrappedStats.oshimenName || wrappedStats.username;
                        const photoUrl = getMemberPhotoUrl(photoName);
                        return photoUrl ? (
                          <Box sx={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)' }}>
                            <img src={photoUrl} alt={photoName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<div style="width:100%;height:100%;background:#E50014;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-weight:800;font-size:40px;">${getInitials(photoName)}</span></div>`; }} />
                          </Box>
                        ) : (
                          <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: '#E50014', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.2)' }}>
                            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 40 }}>{getInitials(photoName)}</Typography>
                          </Box>
                        );
                      })()}
                      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, mt: 1.5 }}>{wrappedStats.oshimenName || wrappedStats.username}</Typography>
                      {wrappedStats.createdDate && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
                          Member since {wrappedStats.createdDate.split('T')[0]} ({wrappedStats.daysSince} days)
                        </Typography>
                      )}
                    </Box>

                    {/* Stats Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, position: 'relative' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', mb: 0.5 }}>Top Setlists (Win)</Typography>
                        {wrappedStats.topSetlists.map((s, i) => (
                          <Typography key={i} variant="body2" sx={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>
                            <Box component="span" sx={{ color: '#E50014', mr: 0.5 }}>●</Box>{s.name} — {s.value}x
                          </Typography>
                        ))}
                        {wrappedStats.topSetlists.length === 0 && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>—</Typography>}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', mb: 0.5 }}>Most Applied</Typography>
                        {wrappedStats.mostApplied.map((s, i) => (
                          <Typography key={i} variant="body2" sx={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>
                            <Box component="span" sx={{ color: '#a29bfe', mr: 0.5 }}>●</Box>{s.name} — {s.value}x
                          </Typography>
                        ))}
                        {wrappedStats.mostApplied.length === 0 && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>—</Typography>}
                      </Box>
                      <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                        <Typography variant="body1" sx={{ color: '#fff', fontWeight: 700 }}>Winrate: {wrappedStats.winrate}%</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>(Win: {wrappedStats.totalShowWin}x, Lose: {wrappedStats.totalShowLose}x)</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', mb: 0.5 }}>Video Call / MnG</Typography>
                        {wrappedStats.topVC.map((s, i) => (
                          <Typography key={i} variant="body2" sx={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>
                            <Box component="span" sx={{ color: '#0abde3', mr: 0.5 }}>●</Box>{s.name} — {s.value}
                          </Typography>
                        ))}
                        {wrappedStats.topVC.length === 0 && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>—</Typography>}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', mb: 0.5 }}>2Shot</Typography>
                        {wrappedStats.top2Shot.map((s, i) => (
                          <Typography key={i} variant="body2" sx={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>
                            <Box component="span" sx={{ color: '#ff6b8a', mr: 0.5 }}>●</Box>{s.name} — {s.value}
                          </Typography>
                        ))}
                        {wrappedStats.top2Shot.length === 0 && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>—</Typography>}
                      </Box>
                      <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, cursor: 'pointer' }} onClick={() => setTopupRevealed(v => !v)}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Total Top-Up</Typography>
                        <Typography variant="body1" sx={{ color: '#fff', fontWeight: 700, filter: topupRevealed ? 'none' : 'blur(8px)', userSelect: 'none', transition: 'filter 0.3s ease' }}>
                          {topupRevealed ? `${wrappedStats.totalTopup.toLocaleString()} P` : '🔒 Click to reveal'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, position: 'relative' }}>
                      <Button className="screenshot-btn" variant="outlined" size="small" startIcon={<Download />} onClick={handleWrappedExport} disabled={exporting}
                        sx={{ color: '#fff', borderColor: 'rgba(229,0,20,0.4)', borderRadius: 2, fontSize: 12, '&:hover': { bgcolor: 'rgba(229,0,20,0.12)', borderColor: '#E50014' } }}>
                        {exporting ? 'Exporting...' : 'Screenshot'}
                      </Button>
                    </Box>
                  </Box>

                  {/* Back Button */}
                  <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={() => setShowWrapped(false)}
                    sx={{ mt: 3, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', px: 4, py: 1.5, fontSize: 14, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.4)' } }}>
                    Back to Stats
                  </Button>
                </Box>
              )}

              {viewMode === 'full' && !showWrapped && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, mt: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <ConfirmationNumber sx={{ color: '#E50014', fontSize: 28 }} />
                      <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
                        Ticket Stats
                      </Typography>
                    </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Year:</Typography>
                  <Select
                    value={ticketYear}
                    onChange={(e) => setTicketYear(e.target.value)}
                    size="small"
                    sx={{
                      color: '#fff',
                      height: 32,
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,0,20,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                      '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                      fontSize: 13,
                    }}
                    MenuProps={{
                      PaperProps: { sx: { bgcolor: '#1a1a2e', '& .MuiMenuItem-root': { color: '#fff', fontSize: 13 } } }
                    }}
                  >
                    <MenuItem value="all">All Time</MenuItem>
                    {stats.availableYears.map((y) => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                  <Button startIcon={<AutoAwesome />} onClick={() => { setShowWrapped(true); setTopupRevealed(false); }}
                    sx={{ color: '#fff', border: '1px solid rgba(229,0,20,0.4)', borderRadius: 2, px: 2, height: 32, fontSize: 13, '&:hover': { bgcolor: 'rgba(229,0,20,0.12)', borderColor: '#E50014' } }}>
                    Wrapped
                  </Button>
                </Box>
              </Box>

              {/* Summary stat cards */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(5,1fr)' },
                  gap: 2,
                  width: '100%',
                  maxWidth: 900,
                }}>
                  <StatCard label="Total Tickets" value={stats.totalTickets} color="#a29bfe" icon={<ConfirmationNumber />} />
                  <StatCard label="Total VC/MnG" value={stats.totalVcMng} color="#0abde3" icon={<VideoCameraFront />} />
                  <StatCard label="Total 2Shot" value={stats.total2Shot} color="#ff6b8a" icon={<Person />} />
                  <StatCard label="Total Menang Verif" value={`${stats.totalShowWin} (${stats.totalApply > 0 ? ((stats.totalShowWin / stats.totalApply) * 100).toFixed(1) : 0}%)`} color="#1dd1a1" icon={<TheaterComedy />} />
                  <StatCard label="Kalah Verif" value={stats.totalShowLose} color="#E50014" icon={<TheaterComedy />} />
                </Box>
              </Box>

              {/* Tabs */}
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  mb: 3,
                  '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 600 },
                  '& .Mui-selected': { color: '#fff' },
                  '& .MuiTabs-indicator': { bgcolor: '#E50014' },
                }}
              >
                <Tab label="Video Call / MnG" />
                <Tab label="2Shot" />
                <Tab label="Show Wins" />
                <Tab label="Show Losses" />
                <Tab label="Most Applied" />
              </Tabs>

              {/* Tab panels */}
              {tab === 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <RankedList
                    title="Video Call / MnG — by Member"
                    icon={<VideoCameraFront sx={{ color: '#0abde3' }} />}
                    data={stats.vcMngByMember}
                    valueLabel=" tickets"
                    colorKey="#0abde3"
                  />
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.vcMngByMember.length * 40)}>
                    <BarChart data={stats.vcMngByMember} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#fff', fontSize: 12 }} width={100} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #0abde3', borderRadius: 8 }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                        {stats.vcMngByMember.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {tab === 1 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <RankedList
                    title="2Shot — by Member"
                    icon={<Person sx={{ color: '#ff6b8a' }} />}
                    data={stats.twoShotByMember}
                    valueLabel=" tickets"
                    colorKey="#ff6b8a"
                  />
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.twoShotByMember.length * 40)}>
                    <BarChart data={stats.twoShotByMember} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#fff', fontSize: 12 }} width={100} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ff6b8a', borderRadius: 8 }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                        {stats.twoShotByMember.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {tab === 2 && (
                <RankedList
                  title="Menang Verif"
                  icon={<TheaterComedy sx={{ color: '#1dd1a1' }} />}
                  data={stats.showWinNull}
                  valueLabel=" tickets"
                  colorKey="#1dd1a1"
                />
              )}

              {tab === 3 && (
                <RankedList
                  title="Kalah Verif"
                  icon={<TheaterComedy sx={{ color: '#E50014' }} />}
                  data={stats.showLose}
                  valueLabel=" attempts"
                  colorKey="#E50014"
                />
              )}

              {tab === 4 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  {/* Expandable list with transaction details */}
                  <Paper sx={{ p: 3, bgcolor: '#1a1a2e', borderRadius: 3, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TheaterComedy sx={{ color: '#a29bfe' }} />
                      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                        Most Applied — Theater Shows
                      </Typography>
                    </Box>
                    {stats.theaterApply.map((item, i) => {
                      const details = stats.theaterApplyDetails[item.name] || [];
                      return (
                        <Accordion
                          key={item.name}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.03)',
                            color: '#fff',
                            mb: 0.5,
                            '&:before': { display: 'none' },
                            borderRadius: '8px !important',
                            overflow: 'hidden',
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />}
                            sx={{ px: 2, py: 0 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 20, textAlign: 'right', flexShrink: 0 }}>
                                {i + 1}
                              </Typography>
                              <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }}>
                                {item.name}
                              </Typography>
                              <Chip
                                label={`${item.value} applications`}
                                size="small"
                                sx={{ bgcolor: '#a29bfe', color: '#fff', fontWeight: 700, fontSize: 11, mr: 1 }}
                              />
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Box sx={{ display: 'flex', gap: 1, px: 1, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, width: 130, flexShrink: 0, fontWeight: 700 }}>Transaction ID</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, width: 80, flexShrink: 0, fontWeight: 700 }}>Status</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, width: 60, flexShrink: 0, fontWeight: 700 }}>Used</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, width: 90, flexShrink: 0, fontWeight: 700 }}>Date</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flex: 1, fontWeight: 700 }}>Expired</Typography>
                              </Box>
                              {details.map((d, j) => {
                                const isWin = parseInt(d.used_count) > 0;
                                const isLose = d.raffle_status === 'LOSE';
                                const statusColor = isWin ? '#1dd1a1' : isLose ? '#E50014' : '#ffd32a';
                                const statusLabel = isWin ? 'WIN' : isLose ? 'LOSE' : 'null';
                                return (
                                  <Box key={j} sx={{ display: 'flex', gap: 1, px: 1, py: 0.4, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, width: 130, flexShrink: 0, fontFamily: 'monospace' }}>{d.txKey}</Typography>
                                    <Chip label={statusLabel} size="small" sx={{ bgcolor: `${statusColor}22`, color: statusColor, fontWeight: 700, fontSize: 10, height: 20, width: 70 }} />
                                    <Typography sx={{ color: isWin ? '#1dd1a1' : 'rgba(255,255,255,0.5)', fontSize: 11, width: 60, flexShrink: 0 }}>{d.used_count}</Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 90, flexShrink: 0 }}>{d.date ? new Date(d.date).toLocaleDateString('id-ID') : '-'}</Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flex: 1 }}>{d.expired_date ? new Date(d.expired_date).toLocaleDateString('id-ID') : '-'}</Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Paper>
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.theaterApply.slice(0,15).length * 40)}>
                    <BarChart data={stats.theaterApply.slice(0, 15)} layout="vertical" margin={{ left: 160, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#fff', fontSize: 11 }} width={155} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #a29bfe', color: '#fff' }} />
                      <Bar dataKey="value" name="Applications" radius={[0, 4, 4, 0]}>
                        {stats.theaterApply.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </>
          )}

          {/* Points History Section */}
          {pointsData.length > 0 && (
            <>
              <Divider sx={{ my: 5, borderColor: 'rgba(229,0,20,0.3)' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
                <PieChartIcon sx={{ color: '#E50014', fontSize: 32 }} />
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
                  Points History Analytics
                </Typography>
              </Box>

              {/* Points Summary Cards */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(6,1fr)' },
                gap: 2, mb: 4,
              }}>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #ff69b433', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#ff69b422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ConfirmationNumber sx={{ color: '#ff69b4', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Current Points</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{pointsStats.currentPoints.toLocaleString()} P</Typography>
                  </Box>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #2196F333', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#2196F322', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp sx={{ color: '#2196F3', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Total Topup</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{pointsStats.totalTopup.toLocaleString()} P</Typography>
                  </Box>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #4CAF5033', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#4CAF5022', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Download sx={{ color: '#4CAF50', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Total Spend</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{pointsStats.totalSpend.toLocaleString()} P</Typography>
                  </Box>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #F4433633', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#F4433622', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarToday sx={{ color: '#F44336', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Total Expired</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{pointsStats.totalExpired.toLocaleString()} P</Typography>
                  </Box>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #9C27B033', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#9C27B022', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ConfirmationNumber sx={{ color: '#9C27B0', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Service Charged</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Rp {pointsStats.totalServiceCharged.toLocaleString()}</Typography>
                  </Box>
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#1a1a2e', borderRadius: 3, border: '1px solid #FFD70033', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#FFD70022', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp sx={{ color: '#FFD700', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Total Bonus</Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{pointsStats.totalBonus.toLocaleString()} P</Typography>
                  </Box>
                </Paper>
              </Box>

              {/* Charts - 3 Column Layout */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
                {/* Pie Chart */}
                <Paper sx={{ p: 2.5, bgcolor: '#1a1a2e', borderRadius: 3, height: 380, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                    Spending by Category
                  </Typography>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pointsStats.categories}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={false}
                          >
                            {pointsStats.categories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(229,0,20,0.3)', borderRadius: 8, color: '#fff' }}
                            formatter={(value) => [`${value.toLocaleString()} P`, 'Spent']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 120, overflowY: 'auto' }}>
                      {pointsStats.categories.map((entry, index) => (
                        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)' }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                          <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 600, flex: 1 }}>{entry.name}</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{entry.value.toLocaleString()} P</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Paper>

                {/* Yearly Spending */}
                <Paper sx={{ p: 2.5, bgcolor: '#1a1a2e', borderRadius: 3, height: 380, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                    Yearly Spending
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pointsStats.yearly} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="year" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
                        <Tooltip content={BarTooltip} />
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} verticalAlign="bottom" height={36} />
                        {pointsStats.uniqueCategoryNames.map((catName, index) => (
                          <Bar key={catName} dataKey={catName} stackId="a" fill={COLORS[index % COLORS.length]} radius={[2, 2, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>

                {/* Monthly Spending */}
                <Paper sx={{ p: 2.5, bgcolor: '#1a1a2e', borderRadius: 3, height: 380, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, flex: 1 }}>
                      Monthly Spending
                    </Typography>
                    <Select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      size="small"
                      sx={{
                        color: '#fff',
                        height: 28,
                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,0,20,0.3)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                        '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                        fontSize: 12,
                      }}
                      MenuProps={{
                        PaperProps: { sx: { bgcolor: '#1a1a2e', '& .MuiMenuItem-root': { color: '#fff', fontSize: 12 } } }
                      }}
                    >
                      {pointsStats.availableYears.map((year) => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pointsStats.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
                        <Tooltip content={BarTooltip} />
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }} verticalAlign="bottom" height={36} />
                        {pointsStats.uniqueCategoryNames.map((catName, index) => (
                          <Bar key={catName} dataKey={catName} stackId="a" fill={COLORS[index % COLORS.length]} radius={[2, 2, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Box>

              {/* Transaction History Table */}
              <Paper sx={{ p: 2.5, bgcolor: '#1a1a2e', borderRadius: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    Transaction History
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Category:</Typography>
                    <Select
                      value={txCategoryFilter}
                      onChange={(e) => { setTxCategoryFilter(e.target.value); setTxPage(0); }}
                      size="small"
                      sx={{
                        color: '#fff',
                        height: 28,
                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,0,20,0.3)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                        '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                        fontSize: 12,
                      }}
                      MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a2e', '& .MuiMenuItem-root': { color: '#fff', fontSize: 12 } } } }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      {Array.from(new Set(pointsData.map(r => r.category || 'Unknown'))).sort().map((cat) => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ID</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Purpose</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Category</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Points Changed</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Service Charge</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = txCategoryFilter === 'all' ? pointsData : pointsData.filter(r => (r.category || 'Unknown') === txCategoryFilter);
                        return filtered
                          .slice(txPage * txRowsPerPage, txPage * txRowsPerPage + txRowsPerPage)
                          .map((row, i) => {
                            const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
                            const sc = parseFloat(row.serviceCharge) || 0;
                            const isPositive = points > 0;
                            const isExpired = (row.purpose || '').trim() === 'Masa Berlaku Habis';
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.6)' }}>{row.date || '-'}</td>
                                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: 11 }}>{row.id || '-'}</td>
                                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)' }}>{row.purpose || row.title || '-'}</td>
                                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.6)' }}>{row.category || '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: isPositive ? '#4CAF50' : isExpired ? '#F44336' : 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                                  {points > 0 ? '+' : ''}{points.toLocaleString()} P
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>
                                  {sc > 0 ? `Rp ${sc.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    bgcolor: isPositive ? 'rgba(76,175,80,0.15)' : isExpired ? 'rgba(244,67,54,0.15)' : 'rgba(255,255,255,0.08)',
                                    color: isPositive ? '#4CAF50' : isExpired ? '#F44336' : 'rgba(255,255,255,0.5)',
                                  }}>
                                    {row.status || '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {(() => {
                      const filtered = txCategoryFilter === 'all' ? pointsData : pointsData.filter(r => (r.category || 'Unknown') === txCategoryFilter);
                      const start = txPage * txRowsPerPage + 1;
                      const end = Math.min((txPage + 1) * txRowsPerPage, filtered.length);
                      return filtered.length > 0 ? `${start}–${end} of ${filtered.length}` : 'No records';
                    })()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Rows:</Typography>
                    <Select
                      value={txRowsPerPage}
                      onChange={(e) => { setTxRowsPerPage(e.target.value); setTxPage(0); }}
                      size="small"
                      sx={{
                        color: '#fff',
                        height: 28,
                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,0,20,0.3)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#E50014' },
                        '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                        fontSize: 12,
                      }}
                      MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a2e', '& .MuiMenuItem-root': { color: '#fff', fontSize: 12 } } } }}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <MenuItem key={n} value={n}>{n}</MenuItem>
                      ))}
                    </Select>
                    <Button size="small" disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}
                      sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28, px: 1, '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' } }}>‹</Button>
                    <Typography sx={{ color: '#fff', fontSize: 12, minWidth: 40, textAlign: 'center' }}>
                      {(() => {
                        const filtered = txCategoryFilter === 'all' ? pointsData : pointsData.filter(r => (r.category || 'Unknown') === txCategoryFilter);
                        return `${txPage + 1} / ${Math.ceil(filtered.length / txRowsPerPage) || 1}`;
                      })()}
                    </Typography>
                    <Button size="small" disabled={(() => {
                      const filtered = txCategoryFilter === 'all' ? pointsData : pointsData.filter(r => (r.category || 'Unknown') === txCategoryFilter);
                      return (txPage + 1) * txRowsPerPage >= filtered.length;
                    })()} onClick={() => setTxPage(p => p + 1)}
                      sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28, px: 1, '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' } }}>›</Button>
                  </Box>
                </Box>
              </Paper>
                </>
              )}
            </>
          )}

        </Container>
      </Box>
    </>
  );
};

export default TicketHistory;
