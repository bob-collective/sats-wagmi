import { DefaultEsploraClient } from '@gobob/bob-sdk';
import { CONFIRMATION_TARGET } from '@gobob/utils';
import { INTERVAL, UndefinedInitialDataOptions, useQuery } from '@gobob/react-query';

import { useSatsWagmi } from '../provider';

type UseFeeRateProps = {
  confirmations?: number;
  query?: Omit<UndefinedInitialDataOptions<bigint, Error, bigint, string[]>, 'queryKey' | 'queryFn'>;
};

const useFeeRate = ({ query, confirmations = CONFIRMATION_TARGET }: UseFeeRateProps = {}) => {
  const { network } = useSatsWagmi();

  return useQuery({
    queryKey: ['sats-fee-rate', network],
    queryFn: async () => {
      const electrsClient = new DefaultEsploraClient(network);

      const feeRate = await electrsClient.getFeeEstimate(confirmations);

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
