/**
 * Token22 Launchpad - Launch & Trading Logic
 * 
 * Handles:
 * - Creating new token launches
 * - Bonding curve buy/sell
 * - Tracking launch state
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
} = require('@solana/spl-token');

const { createToken22, calculatePrice, TOTAL_SUPPLY, DECIMALS } = require('./token22');

// In-memory storage (replace with DB in production)
const launches = new Map();

/**
 * Launch state
 */
class Launch {
  constructor({
    mint,
    name,
    symbol,
    creator,
    createdAt,
    poolWallet,
    poolSol = 0,
    poolTokens = TOTAL_SUPPLY * 0.8, // 80% for bonding curve
    soldTokens = 0,
  }) {
    this.mint = mint;
    this.name = name;
    this.symbol = symbol;
    this.creator = creator;
    this.createdAt = createdAt;
    this.poolWallet = poolWallet;
    this.poolSol = poolSol;
    this.poolTokens = poolTokens;
    this.soldTokens = soldTokens;
    this.migrated = false;
  }
  
  get marketCap() {
    const price = calculatePrice(this.soldTokens, TOTAL_SUPPLY);
    return price * TOTAL_SUPPLY;
  }
  
  get pricePerToken() {
    return calculatePrice(this.soldTokens, TOTAL_SUPPLY);
  }
  
  toJSON() {
    return {
      mint: this.mint,
      name: this.name,
      symbol: this.symbol,
      creator: this.creator,
      createdAt: this.createdAt,
      poolSol: this.poolSol,
      poolTokens: this.poolTokens,
      soldTokens: this.soldTokens,
      marketCap: this.marketCap,
      pricePerToken: this.pricePerToken,
      migrated: this.migrated,
    };
  }
}

/**
 * Create a new token launch
 */
async function createLaunch({
  connection,
  payer,
  name,
  symbol,
  description,
  image,
}) {
  // Create pool wallet for this launch
  const poolWallet = Keypair.generate();
  
  // Create the Token22 with transfer fees
  const tokenResult = await createToken22({
    connection,
    payer,
    name,
    symbol,
    uri: image || '',
    creatorWallet: payer.publicKey,
  });
  
  // Create launch record
  const launch = new Launch({
    mint: tokenResult.mint,
    name,
    symbol,
    creator: payer.publicKey.toBase58(),
    createdAt: new Date().toISOString(),
    poolWallet: poolWallet.publicKey.toBase58(),
  });
  
  launches.set(tokenResult.mint, launch);
  
  console.log(`\n🎉 Launch created: ${name} (${symbol})`);
  console.log(`   Mint: ${tokenResult.mint}`);
  console.log(`   Initial MC: $${launch.marketCap.toLocaleString()}`);
  
  return launch.toJSON();
}

/**
 * Buy tokens from bonding curve
 */
async function buyTokens({
  connection,
  buyer,
  mintAddress,
  solAmount,
}) {
  const launch = launches.get(mintAddress);
  if (!launch) throw new Error('Launch not found');
  if (launch.migrated) throw new Error('Launch has migrated to Raydium');
  
  // Calculate tokens to receive
  const currentPrice = launch.pricePerToken;
  const solPrice = 150; // TODO: Get from oracle
  const usdValue = solAmount * solPrice;
  const tokensToReceive = Math.floor(usdValue / currentPrice);
  
  if (tokensToReceive > launch.poolTokens) {
    throw new Error('Not enough tokens in pool');
  }
  
  console.log(`\n💰 Buy order: ${solAmount} SOL → ${tokensToReceive.toLocaleString()} ${launch.symbol}`);
  
  const mint = new PublicKey(mintAddress);
  
  // Get or create buyer's token account
  const buyerAta = getAssociatedTokenAddressSync(
    mint,
    buyer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  
  // Get pool's token account
  const poolAta = getAssociatedTokenAddressSync(
    mint,
    new PublicKey(launch.creator),
    false,
    TOKEN_2022_PROGRAM_ID
  );
  
  const tx = new Transaction();
  
  // Create ATA if needed
  try {
    await getAccount(connection, buyerAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(
      buyer.publicKey,
      buyerAta,
      buyer.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID
    ));
  }
  
  // Transfer tokens from pool to buyer
  tx.add(createTransferCheckedInstruction(
    poolAta,
    mint,
    buyerAta,
    new PublicKey(launch.creator), // Pool authority
    BigInt(tokensToReceive) * BigInt(10 ** DECIMALS),
    DECIMALS,
    [],
    TOKEN_2022_PROGRAM_ID
  ));
  
  // TODO: Transfer SOL to pool (needs proper escrow)
  
  // Update launch state
  launch.soldTokens += tokensToReceive;
  launch.poolTokens -= tokensToReceive;
  launch.poolSol += solAmount;
  
  console.log(`   New price: $${launch.pricePerToken.toFixed(8)}`);
  console.log(`   Market cap: $${launch.marketCap.toLocaleString()}`);
  
  // Check for migration threshold
  if (launch.marketCap >= 69000 && !launch.migrated) {
    console.log(`\n🚀 MIGRATION THRESHOLD REACHED!`);
    console.log(`   Ready to migrate to Raydium...`);
    // TODO: Implement Raydium migration
  }
  
  return {
    tokensReceived: tokensToReceive,
    solSpent: solAmount,
    newPrice: launch.pricePerToken,
    marketCap: launch.marketCap,
  };
}

/**
 * Sell tokens back to bonding curve
 */
async function sellTokens({
  connection,
  seller,
  mintAddress,
  tokenAmount,
}) {
  const launch = launches.get(mintAddress);
  if (!launch) throw new Error('Launch not found');
  if (launch.migrated) throw new Error('Launch has migrated to Raydium');
  
  // Calculate SOL to receive
  const currentPrice = launch.pricePerToken;
  const solPrice = 150; // TODO: Get from oracle
  const usdValue = tokenAmount * currentPrice;
  const solToReceive = usdValue / solPrice;
  
  if (solToReceive > launch.poolSol) {
    throw new Error('Not enough SOL in pool');
  }
  
  console.log(`\n💸 Sell order: ${tokenAmount.toLocaleString()} ${launch.symbol} → ${solToReceive.toFixed(4)} SOL`);
  
  // Update launch state
  launch.soldTokens -= tokenAmount;
  launch.poolTokens += tokenAmount;
  launch.poolSol -= solToReceive;
  
  console.log(`   New price: $${launch.pricePerToken.toFixed(8)}`);
  console.log(`   Market cap: $${launch.marketCap.toLocaleString()}`);
  
  return {
    tokensSold: tokenAmount,
    solReceived: solToReceive,
    newPrice: launch.pricePerToken,
    marketCap: launch.marketCap,
  };
}

/**
 * Get all active launches
 */
function getLaunches() {
  return Array.from(launches.values()).map(l => l.toJSON());
}

/**
 * Get specific launch
 */
function getLaunch(mintAddress) {
  const launch = launches.get(mintAddress);
  return launch ? launch.toJSON() : null;
}

module.exports = {
  createLaunch,
  buyTokens,
  sellTokens,
  getLaunches,
  getLaunch,
};
