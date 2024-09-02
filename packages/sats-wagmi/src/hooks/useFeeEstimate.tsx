import { estimateTxFee } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';
import { INTERVAL } from 'src/utils';

import { useSatsWagmi } from '../provider';

import { useFeeRate } from './useFeeRate';

type UseFeeEstimateProps = {
  query?: Omit<UndefinedInitialDataOptions<bigint, Error, bigint, (string | undefined)[]>, 'queryKey' | 'queryFn'>;
};

const useFeeEstimate = ({ query }: UseFeeEstimateProps = {}) => {
  const { data: feeRate } = useFeeRate();
  const { network } = useSatsWagmi();

  return useQuery({
    enabled: Boolean(feeRate),
    queryKey: ['sats-fee-estimate', network, feeRate?.toString()],
    queryFn: async () => {
      const feeEstimate = estimateTxFee(Number(feeRate));

      return BigInt(feeEstimate);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.MINUTE,
    ...query
  });
};

export { useFeeEstimate };
export type { UseFeeEstimateProps };
