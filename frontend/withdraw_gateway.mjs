import { createWalletClient, createPublicClient, http, pad, maxUint256, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { randomBytes } from 'node:crypto';

const relayerKey = '0x12b13b3d0c74fb911b71e0002043f4a898d9d2b673c0d2c7f6792a9b91be1225';
const account = privateKeyToAccount(relayerKey);
const transport = http('https://base-mainnet.g.alchemy.com/v2/IOYycMPXXKkHP6e50q4zq');
const client = createWalletClient({ account, chain: base, transport });
const publicClient = createPublicClient({ chain: base, transport });

const GATEWAY_WALLET = '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE';
const GATEWAY_MINTER = '0x2222222d7164433c4C09B0b0D809a9b52C04C205';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const toB32 = (addr) => pad(addr.toLowerCase(), { size: 32 });

const spec = {
  version: 1,
  sourceDomain: 6,
  destinationDomain: 6,
  sourceContract: toB32(GATEWAY_WALLET),
  destinationContract: toB32(GATEWAY_MINTER),
  sourceToken: toB32(BASE_USDC),
  destinationToken: toB32(BASE_USDC),
  sourceDepositor: toB32(account.address),
  destinationRecipient: toB32(account.address),
  sourceSigner: toB32(account.address),
  destinationCaller: toB32('0x0000000000000000000000000000000000000000'),
  value: 3083102n,  // 5093102 - 2010000 (maxFee)
  salt: ('0x' + randomBytes(32).toString('hex')),
  hookData: '0x',
};

const burnIntent = {
  maxBlockHeight: maxUint256,
  maxFee: 2010000n,
  spec,
};

console.log('signing burn intent...');
const sig = await client.signTypedData({
  domain: { name: 'GatewayWallet', version: '1' },
  types: {
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
  },
  primaryType: 'BurnIntent',
  message: burnIntent,
});
console.log('signature:', sig);

const body = JSON.stringify([{ burnIntent, signature: sig }], (_, v) => typeof v === 'bigint' ? v.toString() : v);

console.log('calling gateway API...');
const resp = await fetch('https://gateway-api.circle.com/v1/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const result = await resp.json();
console.log('gateway response:', JSON.stringify(result, null, 2));

if (result.attestation && result.signature) {
  console.log('minting on Base...');
  const minterAbi = [{
    type: 'function', name: 'gatewayMint',
    inputs: [{name:'attestationPayload',type:'bytes'},{name:'signature',type:'bytes'}],
    outputs: [], stateMutability: 'nonpayable',
  }];

  const minter = getContract({ address: GATEWAY_MINTER, abi: minterAbi, client: { public: publicClient, wallet: client } });
  const mintTx = await minter.write.gatewayMint([result.attestation, result.signature], { account });
  console.log('mint tx:', mintTx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log('mint status:', receipt.status);
}
