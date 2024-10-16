'use client';

import { EsploraClient } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';

import { INTERVAL } from '../utils';
import { useSatsWagmi } from '../provider';

// Confirmation target for fee estimation in Bitcoin blocks
export const CONFIRMATION_TARGET = 6;

type UseFeeRateProps = {
  confirmations?: number;
  query?: Omit<UndefinedInitialDataOptions<bigint, Error, bigint, string[]>, 'queryKey' | 'queryFn'>;
};

const useFeeRate = ({ query, confirmations = CONFIRMATION_TARGET }: UseFeeRateProps = {}) => {
  const { network } = useSatsWagmi();

  return useQuery({
    queryKey: ['sats-fee-rate', network],
    queryFn: async () => {
      const esploraClient = new EsploraClient(network);

      const feeRate = await esploraClient.getFeeEstimate(confirmations);

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
