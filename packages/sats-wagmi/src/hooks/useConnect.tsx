'use client';

import { useMutation } from '@tanstack/react-query';

import { SatsConnector } from '../connectors/base';
import { useSatsWagmi } from '../provider';

const useConnect = () => {
  const { connectors, setConnector } = useSatsWagmi();

  const { mutate, mutateAsync, ...query } = useMutation({
    mutationKey: ['sats-connect'],
    mutationFn: async ({ connector }: { connector?: SatsConnector }) => {
      if (!connector) {
        throw new Error('invalid connector id');
      }

      if (connector.name !== 'MetaMask' && !(await connector.isReady())) {
        window.open(connector.homepage, '_blank', 'noopener');

        throw new Error('Wallet is not installed');
      }

      await connector.connect();

      return { address: connector.paymentAddress };
    },
    onSuccess: (_, { connector }) => {
      setConnector(connector);
    }
  });

  return {
    ...query,
    connectors,
    connect: mutate,
    connectAsync: mutateAsync
  };
};

export { useConnect };
