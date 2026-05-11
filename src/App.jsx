import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Box, CircularProgress } from '@mui/material'
import NotFound from './components/NotFound'
import Footer from './components/Footer'
import ViewportManager from './components/ViewportManager'
import './styles/App.css'

// Lazy-loaded page components — each becomes its own JS chunk
const Homepage        = lazy(() => import('./Homepage'))
const HomepageTierlist = lazy(() => import('./Homepage').then(m => ({ default: m.HomepageTierlist })))
const HomepageTools   = lazy(() => import('./Homepage').then(m => ({ default: m.HomepageTools })))
const HomepageGames   = lazy(() => import('./Homepage').then(m => ({ default: m.HomepageGames })))
const TierlistCombined = lazy(() => import('./Tierlist_Combined'))
const Calculator      = lazy(() => import('./Calculator'))
const PointHistory    = lazy(() => import('./PointHistory'))
const DreamSetlist    = lazy(() => import('./Dream_Setlist'))
const RoulettePage    = lazy(() => import('./roulette'))
const GachaPage       = lazy(() => import('./Gacha'))
const MobileTierlist  = lazy(() => import('./Mobile_Tierlist'))
const GuessWho        = lazy(() => import('./GuessWho'))

const PageLoader = () => (
  <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <CircularProgress />
  </Box>
)


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
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </Box>
        <Footer />
      </Box>
      <Analytics />
      <SpeedInsights />
    </Router>
  )
}

export default App 
