/**
 * Token22 Launchpad Core - For actual blockchain transactions
 * 
 * This module contains the real Token22 creation logic.
 * Currently server.js runs in demo mode, but this can be 
 * integrated when ready to deploy on mainnet.
 */

const {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const {
    TOKEN_2022_PROGRAM_ID,
    ExtensionType,
    createInitializeMintInstruction,
    createInitializeTransferFeeConfigInstruction,
    getMintLen,
    createMint,
    mintTo,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

// Config
const TRANSFER_FEE_BASIS_POINTS = 100; // 1%
const MAX_FEE = BigInt(1_000_000_000); // Max fee per transfer
const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
const DECIMALS = 9;

/**
 * Create a Token22 mint with transfer fee extension
 */
async function createToken22Mint({
    connection,
    payer,
    name,
    symbol,
    description,
    image,
    transferFeeConfigAuthority,
    withdrawWithheldAuthority,
}) {
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    // Calculate space needed for mint account with extensions
    const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
        // Create mint account
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint,
            space: mintLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        // Initialize transfer fee config
        createInitializeTransferFeeConfigInstruction(
            mint,
            transferFeeConfigAuthority || payer.publicKey,
            withdrawWithheldAuthority || payer.publicKey,
            TRANSFER_FEE_BASIS_POINTS,
            MAX_FEE,
            TOKEN_2022_PROGRAM_ID
        ),
        // Initialize mint
        createInitializeMintInstruction(
            mint,
            DECIMALS,
            payer.publicKey, // Mint authority
            null, // Freeze authority (none)
            TOKEN_2022_PROGRAM_ID
        )
    );

    // Sign and send
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.partialSign(mintKeypair);

    const signature = await connection.sendTransaction(transaction, [payer, mintKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return {
        mint: mint.toBase58(),
        signature,
        decimals: DECIMALS,
        transferFeeBps: TRANSFER_FEE_BASIS_POINTS,
    };
}

/**
 * Mint initial supply to creator
 */
async function mintInitialSupply({
    connection,
    payer,
    mint,
    recipient,
    amount = TOTAL_SUPPLY,
}) {
    const mintPubkey = new PublicKey(mint);
    const recipientPubkey = new PublicKey(recipient);

    // Get or create associated token account
    const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction();

    // Check if ATA exists
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                ata,
                recipientPubkey,
                mintPubkey,
                TOKEN_2022_PROGRAM_ID
            )
        );
    }

    // Mint tokens
    transaction.add(
        createMintToInstruction(
            mintPubkey,
            ata,
            payer.publicKey,
            BigInt(amount) * BigInt(10 ** DECIMALS),
            [],
            TOKEN_2022_PROGRAM_ID
        )
    );

    const signature = await connection.sendTransaction(transaction, [payer]);
    await connection.confirmTransaction(signature, 'confirmed');

    return { signature, ata: ata.toBase58() };
}

/**
 * Remove mint authority (make supply fixed)
 */
async function removeMintAuthority({
    connection,
    payer,
    mint,
}) {
    const { createSetAuthorityInstruction, AuthorityType } = require('@solana/spl-token');
    
    const mintPubkey = new PublicKey(mint);
    
    const transaction = new Transaction().add(
        createSetAuthorityInstruction(
            mintPubkey,
            payer.publicKey,
            AuthorityType.MintTokens,
            null, // Remove authority
            [],
            TOKEN_2022_PROGRAM_ID
        )
    );

    const signature = await connection.sendTransaction(transaction, [payer]);
    await connection.confirmTransaction(signature, 'confirmed');

    return { signature };
}

/**
 * Bonding curve price calculation
 * Price = k * supply^2 (simple quadratic curve)
 */
function getBondingCurvePrice(currentSupply, totalSupply) {
    const k = 0.0000000001; // Curve steepness
    const supplyRatio = currentSupply / totalSupply;
    return k * Math.pow(supplyRatio * totalSupply, 2);
}

/**
 * Calculate tokens received for SOL amount
 */
function calculateBuyAmount(solAmount, currentSupply, totalSupply) {
    const currentPrice = getBondingCurvePrice(currentSupply, totalSupply);
    // Simplified: actual implementation would integrate the curve
    return Math.floor(solAmount / currentPrice);
}

/**
 * Calculate SOL received for token amount
 */
function calculateSellAmount(tokenAmount, currentSupply, totalSupply) {
    const currentPrice = getBondingCurvePrice(currentSupply, totalSupply);
    // Simplified: actual implementation would integrate the curve
    return tokenAmount * currentPrice * 0.99; // 1% fee
}

module.exports = {
    createToken22Mint,
    mintInitialSupply,
    removeMintAuthority,
    getBondingCurvePrice,
    calculateBuyAmount,
    calculateSellAmount,
    TRANSFER_FEE_BASIS_POINTS,
    TOTAL_SUPPLY,
    DECIMALS,
};
