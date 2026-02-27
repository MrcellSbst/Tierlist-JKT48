import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CalculatorPage.css';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    List,
    ListItem,
    Divider,
    Paper,
    TextField,
    ThemeProvider,
    createTheme,
    AppBar,
    Toolbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { wishlistPrices, getAllCategories, isUserDefinedPrice } from './data/wishlistpriceData';
import domtoimage from 'dom-to-image-more';
import * as XLSX from 'xlsx';
import calculatorLogo from '/asset/icon/CalculatorLogo.png';

// Create a dark theme
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#323342',
            paper: '#323342',
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
        },
    },
    components: {
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.23)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                },
            },
        },
    },
});

const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
};

const Calculator = () => {
    const navigate = useNavigate();
    const wishlistRef = useRef(null);
    const titleInputRef = useRef(null);
    const [wishlist, setWishlist] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
    const [calculatorTitle, setCalculatorTitle] = useState('');
    const [titlePosition, setTitlePosition] = useState({ left: 0, width: 0 });
    const [inputWidth, setInputWidth] = useState(300);
    const [changeCounter, setChangeCounter] = useState(0);
    const [selectedDraft, setSelectedDraft] = useState('');
    const [drafts, setDrafts] = useState([]);
    const categories = getAllCategories();

    // Function to load drafts
    const loadDrafts = () => {
        const manualDrafts = JSON.parse(localStorage.getItem('calculatorManualDrafts') || '[]');
        const autoDrafts = JSON.parse(localStorage.getItem('calculatorAutoSaveDrafts') || '[]');

        // Combine and sort drafts by date
        const allDrafts = [...manualDrafts, ...autoDrafts]
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        setDrafts(allDrafts);
        return allDrafts;
    };

    // Load drafts and initialize with latest draft on component mount
    useEffect(() => {
        const allDrafts = loadDrafts();

        // Get the specifically selected draft ID or use the most recent draft
        const draftId = localStorage.getItem('currentCalculatorDraftId');
        const draftToLoad = draftId
            ? allDrafts.find(d => d.id.toString() === draftId)
            : allDrafts[0]; // Most recent draft

        if (draftToLoad) {
            setWishlist(draftToLoad.wishlist);
            setCalculatorTitle(draftToLoad.title || '');
        }

        // Clear the current draft ID after loading
        localStorage.removeItem('currentCalculatorDraftId');
    }, []);

    // Auto-save when changeCounter reaches 2
    useEffect(() => {
        if (changeCounter >= 2 && wishlist.length > 0) {
            handleAutoSave();
            setChangeCounter(0);
        }
    }, [changeCounter, wishlist]);

    // Update change counter when wishlist changes
    useEffect(() => {
        if (wishlist.length > 0) {
            setChangeCounter(prev => prev + 1);
        }
    }, [wishlist]);

    const handleAutoSave = () => {
        if (wishlist.length === 0) return;

        const totalAmount = calculateTotal();
        const formattedTotal = formatPrice(totalAmount).replace('Rp', 'IDR');
        const baseTitle = calculatorTitle || 'Untitled Wishlist';
        const fullTitle = `${baseTitle} (${formattedTotal})`;

        const draft = {
            title: fullTitle,
            wishlist: wishlist,
            savedAt: new Date().toISOString(),
            isAutoSave: true,
            id: Date.now()
        };

        const autoDrafts = JSON.parse(localStorage.getItem('calculatorAutoSaveDrafts') || '[]');
        autoDrafts.unshift(draft);

        // Keep only the latest 3 auto-save drafts
        const updatedAutoDrafts = autoDrafts.slice(0, 3);

        localStorage.setItem('calculatorAutoSaveDrafts', JSON.stringify(updatedAutoDrafts));
        loadDrafts();
    };

    const handleSaveDraft = () => {
        if (wishlist.length === 0) {
            alert('Add some items to your wishlist first!');
            return;
        }

        const totalAmount = calculateTotal();
        const formattedTotal = formatPrice(totalAmount).replace('Rp', 'IDR');
        const baseTitle = calculatorTitle || 'Untitled Wishlist';
        const fullTitle = `${baseTitle} (${formattedTotal})`;

        const draft = {
            title: fullTitle,
            wishlist: wishlist,
            savedAt: new Date().toISOString(),
            isAutoSave: false,
            id: Date.now()
        };

        const manualDrafts = JSON.parse(localStorage.getItem('calculatorManualDrafts') || '[]');
        manualDrafts.unshift(draft);

        // Keep only the latest 5 manual drafts
        const updatedManualDrafts = manualDrafts.slice(0, 5);

        localStorage.setItem('calculatorManualDrafts', JSON.stringify(updatedManualDrafts));
        loadDrafts();
        alert('Wishlist saved as draft!');
    };

    const handleLoadDraft = (event) => {
        const draftId = event.target.value;
        console.log('Selected draft ID:', draftId); // Debug log

        if (!draftId) {
            setSelectedDraft('');
            return;
        }

        // Get fresh copies of drafts from localStorage
        const manualDrafts = JSON.parse(localStorage.getItem('calculatorManualDrafts') || '[]');
        const autoDrafts = JSON.parse(localStorage.getItem('calculatorAutoSaveDrafts') || '[]');
        const allDrafts = [...manualDrafts, ...autoDrafts];

        const draft = allDrafts.find(d => d.id.toString() === draftId.toString());
        console.log('Found draft:', draft); // Debug log

        if (draft && draft.wishlist) {
            // Update the wishlist state with the draft data
            setWishlist(prevWishlist => {
                console.log('Setting wishlist:', draft.wishlist); // Debug log
                return [...draft.wishlist];
            });

            // Update the title
            setCalculatorTitle(draft.title || '');

            // Update selected draft state
            setSelectedDraft(draftId);

            // Clear selection after a short delay
            setTimeout(() => {
                setSelectedDraft('');
            }, 100);
        }
    };

    // Add useEffect for title input width calculation
    useEffect(() => {
        const updateWidth = () => {
            if (titleInputRef.current && wishlistRef.current) {
                // Get the width of the content area for reference
                const contentArea = wishlistRef.current.querySelector('.MuiCardContent-root');
                if (!contentArea) return;

                const contentWidth = contentArea.offsetWidth;

                // Create a hidden span to measure text width
                const span = document.createElement('span');
                span.className = 'calculator-title-measure';
                span.style.font = window.getComputedStyle(titleInputRef.current).font;
                span.textContent = calculatorTitle || titleInputRef.current.placeholder;
                document.body.appendChild(span);

                // Calculate width with padding
                const textWidth = span.offsetWidth;
                const padding = 24; // 12px padding on each side
                const newWidth = Math.min(Math.max(300, textWidth + padding), contentWidth - 40); // between 300px and content width

                document.body.removeChild(span);
                setInputWidth(newWidth);

                // Update position for header title
                const contentRect = contentArea.getBoundingClientRect();
                const viewportWidth = document.documentElement.clientWidth;
                const contentCenterX = contentRect.left + (contentRect.width / 2);
                const leftPosition = (contentCenterX / viewportWidth) * 100;

                setTitlePosition({
                    left: `${leftPosition}%`,
                    transform: 'translateX(-50%)',
                    width: newWidth
                });
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [calculatorTitle]);

    const handleCategoryChange = (event) => {
        const category = event.target.value;
        setSelectedCategory(category);

        // Load default price for user-defined items if available
        if (isUserDefinedPrice(category)) {
            const categoryInfo = categories.find(cat => cat.name === category);
            if (categoryInfo && categoryInfo.price) {
                setCustomPrice(categoryInfo.price.toString());
            } else {
                setCustomPrice('');
            }
        }
    };

    const handleReset = () => {
        setWishlist([]);
        setSelectedCategory('');
        setCustomPrice('');
    };

    const handleAddItem = () => {
        if (!selectedCategory) return;

        const categoryInfo = categories.find(cat => cat.name === selectedCategory);
        if (!categoryInfo) return;

        const newItem = {
            id: Date.now(),
            category: selectedCategory,
            price: isUserDefinedPrice(selectedCategory) ? parseInt(customPrice) || 0 : categoryInfo.price,
            quantity: 1,
            description: '',
            type: categoryInfo.type,
            unit: categoryInfo.unit,
            purchased: false
        };

        setWishlist([...wishlist, newItem]);
        setSelectedCategory('');
        setCustomPrice('');
    };

    const handleRemoveItem = (id) => {
        setWishlist(wishlist.filter(item => item.id !== id));
    };

    const handleQuantityChange = (id, value) => {
        const quantity = Math.max(1, parseInt(value) || 1);
        setWishlist(wishlist.map(item =>
            item.id === id ? { ...item, quantity } : item
        ));
    };

    const handlePriceChange = (id, value) => {
        const price = Math.max(0, parseInt(value) || 0);
        setWishlist(wishlist.map(item =>
            item.id === id ? { ...item, price } : item
        ));
    };

    const handleDescriptionChange = (id, value) => {
        setWishlist(wishlist.map(item =>
            item.id === id ? { ...item, description: value } : item
        ));
    };

    const handlePurchasedChange = (id) => {
        setWishlist(wishlist.map(item =>
            item.id === id ? { ...item, purchased: !item.purchased } : item
        ));
    };

    const calculateTotal = (onlyPurchased = false) => {
        return wishlist.reduce((total, item) => {
            if (onlyPurchased ? item.purchased : !item.purchased) {
                return total + (item.price * item.quantity);
            }
            return total;
        }, 0);
    };

    const handleSaveImage = async () => {
        if (!wishlistRef.current || wishlist.length === 0) return;

        try {
            // Get the dimensions from the content area
            const contentArea = wishlistRef.current.querySelector('.MuiCardContent-root');
            if (!contentArea) return;

            // Create a temporary container for the title and wishlist
            const tempContainer = document.createElement('div');
            tempContainer.style.backgroundColor = '#323342';
            tempContainer.style.padding = '20px';
            tempContainer.style.borderRadius = '8px';
            tempContainer.style.width = `${contentArea.offsetWidth}px`;

            // Add the title if it exists
            if (calculatorTitle) {
                const titleContainer = document.createElement('div');
                titleContainer.style.width = '100%';
                titleContainer.style.display = 'flex';
                titleContainer.style.justifyContent = 'center';
                titleContainer.style.marginBottom = '20px';

                const titleDiv = document.createElement('div');
                titleDiv.style.color = 'white';
                titleDiv.style.fontSize = '32px';
                titleDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
                titleDiv.style.whiteSpace = 'nowrap';
                titleDiv.textContent = calculatorTitle;
                titleDiv.style.textAlign = 'center';

                titleContainer.appendChild(titleDiv);
                tempContainer.appendChild(titleContainer);
            }

            // Clone the wishlist content
            const contentClone = contentArea.cloneNode(true);

            // Remove any buttons and unnecessary interactive elements
            const elementsToRemove = contentClone.querySelectorAll('button, .MuiIconButton-root, .button-container');
            elementsToRemove.forEach(el => el.remove());

            // Add the content to the container
            tempContainer.appendChild(contentClone);

            // Append to measure, then capture at 2× for sharp output
            document.body.appendChild(tempContainer);

            const captureWidth = tempContainer.scrollWidth;
            const captureHeight = tempContainer.scrollHeight;
            tempContainer.style.width = `${captureWidth}px`;

            const EXPORT_SCALE = Math.max(2, window.devicePixelRatio || 1);

            const options = {
                quality: 1.0,
                bgcolor: '#323342',
                width: captureWidth,
                height: captureHeight,
                scale: EXPORT_SCALE,
                style: {
                    'background-color': '#323342',
                    width: `${captureWidth}px`,
                    height: `${captureHeight}px`,
                    transform: 'none',
                },
            };

            try {
                const dataUrl = await domtoimage.toPng(tempContainer, options);
                const link = document.createElement('a');
                link.download = 'jkt48-wishlist.png';
                link.href = dataUrl;
                link.click();
            } catch (pngError) {
                console.warn('PNG generation failed, trying blob...', pngError);
                const blob = await domtoimage.toBlob(tempContainer, options);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'jkt48-wishlist.png';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }

            // Clean up
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Error saving wishlist:', error);
            alert('Failed to save image. Please try again or use a screenshot instead.');
        }
    };

    const handleExportToExcel = () => {
        if (wishlist.length === 0) return;

        // Prepare data for Excel
        const excelData = wishlist.map(item => ({
            Category: item.category,
            Description: item.description || '-',
            'Price per Unit': item.price,
            Quantity: item.quantity,
            'Total Price': item.price * item.quantity
        }));

        // Add total row
        excelData.push({
            Category: 'TOTAL',
            Description: '',
            'Price per Unit': '',
            Quantity: '',
            'Total Price': calculateTotal()
        });

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        const colWidths = [
            { wch: 30 }, // Category
            { wch: 40 }, // Description
            { wch: 15 }, // Price per Unit
            { wch: 10 }, // Quantity
            { wch: 15 }, // Total Price
        ];
        ws['!cols'] = colWidths;

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'JKT48 Wishlist');

        // Save file
        XLSX.writeFile(wb, 'jkt48-wishlist.xlsx');
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <Box sx={{ bgcolor: '#323342', minHeight: '100vh' }}>
                {/* Welcome Dialog */}
                <Dialog
                    open={showWelcomeDialog}
                    onClose={() => setShowWelcomeDialog(false)}
                    PaperProps={{
                        style: {
                            backgroundColor: '#323342',
                            color: 'white',
                            maxWidth: '600px'
                        }
                    }}
                >
                    <DialogTitle sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'white'
                    }}>
                        Selamat Datang di Wishlist Calculator JKT48
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <Typography paragraph>
                            1. Calculator ini dibuat untuk kalian para fans yang ingin mencari tahu total harga wishlist kalian di JKT48.
                        </Typography>
                        <Typography paragraph>
                            2. Kalian bisa menambah kategori, jumlah tiket/barang yang kalian beli, ubah harga (untuk beberapa barang yang memiliki harga yang berbeda-beda) dan juga menambah deskripsi.
                        </Typography>
                        <Typography paragraph>
                            3. Kalian bisa save Wishlist ini dengan tombol Save As Image atau Save ke Excel File dengan tombol Export to Excel
                        </Typography>
                        <Typography
                            sx={{
                                mt: 2,
                                p: 2,
                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: 1
                            }}
                        >
                            <strong>Disclaimer:</strong> Wishlist ini tidak termasuk Pajak, Biaya Admin Topup JKT48 Point, Biaya Admin Online Shop, dan lain-lain.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
                        <Button
                            onClick={() => setShowWelcomeDialog(false)}
                            variant="contained"
                            sx={{
                                bgcolor: 'white',
                                color: '#323342',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.9)'
                                }
                            }}
                        >
                            Mengerti
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Fixed Header */}
                <AppBar position="fixed" sx={{ bgcolor: '#323342', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <Box sx={{ position: 'relative' }}>
                        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconButton
                                edge="start"
                                color="inherit"
                                onClick={() => navigate('/')}
                                sx={{ mr: 2 }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                            <img
                                src={calculatorLogo}
                                alt="Calculator Logo"
                                style={{
                                    height: '40px',
                                    marginRight: '12px'
                                }}
                            />
                            <Typography variant="h6" component="div">
                                JKT48 Wishlist Calculator
                            </Typography>
                            {calculatorTitle && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 'auto',
                                        textAlign: 'center',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color: 'white',
                                            whiteSpace: 'nowrap',
                                            fontSize: '2.5rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        {calculatorTitle}
                                    </Typography>
                                </Box>
                            )}
                        </Toolbar>
                    </Box>
                </AppBar>

                {/* Main Content */}
                <Box sx={{ pt: '64px' }}>
                    <Container maxWidth="md" sx={{ py: 4 }}>
                        <Card sx={{ bgcolor: '#323342', boxShadow: 'none' }} ref={wishlistRef}>
                            <CardContent>
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    mb: 3,
                                    mt: 2
                                }}>
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        className="calculator-title"
                                        value={calculatorTitle}
                                        onChange={(e) => setCalculatorTitle(e.target.value)}
                                        placeholder="My JKT48 Wishlist"
                                        spellCheck="false"
                                        style={{
                                            width: `${inputWidth}px`,
                                            fontSize: '32px',
                                            padding: '8px 12px',
                                            backgroundColor: 'transparent',
                                            border: '1px solid rgba(255, 255, 255, 0.23)',
                                            borderRadius: '4px',
                                            color: 'white',
                                            textAlign: 'center'
                                        }}
                                        maxLength={90}
                                    />
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Select Category</InputLabel>
                                        <Select
                                            value={selectedCategory}
                                            label="Select Category"
                                            onChange={handleCategoryChange}
                                        >
                                            {categories.map((category) => (
                                                <MenuItem key={category.name} value={category.name}>
                                                    {category.name} {!isUserDefinedPrice(category.name) && `- ${formatPrice(category.price)}`}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    {selectedCategory && isUserDefinedPrice(selectedCategory) && (
                                        <TextField
                                            label="Price"
                                            type="number"
                                            value={customPrice}
                                            onChange={(e) => setCustomPrice(e.target.value)}
                                            size="small"
                                            sx={{ width: '200px' }}
                                            InputProps={{
                                                inputProps: { min: 0 }
                                            }}
                                        />
                                    )}

                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddItem}
                                        disabled={!selectedCategory || (isUserDefinedPrice(selectedCategory) && !customPrice)}
                                    >
                                        Add
                                    </Button>
                                </Box>

                                <Paper
                                    ref={wishlistRef}
                                    sx={{ bgcolor: '#323342', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                                >
                                    <List>
                                        {wishlist.map((item, index) => (
                                            <React.Fragment key={item.id}>
                                                <ListItem
                                                    sx={{
                                                        flexDirection: 'column',
                                                        alignItems: 'stretch',
                                                        gap: 1,
                                                        py: 2
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Box>
                                                            <Typography variant="subtitle1" sx={{ color: 'white' }}>
                                                                {item.category}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                                                {formatPrice(item.price)} × {item.quantity} = {formatPrice(item.price * item.quantity)}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={item.purchased}
                                                                        onChange={() => handlePurchasedChange(item.id)}
                                                                        sx={{
                                                                            color: 'rgba(255, 255, 255, 0.7)',
                                                                            '&.Mui-checked': {
                                                                                color: '#4CAF50'
                                                                            }
                                                                        }}
                                                                    />
                                                                }
                                                                label="Sudah dibeli"
                                                                sx={{
                                                                    color: 'rgba(255, 255, 255, 0.7)',
                                                                    '& .MuiFormControlLabel-label': {
                                                                        fontSize: '0.875rem'
                                                                    }
                                                                }}
                                                            />
                                                            {isUserDefinedPrice(item.category) && (
                                                                <TextField
                                                                    label="Price"
                                                                    type="number"
                                                                    value={item.price}
                                                                    onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                                                    InputProps={{ inputProps: { min: 0 } }}
                                                                    sx={{ width: '120px' }}
                                                                    size="small"
                                                                />
                                                            )}
                                                            <TextField
                                                                label="Qty"
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                InputProps={{ inputProps: { min: 1 } }}
                                                                sx={{ width: '80px' }}
                                                                size="small"
                                                            />
                                                            <IconButton
                                                                edge="end"
                                                                aria-label="delete"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Box>
                                                    </Box>
                                                    <TextField
                                                        fullWidth
                                                        label="Description (optional)"
                                                        value={item.description}
                                                        onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                                                        multiline
                                                        rows={1}
                                                        variant="outlined"
                                                        size="small"
                                                    />
                                                </ListItem>
                                                {index < wishlist.length - 1 && <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.12)' }} />}
                                            </React.Fragment>
                                        ))}
                                    </List>
                                </Paper>

                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box className="button-container">
                                        <Button
                                            variant="outlined"
                                            startIcon={<SaveIcon />}
                                            onClick={handleSaveImage}
                                            disabled={wishlist.length === 0}
                                            className="action-button"
                                            sx={{
                                                color: 'white',
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                                '&:hover': {
                                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.08)'
                                                }
                                            }}
                                        >
                                            Save as Image
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<SaveIcon />}
                                            onClick={handleExportToExcel}
                                            disabled={wishlist.length === 0}
                                            className="action-button"
                                            sx={{
                                                color: 'white',
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                                '&:hover': {
                                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.08)'
                                                }
                                            }}
                                        >
                                            Export to Excel
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={handleReset}
                                            disabled={wishlist.length === 0}
                                            className="action-button"
                                            sx={{
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                                '&:hover': {
                                                    borderColor: '#f44336',
                                                    backgroundColor: 'rgba(244, 67, 54, 0.08)'
                                                }
                                            }}
                                        >
                                            Reset
                                        </Button>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="h6" className="total-amount" sx={{ color: 'white' }}>
                                            Total: {formatPrice(calculateTotal())}
                                        </Typography>
                                        <Typography variant="subtitle1" sx={{ color: '#4CAF50', mt: 1 }}>
                                            Total Terbeli: {formatPrice(calculateTotal(true))}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <FormControl fullWidth>
                                        <InputLabel id="draft-select-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                            Load Draft
                                        </InputLabel>
                                        <Select
                                            labelId="draft-select-label"
                                            id="draft-select"
                                            value={selectedDraft}
                                            onChange={handleLoadDraft}
                                            label="Load Draft"
                                            sx={{
                                                color: 'white',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: 'rgba(255, 255, 255, 0.23)',
                                                },
                                            }}
                                        >
                                            <MenuItem value="">
                                                <em>Select a draft to load</em>
                                            </MenuItem>
                                            {drafts.map(draft => (
                                                <MenuItem
                                                    key={draft.id}
                                                    value={draft.id.toString()}
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        gap: 1
                                                    }}
                                                >
                                                    <span>{draft.title || 'Untitled Wishlist'}</span>
                                                    <span style={{
                                                        opacity: 0.7,
                                                        fontSize: '0.9em',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {draft.isAutoSave ? '(AutoSaved)' : ''} {new Date(draft.savedAt).toLocaleString()}
                                                    </span>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSaveDraft}
                                        fullWidth
                                    >
                                        Save as Draft
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    );
};

export default Calculator;
