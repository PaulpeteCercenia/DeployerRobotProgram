const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { TOKEN_2022_PROGRAM_ID, createInitializeMintInstruction, createMintToInstruction, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getMintLen } = require('@solana/spl-token');
const bs58 = require('bs58').default;
const fs = require('fs');
require('dotenv').config();

async function directDeploy() {
  console.log('🚀 DIRECT MAINNET DEPLOYMENT');
  console.log('⚡ OMEGA TOKEN - LIVE CREATION');
  
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Load deployer key
  const deployerKeyPath = '.deployer.key';
  const privateKeyString = fs.readFileSync(deployerKeyPath, 'utf8').trim();
  const privateKeyBytes = bs58.decode(privateKeyString);
  const deployer = Keypair.fromSecretKey(privateKeyBytes);
  
  console.log('🔑 Deployer:', deployer.publicKey.toBase58());
  
  // Check balance
  const balance = await connection.getBalance(deployer.publicKey);
  console.log('💰 Balance:', balance / 1e9, 'SOL');
  
  if (balance < 0.01 * 1e9) {
    console.log('⚠️ Low SOL balance - attempting deployment anyway');
  }
  
  try {
    // Generate mint keypair
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;
    
    console.log('🪙 OMEGA MINT ADDRESS:', mint.toBase58());
    console.log('🔗 Explorer:', `https://explorer.solana.com/address/${mint.toBase58()}`);
    
    // Get rent for mint account
    const mintLen = getMintLen([]);
    const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);
    
    // Create mint transaction
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: deployer.publicKey,
        newAccountPubkey: mint,
        space: mintLen,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint,
        9,
        deployer.publicKey,
        deployer.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    // Send mint creation
    const mintTxSignature = await connection.sendTransaction(createMintTx, [deployer, mintKeypair]);
    console.log('⏳ Confirming mint creation...');
    await connection.confirmTransaction(mintTxSignature, 'confirmed');
    
    console.log('✅ MINT CREATED!');
    console.log('📝 TX:', mintTxSignature);
    console.log('🔗 Explorer:', `https://explorer.solana.com/tx/${mintTxSignature}`);
    
    // Create treasury ATA and mint tokens
    const treasuryPubkey = deployer.publicKey;
    const treasuryAta = await getAssociatedTokenAddress(mint, treasuryPubkey, false, TOKEN_2022_PROGRAM_ID);
    
    const mintToTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        deployer.publicKey,
        treasuryAta,
        treasuryPubkey,
        mint,
        TOKEN_2022_PROGRAM_ID
      ),
      createMintToInstruction(
        mint,
        treasuryAta,
        deployer.publicKey,
        BigInt(1_000_000_000) * BigInt(10 ** 9),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const mintToSignature = await connection.sendTransaction(mintToTx, [deployer]);
    console.log('⏳ Confirming token mint...');
    await connection.confirmTransaction(mintToSignature, 'confirmed');
    
    console.log('✅ TOKENS MINTED!');
    console.log('📝 TX:', mintToSignature);
    console.log('🔗 Explorer:', `https://explorer.solana.com/tx/${mintToSignature}`);
    
    // Save deployment data
    const deploymentData = {
      timestamp: new Date().toISOString(),
      mintAddress: mint.toBase58(),
      deployerAddress: deployer.publicKey.toBase58(),
      treasuryAta: treasuryAta.toBase58(),
      createMintTx: mintTxSignature,
      mintTokensTx: mintToSignature,
      totalSupply: '1000000000',
      network: 'mainnet-beta'
    };
    
    if (!fs.existsSync('.cache')) fs.mkdirSync('.cache');
    fs.writeFileSync('.cache/mainnet-deployment.json', JSON.stringify(deploymentData, null, 2));
    
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('📊 LIVE CONTRACT DATA:');
    console.log(`   🪙 MINT: ${mint.toBase58()}`);
    console.log(`   💰 SUPPLY: 1,000,000,000 OMEGA`);
    console.log(`   🏦 TREASURY: ${treasuryAta.toBase58()}`);
    console.log(`   📝 CREATE TX: ${mintTxSignature}`);
    console.log(`   📝 MINT TX: ${mintToSignature}`);
    console.log('🌐 NETWORK: Solana Mainnet-Beta');
    
    return deploymentData;
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    throw error;
  }
}

directDeploy().catch(console.error);