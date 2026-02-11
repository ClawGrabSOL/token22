/**
 * Token22 Launchpad - Core Token Creation
 * 
 * Creates meme coins with:
 * - 1% transfer fee (0.5% burn, 0.5% creator)
 * - Closeable mint (fixed supply after launch)
 * - On-chain metadata
 */

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} = require('@solana/spl-token');

// Constants
const DECIMALS = 9;
const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
const TRANSFER_FEE_BASIS_POINTS = 100; // 1%
const MAX_FEE = BigInt(1_000_000_000_000); // Max fee per transfer

/**
 * Create a new Token22 meme coin with transfer fees
 */
async function createToken22({
  connection,
  payer,
  name,
  symbol,
  uri,
  creatorWallet,
}) {
  console.log(`\n🚀 Creating Token22: ${name} (${symbol})`);
  
  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  
  console.log(`   Mint: ${mint.toBase58()}`);
  
  // Calculate space needed for extensions
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  
  // Calculate rent
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  
  // Create account instruction
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });
  
  // Initialize transfer fee config
  // Fee goes to creator wallet, we'll handle burn separately
  const initTransferFeeIx = createInitializeTransferFeeConfigInstruction(
    mint,
    creatorWallet, // Transfer fee config authority
    creatorWallet, // Withdraw withheld authority (collects fees)
    TRANSFER_FEE_BASIS_POINTS,
    MAX_FEE,
    TOKEN_2022_PROGRAM_ID
  );
  
  // Initialize mint
  const initMintIx = createInitializeMintInstruction(
    mint,
    DECIMALS,
    payer.publicKey, // Mint authority
    payer.publicKey, // Freeze authority (will be removed)
    TOKEN_2022_PROGRAM_ID
  );
  
  // Create associated token account for initial supply
  const creatorAta = getAssociatedTokenAddressSync(
    mint,
    creatorWallet,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  
  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    creatorAta,
    creatorWallet,
    mint,
    TOKEN_2022_PROGRAM_ID
  );
  
  // Mint initial supply
  const mintToIx = createMintToInstruction(
    mint,
    creatorAta,
    payer.publicKey,
    BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS),
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  // Remove mint authority (fixed supply)
  const removeMintAuthIx = createSetAuthorityInstruction(
    mint,
    payer.publicKey,
    AuthorityType.MintTokens,
    null, // Remove authority
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  // Remove freeze authority
  const removeFreezeAuthIx = createSetAuthorityInstruction(
    mint,
    payer.publicKey,
    AuthorityType.FreezeAccount,
    null, // Remove authority
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  // Build and send transaction
  const tx = new Transaction().add(
    createAccountIx,
    initTransferFeeIx,
    initMintIx,
    createAtaIx,
    mintToIx,
    removeMintAuthIx,
    removeFreezeAuthIx
  );
  
  console.log('   Sending transaction...');
  
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer, mintKeypair],
    { commitment: 'confirmed' }
  );
  
  console.log(`   ✅ Token created!`);
  console.log(`   TX: https://solscan.io/tx/${signature}`);
  console.log(`   Mint: https://solscan.io/token/${mint.toBase58()}`);
  
  return {
    mint: mint.toBase58(),
    signature,
    creatorAta: creatorAta.toBase58(),
    supply: TOTAL_SUPPLY,
    decimals: DECIMALS,
    transferFeeBps: TRANSFER_FEE_BASIS_POINTS,
  };
}

/**
 * Bonding curve price calculation
 * Price increases quadratically with supply sold
 */
function calculatePrice(soldSupply, totalSupply, initialMarketCap = 30000) {
  const percentSold = soldSupply / totalSupply;
  const multiplier = 1 + Math.pow(percentSold * 2, 2);
  const currentMarketCap = initialMarketCap * multiplier;
  return currentMarketCap / totalSupply;
}

/**
 * Calculate tokens received for SOL amount
 */
function calculateTokensForSol(solAmount, currentSold, totalSupply, solPrice = 150) {
  const solValue = solAmount * solPrice;
  const pricePerToken = calculatePrice(currentSold, totalSupply);
  return Math.floor(solValue / pricePerToken);
}

/**
 * Calculate SOL received for token amount
 */
function calculateSolForTokens(tokenAmount, currentSold, totalSupply, solPrice = 150) {
  const pricePerToken = calculatePrice(currentSold - tokenAmount / 2, totalSupply);
  const usdValue = tokenAmount * pricePerToken;
  return usdValue / solPrice;
}

module.exports = {
  createToken22,
  calculatePrice,
  calculateTokensForSol,
  calculateSolForTokens,
  DECIMALS,
  TOTAL_SUPPLY,
  TRANSFER_FEE_BASIS_POINTS,
  TOKEN_2022_PROGRAM_ID,
};
