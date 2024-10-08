'use client';

import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { EsploraClient } from '@gobob/bob-sdk';

import { useSatsWagmi } from '../provider';
import { INTERVAL } from '../utils';

import { useAccount } from './useAccount';

type GetBalanceReturnType = {
  value: bigint;
};

type UseBalanceProps = Omit<
  UseQueryOptions<GetBalanceReturnType, unknown, GetBalanceReturnType, (string | undefined)[]>,
  'initialData' | 'queryFn' | 'queryKey' | 'enabled'
>;

const useBalance = (props: UseBalanceProps = {}) => {
  const { network } = useSatsWagmi();
  const { address } = useAccount();

  return useQuery({
    enabled: Boolean(address),
    queryKey: ['sats-balance', address],
    queryFn: async () => {
      if (!address) return { value: BigInt(0) };

      const esploraClient = new EsploraClient(network);

      const balance = await esploraClient.getBalance(address);

      return { value: BigInt(balance) };
    },
    refetchInterval: INTERVAL.SECONDS_10,
    ...props
  });
};

export { useBalance };
