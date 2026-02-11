// Shared state with launches.js won't work in serverless - this is demo mode
let launches = [];

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { name, symbol, description, image, twitter, website, creator } = req.body;
        
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
        
        return res.json({ success: true, mint: mockMint, launch });
        
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
