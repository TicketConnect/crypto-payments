import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const burnerKey = '0xcb65cf259717b85cce6683b5e0f5821efec8fd2e3ce88a0acf343f2ad27f85a1';
const implAddress = '0x05CF6957B7bEB3B54B76341f06928e5637148fCe';

const account = privateKeyToAccount(burnerKey);
const client = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });

const auth = await client.signAuthorization({ contractAddress: implAddress });
console.log(JSON.stringify(auth, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
