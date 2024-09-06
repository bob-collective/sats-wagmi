import { Optional, useMutation, UseMutationOptions } from '@tanstack/react-query';
import { GatewayQuoteParams, GatewaySDK } from '@gobob/bob-sdk';

import { useAccount } from './useAccount';

type SendGatewayTransactionParams = {
  toToken: string;
  evmAddress: string;
  value: bigint;
};

type UseSendGatewayTransactionProps = Omit<
  { gatewaySDK?: GatewaySDK } & Omit<
    Optional<
      GatewayQuoteParams,
      'fromUserAddress' | 'toUserAddress' | 'amount' | 'toToken' | 'fromChain' | 'fromToken'
    >,
    'toChain'
  > & { toChain: 'bob' | 'bob-sepolia' } & UseMutationOptions<
      string | undefined,
      Error,
      SendGatewayTransactionParams,
      unknown
    >,
  'mutationKey' | 'mutationFn'
>;

const useSendGatewayTransaction = ({ gatewaySDK, toChain = 'bob', ...props }: UseSendGatewayTransactionProps) => {
  const { address: btcAddress, publicKey: btcPublicKey, connector } = useAccount();

  const { mutate, mutateAsync, ...result } = useMutation({
    mutationKey: ['sats-gateway', btcAddress],
    mutationFn: async ({ toToken, evmAddress, value }: SendGatewayTransactionParams) => {
      if (!connector) return undefined;
      if (!btcAddress) return undefined;

      const gatewayClient = gatewaySDK || new GatewaySDK(toChain);

      const params = {
        ...props,
        fromChain: props.fromChain || 'bitcoin',
        fromToken: props.fromToken || 'BTC',
        toChain,
        toToken,
        gasRefill: props.gasRefill || 2000,
        fromUserAddress: btcAddress,
        fromUserPublicKey: btcPublicKey,
        toUserAddress: evmAddress,
        amount: Number(value)
      };
      const quote = await gatewayClient.getQuote(params);

      const { uuid, psbtBase64 } = await gatewayClient.startOrder(quote, params);

      if (!psbtBase64) throw new Error('No psbt');

      const bitcoinTxHex = await connector.signAllInputs(psbtBase64);

      return await gatewayClient.finalizeOrder(uuid, bitcoinTxHex);
    },
    ...props
  });

  return {
    ...result,
    sendGatewayTransaction: mutate,
    sendGatewayTransactionAsync: mutateAsync
  };
};

export { useSendGatewayTransaction };
