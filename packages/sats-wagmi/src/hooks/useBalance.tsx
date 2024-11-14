'use client';

import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { EsploraClient, OrdinalsClient } from '@gobob/bob-sdk';
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
        // cardinal = return UTXOs not containing inscriptions or runes
        const outputsFromAddress = await ordinalsClient.getOutputsFromAddress(address, 'cardinal');
        const taprootBalance = outputsFromAddress.reduce((acc, cur) => {
          return acc + cur.value;
        }, 0);

        return {
          confirmed: BigInt(taprootBalance),
          unconfirmed: BigInt(0),
          total: BigInt(taprootBalance)
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
