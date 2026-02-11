/**
 * Token22 Launchpad - API Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Connection, Keypair } = require('@solana/web3.js');
const { createLaunch, buyTokens, sellTokens, getLaunches, getLaunch } = require('./launchpad');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Config
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PORT = process.env.PORT || 3001;

const connection = new Connection(RPC_URL, 'confirmed');

// API Routes

// Get all launches
app.get('/api/launches', (req, res) => {
  const launches = getLaunches();
  res.json(launches);
});

// Get specific launch
app.get('/api/launches/:mint', (req, res) => {
  const launch = getLaunch(req.params.mint);
  if (!launch) {
    return res.status(404).json({ error: 'Launch not found' });
  }
  res.json(launch);
});

// Create new launch
app.post('/api/launches', async (req, res) => {
  try {
    const { name, symbol, description, image, privateKey } = req.body;
    
    if (!name || !symbol || !privateKey) {
      return res.status(400).json({ error: 'Missing required fields: name, symbol, privateKey' });
    }
    
    // Decode private key
    const payer = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(privateKey))
    );
    
    const launch = await createLaunch({
      connection,
      payer,
      name,
      symbol,
      description,
      image,
    });
    
    res.json(launch);
  } catch (err) {
    console.error('Create launch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Buy tokens
app.post('/api/launches/:mint/buy', async (req, res) => {
  try {
    const { solAmount, privateKey } = req.body;
    
    if (!solAmount || !privateKey) {
      return res.status(400).json({ error: 'Missing required fields: solAmount, privateKey' });
    }
    
    const buyer = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(privateKey))
    );
    
    const result = await buyTokens({
      connection,
      buyer,
      mintAddress: req.params.mint,
      solAmount: parseFloat(solAmount),
    });
    
    res.json(result);
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sell tokens
app.post('/api/launches/:mint/sell', async (req, res) => {
  try {
    const { tokenAmount, privateKey } = req.body;
    
    if (!tokenAmount || !privateKey) {
      return res.status(400).json({ error: 'Missing required fields: tokenAmount, privateKey' });
    }
    
    const seller = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(privateKey))
    );
    
    const result = await sellTokens({
      connection,
      seller,
      mintAddress: req.params.mint,
      tokenAmount: parseFloat(tokenAmount),
    });
    
    res.json(result);
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rpc: RPC_URL });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     TOKEN22 LAUNCHPAD                  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔗 RPC: ${RPC_URL}`);
  console.log('');
});
