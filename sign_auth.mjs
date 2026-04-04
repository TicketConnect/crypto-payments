import { createWalletClient, http } from './frontend/node_modules/viem/index.js';
import { privateKeyToAccount } from './frontend/node_modules/viem/accounts/index.js';
import { base } from './frontend/node_modules/viem/chains/index.js';

const burnerKey = '0xad7170d78a0189391ae4c401be221903724b984a5ef60e127a12b4be2ff54771';
const implAddress = '0x5062903A55d48d77346AFDE3F2A5715dd46F1048';

const account = privateKeyToAccount(burnerKey);
const client = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });

const auth = await client.signAuthorization({ contractAddress: implAddress });
console.log(JSON.stringify(auth, null, 2));
