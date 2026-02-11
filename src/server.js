/**
 * Token22 Launchpad - API Server
 * The way Toly intended
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

const PORT = process.env.PORT || 3022;

// In-memory storage
const launches = [];

// API Routes
app.get('/api/launches', (req, res) => {
    res.json(launches);
});

app.get('/api/launches/:mint', (req, res) => {
    const launch = launches.find(l => l.mint === req.params.mint);
    if (!launch) return res.status(404).json({ error: 'Launch not found' });
    res.json(launch);
});

app.post('/api/launch', async (req, res) => {
    try {
        const { name, symbol, description, image, twitter, website, creator, initialBuy } = req.body;
        
        if (!name || !symbol || !creator) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const mockMint = 'T22' + Math.random().toString(36).substring(2, 10).toUpperCase();
        
        const launch = {
            mint: mockMint,
            name,
            symbol: symbol.toUpperCase(),
            description: description || '',
            image: image || null,
            twitter: twitter || '',
            website: website || '',
            creator,
            createdAt: new Date().toISOString(),
            marketCap: '$420',
            holders: 1,
            supply: '1,000,000,000',
            fee: '1%',
            status: 'active'
        };
        
        launches.unshift(launch);
        res.json({ success: true, mint: mockMint, launch });
        
    } catch (err) {
        console.error('Launch error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', launches: launches.length });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║  TOKEN22 LAUNCHPAD - The Way Toly Intended        ║
╚═══════════════════════════════════════════════════╝

🚀 http://localhost:${PORT}
`);
});
