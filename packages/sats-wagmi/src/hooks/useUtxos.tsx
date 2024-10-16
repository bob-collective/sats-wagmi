'use client';

import { UndefinedInitialDataOptions, useQuery } from '@tanstack/react-query';
import { EsploraClient, UTXO } from '@gobob/bob-sdk';

import { INTERVAL } from '../utils';
import { useSatsWagmi } from '../provider';

import { useAccount } from './useAccount';

type UseUTXOSProps = {
  query?: Omit<
    UndefinedInitialDataOptions<UTXO[], Error, UTXO[], (string | number | undefined)[]>,
    'queryKey' | 'queryFn'
  >;
  confirmed?: boolean;
};

const useUtxos = ({ query, confirmed }: UseUTXOSProps = {}) => {
  const { address } = useAccount();
  const { network } = useSatsWagmi();

  return useQuery({
    queryKey: ['sats-utxos', confirmed ? 'confirmed' : 'all', address, network],
    queryFn: async () => {
      if (!address) {
        throw new Error('Failed to get utxos');
      }
      const esploraClient = new EsploraClient(network);

      return esploraClient.getAddressUtxos(address, confirmed);
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: INTERVAL.SECONDS_30,
    ...query,
    enabled: Boolean(address && (query?.enabled !== undefined ? query.enabled : true))
  });
};

export { useUtxos };
export type { UseUTXOSProps };
