'use client';

import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { EsploraClient, OrdinalsClient, OutPoint } from '@gobob/bob-sdk';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';

import { useSatsWagmi } from '../provider';
import { INTERVAL } from '../utils';

import { useAccount } from './useAccount';

type GetBalanceReturnType = { confirmed: bigint; unconfirmed: bigint; total: bigint };

type UseBalanceProps = Omit<
  UseQueryOptions<GetBalanceReturnType, unknown, GetBalanceReturnType, (string | undefined)[]>,
  'initialData' | 'queryFn' | 'queryKey' | 'enabled'
>;

const useBalance = (props: UseBalanceProps = {}) => {
  const { network } = useSatsWagmi();
  const { address } = useAccount();

  return useQuery({
    enabled: Boolean(address),
    queryKey: ['sats-balance', network, address],
    refetchInterval: INTERVAL.SECONDS_30,
    queryFn: async () => {
      if (!address) {
        return { confirmed: BigInt(0), unconfirmed: BigInt(0), total: BigInt(0) };
      }

      const esploraClient = new EsploraClient(network);
      const ordinalsClient = new OrdinalsClient(network);

      const addressInfo = getAddressInfo(address);

      if (addressInfo.type === AddressType.p2tr) {
        const [outputs, cardinalOutputs] = await Promise.all([
          esploraClient.getAddressUtxos(address),
          // cardinal = return UTXOs not containing inscriptions or runes
          ordinalsClient.getOutputsFromAddress(address, 'cardinal')
        ]);

        const cardinalOutputsSet = new Set(cardinalOutputs.map((output) => output.outpoint));

        const total = outputs.reduce((acc, output) => {
          if (cardinalOutputsSet.has(OutPoint.toString(output))) {
            return acc + output.value;
          }

          return acc;
        }, 0);

        const confirmed = outputs.reduce((acc, output) => {
          if (cardinalOutputsSet.has(OutPoint.toString(output)) && output.confirmed) {
            return acc + output.value;
          }

          return acc;
        }, 0);

        return {
          confirmed: BigInt(confirmed),
          unconfirmed: BigInt(total - confirmed),
          total: BigInt(total)
        };
      } else {
        const { confirmed, unconfirmed, total } = await esploraClient.getBalance(address);

        return {
          confirmed: BigInt(confirmed),
          unconfirmed: BigInt(unconfirmed),
          total: BigInt(total)
        };
      }
    },
    ...props
  });
};

export { useBalance };
