'use client';

import { EsploraClient, EsploraFeeEstimates, MempoolClient, MempoolRecomendedFee } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';

import { INTERVAL } from '../utils';
import { useSatsWagmi } from '../provider';

type FeeRateReturnType = {
  memPool: Record<keyof MempoolRecomendedFee, number>;
  esplora: Record<keyof EsploraFeeEstimates, number>;
};

type UseFeeRateProps<TData = FeeRateReturnType> = {
  rate?: keyof FeeRateReturnType;
  query?: Omit<
    UndefinedInitialDataOptions<FeeRateReturnType, Error, TData, (string | number)[]>,
    'queryKey' | 'queryFn'
  >;
};

function useFeeRate<TData = FeeRateReturnType>({ query }: UseFeeRateProps<TData> = {}) {
  const { network } = useSatsWagmi();

  return useQuery({
    queryKey: ['sats-fee-rate', network],
    queryFn: async () => {
      const memPoolClient = new MempoolClient(network);
      const esploraClient = new EsploraClient(network);

      const [memPoolFeeRate, esploraFeeRate] = await Promise.all([
        memPoolClient.getRecommendedFees(),
        esploraClient.getFeeEstimates()
      ]);

      return {
        memPool: memPoolFeeRate,
        esplora: esploraFeeRate
      };
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.MINUTE,
    ...query
  });
}

export { useFeeRate };
export type { UseFeeRateProps, FeeRateReturnType };
