import { useQuery } from '@gobob/react-query';

import { useSatsWagmi } from '../provider';

const useAccount = () => {
  const { connector } = useSatsWagmi();

  const {
    data: address,
    error,
    isError,
    isLoading,
    isSuccess,
    refetch
  } = useQuery({
    queryKey: ['account', connector],
    queryFn: () => {
      if (!connector) return undefined;

      return connector?.getAccount();
    },
    enabled: !!connector
  });

  return {
    connector,
    address,
    error,
    isError,
    isLoading,
    isSuccess,
    refetch
  };
};

export { useAccount };
