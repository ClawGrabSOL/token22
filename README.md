# Token22 Launchpad

A fair-launch platform for Solana Token22 meme coins with built-in transfer fees and automatic liquidity migration.

## Features

### Token22 Extensions Used
- **Transfer Fee** (1%): Split 50/50 between creator and burn
- **Mint Close Authority**: Closes after max supply, making it deflationary
- **Metadata Pointer**: On-chain metadata, no external dependencies

### Launch Mechanics
- **Bonding Curve**: Price increases with supply (pump.fun style)
- **Fair Launch**: No presale, no team allocation
- **Initial Price**: ~$30k fully diluted
- **Migration**: Auto-migrates to Raydium at $69k market cap

### Fee Structure
- 1% transfer fee on every trade
- 0.5% burned (deflationary)
- 0.5% to creator wallet

## Architecture

```
token22-launchpad/
├── programs/          # Anchor program (on-chain)
│   └── launchpad/
├── app/              # Next.js frontend
├── sdk/              # TypeScript SDK
└── scripts/          # Deployment scripts
```

## Tech Stack
- **On-chain**: Anchor + Token22 + Token Metadata
- **Frontend**: Next.js + TailwindCSS
- **SDK**: @solana/web3.js + @solana/spl-token

## Bonding Curve Formula

```
price = initialPrice * (1 + (supply / totalSupply) ^ 2)
```

This creates a gradual price increase that accelerates as more tokens are bought.

## Quick Start

```bash
# Install dependencies
npm install

# Run frontend
npm run dev

# Deploy program (devnet)
anchor deploy --provider.cluster devnet
```

## License

MIT
