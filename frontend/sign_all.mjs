import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const implAddress = '0x05CF6957B7bEB3B54B76341f06928e5637148fCe';

const burners = [
  { name: 'same-chain-usdc',  key: '0x6551232c79bea6634e5619cd0cdf7b762fa0a95f875b65f07e4a48cb52429656' },
  { name: 'same-chain-swap',  key: '0xb5b84859bc556a6eb4227e947b7ae66f68637b3f04dd07a82d7a43254f0f1eb4' },
  { name: 'cross-chain-usdc', key: '0xf437df0459be44abcdc833f53cd6400b380daa0bd664bde2a4f1ee039ae80e3c' },
  { name: 'cross-chain-swap', key: '0x4b08104f20913ed68d10510cdabc54a10c8166adf8f457fb8540ecf4cd5f857f' },
];

for (const b of burners) {
  const account = privateKeyToAccount(b.key);
  const client = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
  const auth = await client.signAuthorization({ contractAddress: implAddress });
  console.log(JSON.stringify({
    name: b.name,
    address: account.address,
    auth: {
      address: auth.address,
      chainId: Number(auth.chainId),
      nonce: Number(auth.nonce),
      r: auth.r,
      s: auth.s,
      yParity: auth.yParity,
    }
  }, null, 2));
  console.log('---');
}
