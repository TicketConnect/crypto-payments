import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const implAddress = '0x05CF6957B7bEB3B54B76341f06928e5637148fCe';
const burners = [
  { name: 'cross-chain-usdc', key: '0x395a90cb826cf713177b1e6c28c1f007594e1fe30ac2aeb08d59db224a0bb364' },
  { name: 'cross-chain-swap', key: '0xe7d4c804cbb0e3b68c30204ec6c673c2ba3d9367bb098425a65a3d71e7fb7156' },
];

for (const b of burners) {
  const account = privateKeyToAccount(b.key);
  const client = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
  const auth = await client.signAuthorization({ contractAddress: implAddress });
  console.log(JSON.stringify({
    name: b.name, address: account.address,
    auth: { address: auth.address, chainId: Number(auth.chainId), nonce: Number(auth.nonce), r: auth.r, s: auth.s, yParity: auth.yParity }
  }));
}
