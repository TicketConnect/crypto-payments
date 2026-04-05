import { createWalletClient, createPublicClient, http, pad, maxUint256, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { randomBytes } from 'node:crypto';

const transport = http('https://base-mainnet.g.alchemy.com/v2/IOYycMPXXKkHP6e50q4zq');
const publicClient = createPublicClient({ chain: base, transport });

const GATEWAY_WALLET = '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE';
const GATEWAY_MINTER = '0x2222222d7164433c4C09B0b0D809a9b52C04C205';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RELAYER = '0x3C3Cc15159145aa1Eb07b03E82b56D677316A9dA';
const toB32 = (addr) => pad(addr.toLowerCase(), { size: 32 });

const types = {
  TransferSpec: [
    {name:'version',type:'uint32'},{name:'sourceDomain',type:'uint32'},{name:'destinationDomain',type:'uint32'},
    {name:'sourceContract',type:'bytes32'},{name:'destinationContract',type:'bytes32'},
    {name:'sourceToken',type:'bytes32'},{name:'destinationToken',type:'bytes32'},
    {name:'sourceDepositor',type:'bytes32'},{name:'destinationRecipient',type:'bytes32'},
    {name:'sourceSigner',type:'bytes32'},{name:'destinationCaller',type:'bytes32'},
    {name:'value',type:'uint256'},{name:'salt',type:'bytes32'},{name:'hookData',type:'bytes'}
  ],
  BurnIntent: [
    {name:'maxBlockHeight',type:'uint256'},{name:'maxFee',type:'uint256'},{name:'spec',type:'TransferSpec'}
  ],
};

const minterAbi = [{
  type:'function',name:'gatewayMint',
  inputs:[{name:'attestationPayload',type:'bytes'},{name:'signature',type:'bytes'}],
  outputs:[],stateMutability:'nonpayable',
}];

async function withdraw(signerKey, depositorAddr, value) {
  const account = privateKeyToAccount(signerKey);
  const client = createWalletClient({ account, chain: base, transport });

  const fee = BigInt(Math.ceil(Number(value) * 5 / 10000)) + 10000n;
  const transferValue = value - fee;

  console.log(`Withdrawing ${transferValue} from depositor ${depositorAddr} (fee: ${fee})`);

  const spec = {
    version: 1, sourceDomain: 6, destinationDomain: 6,
    sourceContract: toB32(GATEWAY_WALLET), destinationContract: toB32(GATEWAY_MINTER),
    sourceToken: toB32(BASE_USDC), destinationToken: toB32(BASE_USDC),
    sourceDepositor: toB32(depositorAddr), destinationRecipient: toB32(RELAYER),
    sourceSigner: toB32(account.address), destinationCaller: toB32('0x0000000000000000000000000000000000000000'),
    value: transferValue,
    salt: ('0x' + randomBytes(32).toString('hex')),
    hookData: '0x',
  };

  const sig = await client.signTypedData({
    domain: { name: 'GatewayWallet', version: '1' },
    types,
    primaryType: 'BurnIntent',
    message: { maxBlockHeight: maxUint256, maxFee: fee, spec },
  });

  const resp = await fetch('https://gateway-api.circle.com/v1/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ burnIntent: { maxBlockHeight: maxUint256, maxFee: fee, spec }, signature: sig }], (_, v) => typeof v === 'bigint' ? v.toString() : v),
  });

  const result = await resp.json();
  if (!result.attestation) { console.log('ERROR:', result); return; }

  const minter = getContract({ address: GATEWAY_MINTER, abi: minterAbi, client: { public: publicClient, wallet: client } });
  const mintTx = await minter.write.gatewayMint([result.attestation, result.signature], { account });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log(`Minted! tx: ${mintTx} status: ${receipt.status}`);
}

// Relayer: 5.07 USDC
await withdraw(
  '0x12b13b3d0c74fb911b71e0002043f4a898d9d2b673c0d2c7f6792a9b91be1225',
  RELAYER,
  5073102n
);

// Burner 3: 0.88 USDC
await withdraw(
  '0xf437df0459be44abcdc833f53cd6400b380daa0bd664bde2a4f1ee039ae80e3c',
  '0xA94B355B64db42651F64A0EDAB9A7DCF473F197e',
  880000n
);
