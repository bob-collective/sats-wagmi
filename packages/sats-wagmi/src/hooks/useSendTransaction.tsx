import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import { useSatsWagmi } from '../provider';

import { useAccount } from './useAccount';

type UseSendTransactionProps = Omit<
  UseMutationOptions<any, unknown, { to: string; value: bigint }, unknown>,
  'mutationKey' | 'mutationFn'
>;

const useSendTransaction = (props: UseSendTransactionProps = {}) => {
  const { connector } = useSatsWagmi();
  const { address } = useAccount();

  const { mutate, mutateAsync, ...result } = useMutation({
    mutationKey: ['sats-send-transaction', address],
    mutationFn: async ({ to, value }: { to: string; value: bigint }) => {
      if (!connector) return undefined;

      const txid = await connector.sendToAddress(to, Number(value));

      return txid;
    },
    ...props
  });

  return {
    ...result,
    sendTransaction: mutate,
    sendTransactionAsync: mutateAsync
  };
};

export { useSendTransaction };
