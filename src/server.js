/**
 * Token22 Launchpad - API Server
 * The way Toly intended
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Connection, PublicKey } = require('@solana/web3.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Config
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PORT = process.env.PORT || 3022;

const connection = new Connection(RPC_URL, 'confirmed');

// In-memory storage for demo (replace with DB in production)
const launches = [];

// API Routes

// Get all launches
app.get('/api/launches', (req, res) => {
    res.json(launches);
});

// Get specific launch
app.get('/api/launches/:mint', (req, res) => {
    const launch = launches.find(l => l.mint === req.params.mint);
    if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
    }
    res.json(launch);
});

// Create new launch (demo mode - returns success without actual tx)
app.post('/api/launch', async (req, res) => {
    try {
        const { name, symbol, description, image, twitter, website, creator, initialBuy } = req.body;
        
        if (!name || !symbol || !creator) {
            return res.status(400).json({ error: 'Missing required fields: name, symbol, creator' });
        }

        // For demo: create a mock launch
        // In production: build the actual Token22 transaction for signing
        const mockMint = 'Demo' + Math.random().toString(36).substring(2, 10);
        
        const launch = {
            mint: mockMint,
            name,
            symbol,
            description: description || '',
            image: image || null,
            twitter: twitter || '',
            website: website || '',
            creator,
            createdAt: new Date().toISOString(),
            marketCap: '$0',
            holders: 1,
            supply: 1_000_000_000,
            fee: '1%',
            status: 'active'
        };
        
        launches.unshift(launch);
        
        // Demo mode - no actual transaction
        res.json({ 
            success: true, 
            mint: mockMint,
            message: 'Token created (demo mode)',
            launch
        });
        
    } catch (err) {
        console.error('Create launch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Confirm signed transaction
app.post('/api/confirm', async (req, res) => {
    try {
        const { signedTx } = req.body;
        
        if (!signedTx) {
            return res.status(400).json({ error: 'Missing signed transaction' });
        }

        // Decode and send transaction
        const txBuffer = Buffer.from(signedTx, 'base64');
        const signature = await connection.sendRawTransaction(txBuffer, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        res.json({ 
            success: true, 
            signature,
            message: 'Transaction confirmed'
        });
        
    } catch (err) {
        console.error('Confirm error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Buy tokens (demo)
app.post('/api/buy', async (req, res) => {
    try {
        const { mint, buyer, solAmount } = req.body;
        
        if (!mint || !buyer || !solAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const launch = launches.find(l => l.mint === mint);
        if (!launch) {
            return res.status(404).json({ error: 'Launch not found' });
        }

        // Demo: just return success
        res.json({ 
            success: true,
            tokensReceived: solAmount * 1000000, // Mock calculation
            message: 'Buy successful (demo mode)'
        });
        
    } catch (err) {
        console.error('Buy error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Sell tokens (demo)
app.post('/api/sell', async (req, res) => {
    try {
        const { mint, seller, tokenAmount } = req.body;
        
        if (!mint || !seller || !tokenAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const launch = launches.find(l => l.mint === mint);
        if (!launch) {
            return res.status(404).json({ error: 'Launch not found' });
        }

        // Demo: just return success
        res.json({ 
            success: true,
            solReceived: tokenAmount / 1000000, // Mock calculation
            message: 'Sell successful (demo mode)'
        });
        
    } catch (err) {
        console.error('Sell error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        rpc: RPC_URL,
        launches: launches.length
    });
});

// Serve index.html for all other routes (SPA)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  TOKEN22 LAUNCHPAD - The Way Toly Intended        ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔗 RPC: ${RPC_URL}`);
    console.log(`📋 Mode: Demo (no real transactions)`);
    console.log('');
});
