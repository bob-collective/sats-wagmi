'use client';

import { estimateTxFee } from '@gobob/bob-sdk';
import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';

import { INTERVAL } from '../utils';
import { useSatsWagmi } from '../provider';

import { CONFIRMATION_TARGET, useFeeRate } from './useFeeRate';
import { useAccount } from './useAccount';

type UseFeeEstimateProps = {
  query?: Omit<
    UndefinedInitialDataOptions<bigint, Error, bigint, (string | number | undefined)[]>,
    'queryKey' | 'queryFn'
  >;
  amount?: number;
  opReturnData?: string;
  confirmationTarget?: number;
};

const useFeeEstimate = ({
  amount,
  opReturnData,
  confirmationTarget = CONFIRMATION_TARGET,
  query
}: UseFeeEstimateProps = {}) => {
  const { address, publicKey } = useAccount();
  const { data: feeRate } = useFeeRate({ confirmations: confirmationTarget });
  const { network } = useSatsWagmi();

  const enabled = Boolean(feeRate && address && (query?.enabled !== undefined ? query.enabled : true));

  return useQuery({
    queryKey: ['sats-fee-estimate', amount, address, opReturnData, network, feeRate?.toString(), confirmationTarget],
    queryFn: async () => {
      if (!address || !feeRate || !publicKey) {
        throw new Error('Failed to estimate fee');
      }

      return estimateTxFee(address, amount, publicKey, opReturnData, Number(feeRate), confirmationTarget);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.MINUTE,
    ...query,
    enabled
  });
};

export { useFeeEstimate };
export type { UseFeeEstimateProps };
