import React, { useState, useEffect, useMemo } from 'react';
import {
  Container, Typography, Box, Paper, Alert, Button, Chip, Link,
  Tabs, Tab, Avatar, Divider, Accordion, AccordionSummary, AccordionDetails,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ArrowBack, Refresh, ConfirmationNumber, TheaterComedy, Person, VideoCameraFront, Download } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

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

function applicationKey(ticket) {
  const tx = ticket.transaction_numbers?.[0] || '';
  return `${tx}|${dateOnly(ticket.date)}`;
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

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  '#E50014', '#ff6b8a', '#ff9f43', '#ffd32a',
  '#0abde3', '#48dbfb', '#1dd1a1', '#10ac84',
  '#5f27cd', '#a29bfe', '#fd79a8', '#fdcb6e',
];

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
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{label}</Typography>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>{value}</Typography>
      </Box>
    </Paper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TicketHistory = () => {
  const [ticketsData, setTicketsData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  const handleExportTxt = () => {
    if (!ticketsData.length) return;
    const payload = { data: ticketsData, timestamp: lastUpdate, exportedAt: new Date().toISOString() };
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jkt48_tickets_raw_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
      setLastUpdate(parsed.timestamp);
      setError('');
    } catch (e) {
      setError('Error loading ticket data: ' + e.message);
    }
  };

  useEffect(() => {
    loadTickets();
    const onUpdate = () => loadTickets();
    const onStorage = (e) => {
      if (e.key === 'jkt48_tickets_history' || e.key === null) loadTickets();
    };
    window.addEventListener('JKT48_TICKETS_HISTORY_UPDATED', onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('JKT48_TICKETS_HISTORY_UPDATED', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // ─── Stats computation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // loseTransactions: ticketDedupKeys of all LOSE entries.
    // Used to block phantom nulls that are the exact same record as a LOSE entry.
    // For 2026+ format: null and LOSE of the same application have DIFFERENT expired_dates
    // → different ticketDedupKeys → null is NOT in loseTransactions → counted in Step B.
    // This is intentional: Step A counts LOSE, Step B counts the null, but seenApplyNull
    // deduplication ensures each unique (txKey|date|expired) is only counted once.
    const loseTransactions = new Set(); // ticketDedupKey
    const loseAppKeys = new Set();      // applicationKey — used for win check only
    for (const ticket of ticketsData) {
      if (ticket.raffle_status === 'LOSE') {
        loseTransactions.add(ticketDedupKey(ticket));
        loseAppKeys.add(applicationKey(ticket));
      }
    }

    // ── Won tickets: deduplicated, no LOSE ──────────────────────────────────
    const validTickets = processTickets(ticketsData);

    const vcByMember    = {};
    const twoShotByMember = {};
    const mngByMember   = {};
    const showWinByLabel = {};

    let totalVC = 0, total2Shot = 0, totalMnG = 0, totalShowWin = 0;

    for (const ticket of validTickets) {
      const { eventType, member_name, ticket_label, name } = ticket;
      const label  = ticket_label || name;
      const bought = parseInt(ticket.bought_count || '1') || 1;
      const dedupKey = ticketDedupKey(ticket);

      if (eventType === 'Video Call' && member_name) {
        vcByMember[member_name] = (vcByMember[member_name] || 0) + bought;
        totalVC += bought;
      } else if (eventType === '2Shot' && member_name) {
        twoShotByMember[member_name] = (twoShotByMember[member_name] || 0) + bought;
        total2Shot += bought;
      } else if (eventType === 'Meet and Greet' && member_name) {
        mngByMember[member_name] = (mngByMember[member_name] || 0) + bought;
        totalMnG += bought;
      } else if (eventType && eventType.startsWith('Show')) {
        const isAttended    = parseInt(ticket.used_count || '0') > 0;
        const expDate       = new Date(ticket.expired_date || ticket.date || 0);
        const isPast        = expDate < new Date();
        // Use applicationKey (txKey|date) for the win check: if ANY LOSE entry exists
        // for the same show date, this null is not an upcoming win.
        const isUpcomingWin = !isPast && !loseAppKeys.has(applicationKey(ticket));

        if (isAttended || isUpcomingWin) {
          showWinByLabel[label] = (showWinByLabel[label] || 0) + bought;
          totalShowWin += bought;
        }
      }
    }

    // ── Show losses ─────────────────────────────────────────────────────────
    //
    // Three-pass approach to avoid ordering bugs:
    //
    // Pass 1 — explicit LOSE entries (authoritative for 2026+ format).
    //   Catches losses even when the phantom null entry for the same transaction
    //   appears first in the data with a still-future expired_date (which would
    //   cause a single-pass loop to miss the loss entirely).
    //
    // Pass 2 — null-only entries with no LOSE counterpart (pre-2026 format).
    //   Past + not attended + no LOSE sibling = old-style raffle loss.
    //
    // Pass 3 — Most Applied: every unique SHOW transaction (wins + losses).

    const showLose     = {};
    const theaterApply = {};
    let totalShowLose  = 0;

    // Pass 1: count unique LOSE transactions
    const seenLose = new Set();
    for (const ticket of ticketsData) {
      if (ticket.raffle_status !== 'LOSE' || ticket.ticket_type !== 'SHOW') continue;
      const dedupKey = ticketDedupKey(ticket);
      if (seenLose.has(dedupKey)) continue;
      seenLose.add(dedupKey);
      const label  = ticket.ticket_label || ticket.name;
      const bought = parseInt(ticket.bought_count || '1') || 1;
      showLose[label]  = (showLose[label] || 0) + bought;
      totalShowLose   += bought;
    }

    // Pass 2: pre-2026 null-only losses (no LOSE with same ticketDedupKey, past, not attended)
    const seenNullLose = new Set();
    for (const ticket of ticketsData) {
      if (ticket.ticket_type !== 'SHOW' || ticket.raffle_status !== null) continue;
      const dk = ticketDedupKey(ticket);
      // Skip if already counted (exact duplicate across pages)
      if (seenLose.has(dk) || seenNullLose.has(dk)) continue;
      seenNullLose.add(dk);
      const isAttended = parseInt(ticket.used_count || '0') > 0;
      const expDate    = new Date(ticket.expired_date || ticket.date || 0);
      const isPast     = expDate < new Date();
      if (isPast && !isAttended) {
        const label  = ticket.ticket_label || ticket.name;
        const bought = parseInt(ticket.bought_count || '1') || 1;
        showLose[label]  = (showLose[label] || 0) + bought;
        totalShowLose   += bought;
      }
    }

    // Pass 3: Most Applied
    // Strategy:
    //   Step A — count each unique LOSE entry (ticketDedupKey dedup).
    //            One LOSE entry = one lost application, regardless of API format.
    //   Step B — count null entries that have NO LOSE counterpart (applicationKey check).
    //            These are wins, upcoming wins, or pre-2026 null-only apps.
    //            Null entries that DO have a LOSE sibling are phantom duplicates → skip.
    //
    // Why not applicationKey for everything?
    //   Pre-2026 lost apps can have SAME txKey + SAME date for two separate
    //   applications (e.g. OSH606787 applied twice on the same date).
    //   applicationKey would incorrectly collapse them to 1.
    // Pass 3: Most Applied
    // Rule: same (txKey + date + expired_date) = same application/page-duplicate → count once.
    //        different expired_date = different application → count separately.
    // One pass, ticketDedupKey dedup only. No null/LOSE pairing needed.
    const theaterApplyDetails = {};
    const seenApply = new Set();
    for (const ticket of ticketsData) {
      if (ticket.ticket_type !== 'SHOW') continue;
      const dk = ticketDedupKey(ticket);
      const tx = ticket.transaction_numbers?.[0] || '';
      if (tx === 'OSH607708') console.log('[DEBUG OSH607708]', dk, 'seen?', seenApply.has(dk));
      if (seenApply.has(dk)) continue;
      seenApply.add(dk);
      if (tx === 'OSH607708') console.log('[DEBUG OSH607708] COUNTED', dk);
      const label  = ticket.ticket_label || ticket.name;
      const bought = parseInt(ticket.bought_count || '1') || 1;
      theaterApply[label] = (theaterApply[label] || 0) + bought;
      if (!theaterApplyDetails[label]) theaterApplyDetails[label] = [];
      theaterApplyDetails[label].push({
        txKey: ticket.transaction_numbers?.[0] || 'N/A',
        raffle_status: ticket.raffle_status,
        used_count: ticket.used_count || '0',
        date: ticket.date,
        expired_date: ticket.expired_date,
        reference_code: ticket.reference_code,
      });
    }

    const toSorted = (obj) =>
      Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return {
      vcByMember:      toSorted(vcByMember),
      twoShotByMember: toSorted(twoShotByMember),
      mngByMember:     toSorted(mngByMember),
      showWinNull:     toSorted(showWinByLabel),
      showLose:        toSorted(showLose),
      theaterApply:    toSorted(theaterApply),
      theaterApplyDetails,
      totalVC, total2Shot, totalMnG, totalShowWin, totalShowLose,
      totalTickets: validTickets.length,
    };
  }, [ticketsData]);

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
        {lastUpdate && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Updated: {new Date(lastUpdate).toLocaleString('id-ID')}
          </Typography>
        )}
        <Button startIcon={<Refresh />} onClick={loadTickets}
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          Refresh
        </Button>
        <Button
          startIcon={<Download />}
          onClick={handleExportTxt}
          disabled={!ticketsData.length}
          sx={{
            color: 'white',
            border: '1px solid rgba(229,0,20,0.4)',
            borderRadius: 2,
            px: 2,
            '&:hover': { bgcolor: 'rgba(229,0,20,0.12)', borderColor: '#E50014' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.1)' },
          }}
        >
          Export Raw
        </Button>
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
              {/* Summary stat cards */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(6,1fr)' },
                gap: 2, mt: 3, mb: 4,
              }}>
                <StatCard label="Total Tickets" value={stats.totalTickets} color="#a29bfe" icon={<ConfirmationNumber />} />
                <StatCard label="Video Calls Won" value={stats.totalVC} color="#0abde3" icon={<VideoCameraFront />} />
                <StatCard label="2Shot Won" value={stats.total2Shot} color="#ff6b8a" icon={<Person />} />
                <StatCard label="MnG Won" value={stats.totalMnG} color="#ffd32a" icon={<Person />} />
                <StatCard label="Show Wins" value={stats.totalShowWin} color="#1dd1a1" icon={<TheaterComedy />} />
                <StatCard label="Show Losses" value={stats.totalShowLose} color="#E50014" icon={<TheaterComedy />} />
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
                <Tab label="📹 Video Call" />
                <Tab label="📸 2Shot" />
                <Tab label="🤝 Meet & Greet" />
                <Tab label="🎭 Show Wins" />
                <Tab label="🎰 Show Losses" />
                <Tab label="📋 Most Applied" />
              </Tabs>

              {/* Tab panels */}
              {tab === 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <RankedList
                    title="Video Call — by Member"
                    icon={<VideoCameraFront sx={{ color: '#0abde3' }} />}
                    data={stats.vcByMember}
                    valueLabel=" tickets"
                    colorKey="#0abde3"
                  />
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.vcByMember.length * 40)}>
                    <BarChart data={stats.vcByMember} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#fff', fontSize: 12 }} width={100} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #0abde3', color: '#fff' }} />
                      <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                        {stats.vcByMember.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ff6b8a', color: '#fff' }} />
                      <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                        {stats.twoShotByMember.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {tab === 2 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <RankedList
                    title="Meet & Greet — by Member"
                    icon={<Person sx={{ color: '#ffd32a' }} />}
                    data={stats.mngByMember}
                    valueLabel=" tickets"
                    colorKey="#ffd32a"
                  />
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.mngByMember.length * 40)}>
                    <BarChart data={stats.mngByMember} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#fff', fontSize: 12 }} width={100} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffd32a', color: '#fff' }} />
                      <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                        {stats.mngByMember.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {tab === 3 && (
                <RankedList
                  title="Show Wins (raffle_status = null)"
                  icon={<TheaterComedy sx={{ color: '#1dd1a1' }} />}
                  data={stats.showWinNull}
                  valueLabel=" tickets"
                  colorKey="#1dd1a1"
                />
              )}

              {tab === 4 && (
                <RankedList
                  title="Show Losses (raffle_status = LOSE)"
                  icon={<TheaterComedy sx={{ color: '#E50014' }} />}
                  data={stats.showLose}
                  valueLabel=" attempts"
                  colorKey="#E50014"
                />
              )}

              {tab === 5 && (
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

        </Container>
      </Box>
    </>
  );
};

export default TicketHistory;
