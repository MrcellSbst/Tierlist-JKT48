import React, { useState, useEffect, useMemo } from 'react';
import { 
    Container,
    Typography,
    Box,
    Paper,
    TableContainer,
    TablePagination,
    Alert,
    Link,
    Button,
    Chip,
    Grid,
    Select,
    MenuItem
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowBack, Download, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, parse, startOfMonth } from 'date-fns';
import { POINT_HISTORY_COLORS, POINT_HISTORY_CATEGORIES } from './data/PointHistoryData';

const TYPE_LABELS = {
    'EXCLUSIVE': 'VC/MnG',
    'OFC_REGISTER': 'Membership Official',
};

const mapCategoryLabel = (raw) => {
    if (!raw || raw === '-') return 'Others';
    return TYPE_LABELS[raw.toUpperCase().trim()] || raw;
};

const PointHistory = () => {
    const [pointsData, setPointsData] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const navigate = useNavigate();

    const loadPointsHistory = () => {
        console.log('[JKT48 App] Attempting to load points history');
        console.log('[JKT48 App] Current URL:', window.location.href);
        console.log('[JKT48 App] Checking localStorage availability:', !!window.localStorage);
        
        try {
            // Try to access localStorage
            const testKey = '__test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            
            const savedData = localStorage.getItem('jkt48_points_history');
            console.log('[JKT48 App] Raw data from localStorage:', savedData);
            
            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    console.log('[JKT48 App] Parsed data:', parsedData);
                    
                    if (!parsedData.data || !Array.isArray(parsedData.data)) {
                        console.error('[JKT48 App] Invalid data structure:', parsedData);
                        setError('Invalid data structure in storage');
                        return;
                    }
                    
                    setPointsData(parsedData.data || []);
                    setLastUpdate(parsedData.timestamp);
                    setError('');
                    
                    console.log('[JKT48 App] Data loaded successfully');
                } catch (parseError) {
                    console.error('[JKT48 App] Error parsing data:', parseError);
                    setError('Error parsing stored data: ' + parseError.message);
                }
            } else {
                console.log('[JKT48 App] No data found in localStorage');
                setError('No points history found. Please use the Chrome extension to save your points history first.');
            }
        } catch (error) {
            console.error('[JKT48 App] Error accessing localStorage:', error);
            setError('Error accessing localStorage: ' + error.message);
        }
    };

    useEffect(() => {
        console.log('[JKT48 App] Component mounted');
        
        // Immediate load attempt
        loadPointsHistory();

        // Set up event listeners
        const handleUpdate = (event) => {
            console.log('[JKT48 App] Received update event:', event);
            loadPointsHistory();
        };

        const handleStorageChange = (e) => {
            console.log('[JKT48 App] Storage event detected:', e);
            if (e.key === 'jkt48_points_history' || e.key === null) {
                console.log('[JKT48 App] Points history storage changed');
                loadPointsHistory();
            }
        };

        // Add event listeners
        window.addEventListener('JKT48_POINTS_HISTORY_UPDATED', handleUpdate);
        window.addEventListener('storage', handleStorageChange);

        // Check localStorage every 2 seconds for changes
        const intervalId = setInterval(() => {
            const currentData = localStorage.getItem('jkt48_points_history');
            if (currentData && (!pointsData || pointsData.length === 0)) {
                console.log('[JKT48 App] Found data in periodic check');
                loadPointsHistory();
            }
        }, 2000);

        return () => {
            window.removeEventListener('JKT48_POINTS_HISTORY_UPDATED', handleUpdate);
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(intervalId);
        };
    }, []);

    const calculateCurrentPoints = () => {
        return pointsData.reduce((total, row) => {
            const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
            const method = String(row.paymentMethod || '').toUpperCase();
            const purpose = (row.purpose || '').trim().toUpperCase();

            // Current Points should only increase on Topups, and decrease ONLY if they paid using JKT48 Points!
            if (purpose === 'PEMBELIAN POIN JKT48' || method.includes('POINT') || method.includes('POIN') || !row.paymentMethod) {
                return total + points;
            }
            return total;
        }, 0);
    };

    const calculateTotalSpend = () => {
        return pointsData.reduce((total, row) => {
            if ((row.purpose || '').trim() === 'Masa Berlaku Habis') return total;
            const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
            return total + (points < 0 ? Math.abs(points) : 0);
        }, 0);
    };

    const calculateTotalTopup = () => {
        console.log('Calculating total topup...');
        console.log('Total rows in pointsData:', pointsData.length);
        
        return pointsData.reduce((total, row) => {
            const purpose = (row.purpose || '').trim().toUpperCase();
            const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
            console.log('Processing row:', { 
                originalPurpose: row.purpose,
                normalizedPurpose: purpose,
                points,
                buyPointsRaw: row.buyPoints 
            });
            
            if (purpose === 'PEMBELIAN POIN JKT48' && points > 0) {
                console.log('Found topup:', points);
                return total + points;
            }
            return total;
        }, 0);
    };

    const calculateTotalExpired = () => {
        return pointsData.reduce((total, row) => {
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

    const chartData = useMemo(() => {
        const categoryData = {};
        const monthlyData = {};
        const yearlyData = {};
        const availableYears = new Set();
        const uniqueCategories = new Set();

        // Define all months
        const allMonths = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // Initialize monthly data with zero values for all months
        allMonths.forEach(month => {
            monthlyData[`${month} ${selectedYear}`] = { month: month };
        });

        console.log('Processing points data for charts:', pointsData);

        pointsData.forEach(row => {
            const purp = (row.purpose || '').trim();
            if (purp === 'Pembelian Poin JKT48' || purp === 'Masa Berlaku Habis') {
                return;
            }

            const points = parseInt(String(row.buyPoints || '0').replace(/[P,]/g, '').trim()) || 0;
            
            if (points >= 0) {
                console.log('Skipping non-spending transaction:', row);
                return;
            }

            let categoryRaw = (row.category || '').trim();
            if (categoryRaw === '-' || categoryRaw === '') categoryRaw = 'Others';

            // Normalize type labels using shared mapping
            const category = mapCategoryLabel(categoryRaw);

            uniqueCategories.add(category);

            console.log('Detected category:', category, 'from type:', row.category);

            const spendingAmount = Math.abs(points);
            if (!categoryData[category]) {
                categoryData[category] = 0;
            }
            categoryData[category] += spendingAmount;

            try {
                let date;
                // Check if date is already an ISO string
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

                if (isNaN(date.getTime())) {
                    date = new Date();
                }

                const monthKey = format(startOfMonth(date), 'MMM yyyy');
                const yearKey = format(date, 'yyyy');
                
                availableYears.add(yearKey);

                if (yearKey === selectedYear) {
                    if (!monthlyData[monthKey]) monthlyData[monthKey] = { month: monthKey.split(' ')[0] };
                    monthlyData[monthKey][category] = (monthlyData[monthKey][category] || 0) + spendingAmount;
                }

                if (!yearlyData[yearKey]) {
                    yearlyData[yearKey] = { year: yearKey };
                }
                yearlyData[yearKey][category] = (yearlyData[yearKey][category] || 0) + spendingAmount;
            } catch (error) {
                console.error('Error parsing date:', error, 'for row:', row);
            }
        });

        console.log('Final category data:', categoryData);
        console.log('Final monthly data:', monthlyData);
        console.log('Final yearly data:', yearlyData);

        // Convert monthly data to array format with all months
        const sortedMonthly = allMonths.map(month => {
            const mKey = `${month} ${selectedYear}`;
            return monthlyData[mKey] || { month };
        });

        const sortedYearly = Object.values(yearlyData)
            .sort((a, b) => a.year.localeCompare(b.year));

        const categories = Object.entries(categoryData)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return {
            categories,
            monthly: sortedMonthly,
            yearly: sortedYearly,
            availableYears: Array.from(availableYears).sort().reverse(),
            uniqueCategoryNames: Array.from(uniqueCategories)
        };
    }, [pointsData, selectedYear]);

    const handleExportCSV = () => {
        if (!pointsData.length) return;

        const headers = ['Operation', 'ID', 'Date', 'Purpose', 'Quantity', 'Bonus Points', 'Buy Points', 'Status'];
        const csvContent = [
            headers,
            ...pointsData.map(row => [
                row.operation,
                row.id,
                row.date,
                row.purpose,
                row.quantity,
                row.bonusPoints,
                row.buyPoints,
                row.status
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'jkt48_points_history.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const columns = [
        { field: 'id', headerName: 'No. Transaction', flex: 1.2 },
        { field: 'date', headerName: 'Date', flex: 1 },
        { field: 'category', headerName: 'Category', flex: 1 },
        { field: 'title', headerName: 'Title', flex: 1.5 },
        { field: 'quantity', headerName: 'Quantity', flex: 0.7 },
        { field: 'bonusPoints', headerName: 'Bonus Points', flex: 1 },
        { field: 'buyPoints', headerName: 'Points Changed', flex: 1 },
        { field: 'status', headerName: 'Status', flex: 0.7 }
        
    ];

    const rows = pointsData.map((row, index) => ({
        date: String(row.date || '-'),
        category: mapCategoryLabel(String(row.category || '-')),
        title: String(row.title || row.purpose || '-'),
        quantity: String(row.quantity || '0'),
        bonusPoints: String(row.bonusPoints || '0 P'),
        buyPoints: String(row.buyPoints || '0 P'),
        status: String(row.status || '-'),
        paymentMethod: String(row.paymentMethod || '-'),
        id: row.id || `api-fallback-${index}-${Math.random().toString(36).substr(2, 5)}`
    }));

    return (
        <>
            <Box 
                sx={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 1000,
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Button
                    startIcon={<ArrowBack />}
                    onClick={() => navigate('/')}
                    sx={{ 
                        color: 'white',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    Back
                </Button>
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1, color: 'white' }}>
                    JKT48 Points History
                </Typography>
                <Button
                    startIcon={<Refresh />}
                    onClick={loadPointsHistory}
                    sx={{ 
                        color: 'white',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    Refresh
                </Button>
                <Button
                    startIcon={<Download />}
                    onClick={handleExportCSV}
                    disabled={!pointsData.length}
                    sx={{ 
                        color: 'white',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)'
                        },
                        '&.Mui-disabled': {
                            color: 'rgba(255, 255, 255, 0.3)'
                        }
                    }}
                >
                    Export CSV
                </Button>
            </Box>

            <Container maxWidth="lg" sx={{ mt: 10, mb: 4 }}>
                {lastUpdate && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                            Last updated: {format(new Date(lastUpdate), 'dd MMM yyyy HH:mm:ss')}
                        </Typography>
                    </Box>
                )}

                {!pointsData.length ? (
                    <>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            No points history found. To get started:
                            <Box sx={{ mt: 2 }}>
                                <ol style={{ marginTop: 8, marginBottom: 0 }}>
                                    <li>Install the JKT48 Points History Exporter extension</li>
                                    <li>Login to <Link href="https://jkt48.com" target="_blank" rel="noopener">JKT48.com</Link></li>
                                    <li>Go to <Link href="https://jkt48.com/mypage/point-history?lang=id" target="_blank" rel="noopener">Points History page</Link></li>
                                    <li>Click the extension icon and click "Export Points History"</li>
                                    <li>The data will automatically appear on this page</li>
                                </ol>
                            </Box>
                        </Alert>
                        <Button 
                            variant="contained" 
                            onClick={() => {
                                console.log('[JKT48 App] Manual load button clicked');
                                loadPointsHistory();
                            }}
                            sx={{ mb: 2 }}
                        >
                            Manual Load from Storage
                        </Button>
                    </>
                ) : (
                    <>
                        <Box sx={{ mb: 3 }}>
                            <Paper sx={{ p: 2 }}>
                                <Box sx={{ 
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: 2
                                }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                    }}>
                                        <Typography variant="h6" sx={{ mr: 2, width: 160, flexShrink: 0 }}>
                                            Current Points:
                                        </Typography>
                                        <Chip 
                                            label={`${calculateCurrentPoints().toLocaleString()} P`}
                                            color="primary"
                                            sx={{ 
                                                fontSize: '1.2rem',
                                                padding: '20px 10px',
                                                backgroundColor: '#ff69b4',
                                                '& .MuiChip-label': { px: 2 }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                    }}>
                                        <Typography variant="h6" sx={{ mr: 2, width: 160, flexShrink: 0 }}>
                                            Total Topup:
                                        </Typography>
                                        <Chip 
                                            label={`${calculateTotalTopup().toLocaleString()} P`}
                                            color="primary"
                                            sx={{ 
                                                fontSize: '1.2rem',
                                                padding: '20px 10px',
                                                backgroundColor: '#2196F3',
                                                '& .MuiChip-label': { px: 2 }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                    }}>
                                        <Typography variant="h6" sx={{ mr: 2, width: 160, flexShrink: 0 }}>
                                            Total Spend:
                                        </Typography>
                                        <Chip 
                                            label={`${calculateTotalSpend().toLocaleString()} P`}
                                            color="primary"
                                            sx={{ 
                                                fontSize: '1.2rem',
                                                padding: '20px 10px',
                                                backgroundColor: '#4CAF50',
                                                '& .MuiChip-label': { px: 2 }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                    }}>
                                        <Typography variant="h6" sx={{ mr: 2, width: 160, flexShrink: 0 }}>
                                            Total Expired:
                                        </Typography>
                                        <Chip 
                                            label={`${calculateTotalExpired().toLocaleString()} P`}
                                            color="primary"
                                            sx={{ 
                                                fontSize: '1.2rem',
                                                padding: '20px 10px',
                                                backgroundColor: '#F44336',
                                                '& .MuiChip-label': { px: 2 }
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        gridColumn: '1 / -1'
                                    }}>
                                        <Typography variant="h6" sx={{ mr: 2, width: 160, flexShrink: 0 }}>
                                            Total Service Charged:
                                        </Typography>
                                        <Chip 
                                            label={`Rp ${calculateTotalServiceCharged().toLocaleString()}`}
                                            color="primary"
                                            sx={{ 
                                                fontSize: '1.2rem',
                                                padding: '20px 10px',
                                                backgroundColor: '#9C27B0',
                                                '& .MuiChip-label': { px: 2 }
                                            }}
                                        />
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>

                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 400, display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="h6" gutterBottom>
                                        Spending by Category
                                    </Typography>
                                    <Box sx={{ 
                                        flex: 1, 
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 2
                                    }}>
                                        <Box sx={{ width: '50%', height: '100%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData.categories}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={80}
                                                    >
                                                        {chartData.categories.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={POINT_HISTORY_COLORS[index % POINT_HISTORY_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value) => `${value.toLocaleString()} P`}
                                                        labelFormatter={(name) => `Category: ${name}`}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Box>
                                        <Box sx={{ 
                                            width: '50%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 2,
                                            overflowY: 'auto',
                                            height: '100%',
                                            pr: 1
                                        }}>
                                            {chartData.categories.map((entry, index) => (
                                                <Box 
                                                    key={entry.name}
                                                    sx={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column',
                                                        gap: 0.5
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box 
                                                            sx={{ 
                                                                width: 16, 
                                                                height: 16, 
                                                                backgroundColor: POINT_HISTORY_COLORS[index % POINT_HISTORY_COLORS.length],
                                                                flexShrink: 0,
                                                                borderRadius: '4px'
                                                            }} 
                                                        />
                                                        <Typography 
                                                            variant="subtitle1" 
                                                            sx={{ 
                                                                fontWeight: 'bold',
                                                                color: 'text.primary'
                                                            }}
                                                        >
                                                            {entry.name}
                                                        </Typography>
                                                    </Box>
                                                    <Typography 
                                                        variant="body1" 
                                                        sx={{ 
                                                            pl: 3.5,
                                                            color: 'text.secondary'
                                                        }}
                                                    >
                                                        {entry.value.toLocaleString()} P
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, height: 400, display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="h6" gutterBottom>
                                        Yearly Spending
                                    </Typography>
                                    <Box sx={{ flex: 1, position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="85%">
                                            <BarChart 
                                                data={chartData.yearly}
                                                margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="year" />
                                                <YAxis tickFormatter={(value) => `${(value / 1000)}k`} />
                                                <Tooltip 
                                                    formatter={(value, name) => [`${value.toLocaleString()} P`, name]} 
                                                />
                                                {chartData.uniqueCategoryNames.map((catName, index) => (
                                                    <Bar 
                                                        key={catName}
                                                        dataKey={catName} 
                                                        stackId="a" 
                                                        fill={POINT_HISTORY_COLORS[index % POINT_HISTORY_COLORS.length]}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12}>
                                <Paper sx={{ p: 2, height: 400, display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                            Monthly Spending
                                        </Typography>
                                        <Box sx={{ minWidth: 120, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1" sx={{ color: 'black' }}>
                                                Year:
                                            </Typography>
                                            <Select
                                                value={selectedYear}
                                                onChange={(e) => setSelectedYear(e.target.value)}
                                                size="small"
                                                sx={{ color: 'black' }}
                                            >
                                                {chartData.availableYears.map((year) => (
                                                    <MenuItem key={year} value={year}>
                                                        {year}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </Box>
                                    </Box>
                                    <Box sx={{ flex: 1, position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="85%">
                                            <BarChart 
                                                data={chartData.monthly}
                                                margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis tickFormatter={(value) => `${(value / 1000)}k`} />
                                                <Tooltip 
                                                    formatter={(value, name) => [`${value.toLocaleString()} P`, name]} 
                                                />
                                                {chartData.uniqueCategoryNames.map((catName, index) => (
                                                    <Bar 
                                                        key={catName}
                                                        dataKey={catName} 
                                                        stackId="a" 
                                                        fill={POINT_HISTORY_COLORS[index % POINT_HISTORY_COLORS.length]}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>

                        <Paper sx={{ width: '100%', mb: 2 }}>
                            <DataGrid
                                rows={rows}
                                columns={columns}
                                pageSizeOptions={[5, 10, 25, 50, 100]}
                                initialState={{
                                    pagination: {
                                        paginationModel: {
                                            pageSize: 10,
                                            page: 0
                                        },
                                    },
                                }}
                                pagination
                                autoHeight
                                getRowHeight={() => 'auto'}
                                getEstimatedRowHeight={() => 80}
                                disableSelectionOnClick
                                sx={{
                                    '& .MuiDataGrid-cell': {
                                        whiteSpace: 'normal',
                                        lineHeight: '1.4',
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingY: 1.5,
                                        paddingX: 1
                                    },
                                    '& .MuiDataGrid-row': {
                                        alignItems: 'stretch'
                                    },
                                    '& .MuiTablePagination-root': {
                                        color: 'black'
                                    },
                                    '& .MuiTablePagination-selectLabel': {
                                        color: 'black'
                                    },
                                    '& .MuiTablePagination-select': {
                                        color: 'black'
                                    },
                                    '& .MuiTablePagination-displayedRows': {
                                        color: 'black'
                                    },
                                    '& .MuiSelect-icon': {
                                        color: 'black'
                                    },
                                    '& .MuiInputBase-root': {
                                        color: 'black'
                                    },
                                    '& .MuiTablePagination-menuItem': {
                                        color: 'black'
                                    }
                                }}
                            />
                        </Paper>
                    </>
                )}
            </Container>
        </>
    );
};

export default PointHistory; 