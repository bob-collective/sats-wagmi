import { Optional, useMutation, UseMutationOptions } from '@tanstack/react-query';
import { GatewayQuoteParams, GatewaySDK } from '@gobob/bob-sdk';

import { useAccount } from './useAccount';

type SendToGatewayParams = {
  toToken: string;
  evmAddress: string;
  value: bigint;
};

type UseSendToGatewayProps = Omit<
  { gatewaySDK?: GatewaySDK } & Omit<
    Optional<
      GatewayQuoteParams,
      'fromUserAddress' | 'toUserAddress' | 'amount' | 'toToken' | 'fromChain' | 'fromToken'
    >,
    'toChain'
  > & { toChain: 'bob' | 'bob-sepolia' } & UseMutationOptions<
      string | undefined,
      unknown,
      SendToGatewayParams,
      unknown
    >,
  'mutationKey' | 'mutationFn'
>;

const useSendToGateway = ({ gatewaySDK, toChain = 'bob', ...props }: UseSendToGatewayProps) => {
  const { address: btcAddress, connector } = useAccount();

  const { mutate, mutateAsync, ...result } = useMutation({
    mutationKey: ['sats-gateway', btcAddress],
    mutationFn: async ({ toToken, evmAddress, value }: SendToGatewayParams) => {
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
    sendToGateway: mutate,
    sendToGatewayAsync: mutateAsync
  };
};

export { useSendToGateway };
