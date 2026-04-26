import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Box } from '@mui/material'
import Homepage, { HomepageTierlist, HomepageTools, HomepageGames } from './Homepage'
import TierlistCombined from './Tierlist_Combined'
import Calculator from './Calculator'
import PointHistory from './PointHistory'
import NotFound from './components/NotFound'
import Footer from './components/Footer'
import ViewportManager from './components/ViewportManager'
import DreamSetlist from './Dream_Setlist';
import RoulettePage from './roulette';
import GachaPage from './Gacha';
import MobileTierlist from './Mobile_Tierlist';
import GuessWho from './GuessWho';
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
            <Route path="/tools" element={<HomepageTools />} />
            <Route path="/games" element={<HomepageGames />} />
            <Route path="/homepagetierlist" element={<HomepageTierlist />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/tierlist" element={<TierlistCombined />} />
            <Route path="/tierlist_lagu" element={<TierlistCombined />} />
            <Route path="/dream-setlist" element={<DreamSetlist />} />
            <Route path="/point-history" element={<PointHistory />} />
            <Route path="/roulette" element={<RoulettePage />} />
            <Route path="/mobile-tierlist" element={<MobileTierlist />} />
            <Route path="/gacha" element={<GachaPage />} />
            <Route path="/guess-who" element={<GuessWho />} />
            <Route path="/this-or-that/*" element={<DisabledFeature />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </Router>
  )
}

export default App 
