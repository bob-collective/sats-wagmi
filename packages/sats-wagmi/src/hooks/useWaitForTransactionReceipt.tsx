'use client';

import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { EsploraClient } from '@gobob/bob-sdk';

import { useSatsWagmi } from '../provider';

// TODO: check confirmations
type UseWaitForTransactionReceiptProps = Omit<
  UseQueryOptions<any, Error, any, (string | undefined)[]>,
  'initialData' | 'queryFn' | 'queryKey' | 'enabled'
> & {
  /** The hash of the transaction. */
  hash?: string;
};

// TODO: modify to also track Gateway status
const useWaitForTransactionReceipt = ({ hash, ...props }: UseWaitForTransactionReceiptProps = {}) => {
  const { network } = useSatsWagmi();

  return useQuery({
    enabled: Boolean(hash),
    queryKey: ['sats-wait-for-transaction-receipt', hash],
    retry: true,
    queryFn: async () => {
      if (!hash) throw new Error('hash is required');
      const esploraClient = new EsploraClient(network);
      const tx = await esploraClient.getTransaction(hash);

      if (!tx.status.confirmed) {
        throw new Error('Transaction not confirmed');
      }

      return tx;
    },
    ...props
  });
};

export { useWaitForTransactionReceipt };
