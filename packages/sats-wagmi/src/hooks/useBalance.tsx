import { UseQueryOptions, useQuery } from '@gobob/react-query';
import { useMemo } from 'react';

import { useSatsWagmi } from '../provider';

import { useAccount } from './useAccount';

type UseBalanceProps = Omit<
  UseQueryOptions<bigint, unknown, bigint, (string | undefined)[]>,
  'initialData' | 'queryFn' | 'queryKey' | 'enabled'
>;

const useBalance = (props: UseBalanceProps = {}) => {
  const { network } = useSatsWagmi();
  const { address } = useAccount();

  const apiUrl = useMemo(
    () => (network === 'mainnet' ? 'https://btc-mainnet.gobob.xyz' : 'https://btc-testnet.gobob.xyz'),
    [network]
  );

  return useQuery({
    enabled: Boolean(address),
    queryKey: ['sats-balance', address],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/address/${address}`);
      const data = await res.json();

      const chainBalance = BigInt(data.chain_stats.funded_txo_sum) - BigInt(data.chain_stats.spent_txo_sum);
      const mempoolBalance = BigInt(data.mempool_stats.funded_txo_sum) - BigInt(data.mempool_stats.spent_txo_sum);

      return chainBalance + mempoolBalance;
    },
    ...props
  });
};

export { useBalance };
