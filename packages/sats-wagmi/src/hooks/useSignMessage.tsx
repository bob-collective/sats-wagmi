'use client';

import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import { useSatsWagmi } from '../provider';

import { useAccount } from './useAccount';

type UseSignMessageProps = Omit<
  UseMutationOptions<string | undefined, unknown, { message: string }, unknown>,
  'mutationKey' | 'mutationFn'
>;

const useSignMessage = (props: UseSignMessageProps = {}) => {
  const { connector } = useSatsWagmi();
  const { address } = useAccount();

  const { mutate, mutateAsync, ...result } = useMutation({
    mutationKey: ['sats-sign-message', address],
    mutationFn: async ({ message }: { message: string }) => {
      if (!connector) return undefined;

      return await connector.signMessage(message);
    },
    ...props
  });

  return {
    ...result,
    signMessage: mutate,
    signMessageAsync: mutateAsync
  };
};

export { useSignMessage };
