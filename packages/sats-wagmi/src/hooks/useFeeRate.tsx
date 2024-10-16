'use client';

import { EsploraClient } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';

import { CONFIRMATION_TARGET } from '../constants';
import { INTERVAL } from '../utils';
import { useSatsWagmi } from '../provider';

type UseFeeRateProps = {
  confirmationTarget?: number;
  query?: Omit<UndefinedInitialDataOptions<bigint, Error, bigint, (string | number)[]>, 'queryKey' | 'queryFn'>;
};

const useFeeRate = ({ query, confirmationTarget = CONFIRMATION_TARGET }: UseFeeRateProps = {}) => {
  const { network } = useSatsWagmi();

  return useQuery({
    queryKey: ['sats-fee-rate', confirmationTarget, network],
    queryFn: async () => {
      const esploraClient = new EsploraClient(network);

      const feeRate = await esploraClient.getFeeEstimate(confirmationTarget);

      return BigInt(Math.ceil(feeRate));
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.MINUTE,
    ...query
  });
};

export { useFeeRate };
export type { UseFeeRateProps };
