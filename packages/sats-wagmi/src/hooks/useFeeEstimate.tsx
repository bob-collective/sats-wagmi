'use client';

import { estimateTxFee } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';

import { useSatsWagmi } from '../provider';
import { INTERVAL } from '../utils';

import { useAccount } from './useAccount';
import { useFeeRate } from './useFeeRate';

type UseFeeEstimateReturnType = { amount: bigint; feeRate: number };

type UseFeeEstimateProps<TData = UseFeeEstimateReturnType> = {
  query?: Omit<
    UndefinedInitialDataOptions<UseFeeEstimateReturnType, Error, TData, (string | number | undefined)[]>,
    'queryKey' | 'queryFn'
  >;
  amount?: number;
  opReturnData?: string;
  confirmationTarget?: number;
  feeRate?: number;
};

function useFeeEstimate<TData = UseFeeEstimateReturnType>({
  amount,
  opReturnData,
  feeRate: feeRateProp,
  query
}: UseFeeEstimateProps<TData> = {}) {
  const { address, publicKey } = useAccount();
  const { data: feeRateData } = useFeeRate();
  const { network } = useSatsWagmi();

  const enabled = Boolean(feeRateData && address && (query?.enabled !== undefined ? query.enabled : true));

  const feeRate = feeRateProp || feeRateData?.esplora[6];

  return useQuery({
    queryKey: ['sats-fee-estimate', amount, address, opReturnData, network, feeRate],
    queryFn: async () => {
      if (!address || !feeRate) {
        throw new Error('Failed to estimate fee');
      }

      return { feeRate, amount: await estimateTxFee(address, amount, publicKey, opReturnData, feeRate) };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.MINUTE,
    ...query,
    enabled
  });
}

export { useFeeEstimate };
export type { UseFeeEstimateProps };
