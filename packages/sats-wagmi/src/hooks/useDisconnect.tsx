'use client';

import { useMutation } from '@tanstack/react-query';

import { useSatsWagmi } from '../provider';

const useDisconnect = () => {
  const { setConnector } = useSatsWagmi();

  const { mutate, mutateAsync, ...mutation } = useMutation({
    mutationKey: ['sats-disconnect'],
    mutationFn: async () => {
      setConnector(undefined);
    }
  });

  return {
    ...mutation,
    disconnect: mutate,
    disconnectAsync: mutateAsync
  };
};

export { useDisconnect };
