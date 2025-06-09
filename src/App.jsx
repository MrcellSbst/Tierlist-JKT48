import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { Box } from '@mui/material'
import Homepage from './Homepage'
import Tierlist from './Tierlist'
import TierlistLagu from './Tierlist_Lagu'
import HomepageTierlist from './HomepageTierlist'
import Calculator from './Calculator'
import PointHistory from './PointHistory'
import NotFound from './components/NotFound'
import Footer from './components/Footer'
import ViewportManager from './components/ViewportManager'

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
            <Route path="/point-history" element={<PointHistory />} />
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