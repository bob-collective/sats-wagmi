import type { FormEvent } from 'react';

import { useAccount } from '@gobob/sats-wagmi';
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { GatewaySDK } from '@gobob/bob-sdk';
import { type Hex, parseUnits } from 'viem';

function parseBtc(ether: string) {
  return parseUnits(ether, 8);
}

const useGateway = (
  props: Omit<
    UseMutationOptions<string | undefined, unknown, { evmAddress: string; value: bigint }, unknown>,
    'mutationKey' | 'mutationFn'
  > = {}
) => {
  const { address: btcAddress, connector } = useAccount();

  return useMutation({
    mutationKey: ['sats-gateway', btcAddress],
    mutationFn: async ({ evmAddress, value }: { evmAddress: string; value: bigint }) => {
      if (!connector) return undefined;
      if (!btcAddress) return undefined;

      const gatewaySDK = new GatewaySDK('bob-sepolia');

      const params = {
        fromChain: 'bitcoin',
        toChain: 'bob-sepolia',
        fromToken: 'BTC',
        toToken: 'tBTC',
        gasRefill: 2000,
        fromUserAddress: btcAddress,
        toUserAddress: evmAddress,
        amount: Number(value)
      };
      const quote = await gatewaySDK.getQuote(params);

      const { uuid, psbtBase64 } = await gatewaySDK.startOrder(quote, params);

      if (!psbtBase64) throw new Error('No psbt');

      const bitcoinTxHex = await connector.signAllInputs(psbtBase64);

      return await gatewaySDK.finalizeOrder(uuid, bitcoinTxHex);
    },
    ...props
  });
};

function Gateway() {
  const { data: hash, isPending, mutate: onramp } = useGateway();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const evmAddress = formData.get('address') as Hex;
    const value = formData.get('value') as string;

    onramp({ evmAddress, value: parseBtc(value) });
  }

  return (
    <div>
      <h2>BOB Gateway</h2>
      <form onSubmit={submit}>
        <input required name='address' placeholder='EVM Address' />
        <input required name='value' placeholder='Amount (BTC)' step='0.00000001' type='number' />
        <button disabled={isPending} type='submit'>
          {isPending ? 'Confirming...' : 'Send'}
        </button>
      </form>
      {hash && <div>Transaction Hash: {hash}</div>}
    </div>
  );
}

export default Gateway;
