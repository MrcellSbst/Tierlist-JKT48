import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { Box } from '@mui/material'
import Homepage, { HomepageTierlist } from './Homepage'
import Tierlist from './Tierlist'
import TierlistLagu from './Tierlist_Lagu'
import Calculator from './Calculator'
import PointHistory from './PointHistory'
import NotFound from './components/NotFound'
import Footer from './components/Footer'
import ViewportManager from './components/ViewportManager'
import DreamSetlist from './Dream_Setlist';
import RoulettePage from './roulette';
import './styles/App.css'

const DisabledFeature = () => (
  <Box
    sx={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      px: 3,
    }}
  >
    <div>
      <h1 className="home-title">This or That is temporarily disabled</h1>
      <p>We&apos;re doing some maintenance on this feature. Please check back later.</p>
      <Link to="/" className="home-button back">Back to Homepage</Link>
    </div>
  </Box>
)

function App() {
  return (
    <Router>
      <ViewportManager />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/homepagetierlist" element={<HomepageTierlist />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/tierlist" element={<Tierlist />} />
            <Route path="/tierlist_lagu" element={<TierlistLagu />} />
            <Route path="/dream-setlist" element={<DreamSetlist />} />
            <Route path="/point-history" element={<PointHistory />} />
            <Route path="/roulette" element={<RoulettePage />} />
            <Route path="/this-or-that/*" element={<DisabledFeature />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
      <Analytics />
    </Router>
  )
}

export default App 
