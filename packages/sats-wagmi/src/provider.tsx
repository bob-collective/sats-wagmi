import { Network as BitcoinNetwork } from 'bitcoin-address-validation';
import { FC, ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LeatherConnector, MMSnapConnector, UnisatConnector, XverseConnector } from './connectors';
import { SatsConnector } from './connectors/base';
import { LocalStorageKeys } from './constants';
import { OKXConnector } from './connectors/okx';

type SatsConfigData = {
  connector?: SatsConnector;
  connectors: SatsConnector[];
  setConnector: (connector?: SatsConnector) => void;
  network: BitcoinNetwork;
};

const SatsWagmiContext = createContext<SatsConfigData>({
  connector: undefined,
  connectors: [],
  setConnector: () => {},
  network: BitcoinNetwork.mainnet
});

const useSatsWagmi = (): SatsConfigData => {
  const context = useContext(SatsWagmiContext);

  if (context === undefined) {
    throw new Error('useSatsWagmi must be used within a SatsWagmiConfig!');
  }

  return context;
};

type SatsWagmiConfigProps = {
  children: ReactNode;
  network?: BitcoinNetwork;
  queryClient: QueryClient;
};

const SatsWagmiConfig: FC<SatsWagmiConfigProps> = ({ children, queryClient, network = BitcoinNetwork.mainnet }) => {
  const [connectors, setConnectors] = useState<SatsConnector[]>([]);
  const [connector, setCurrentConnector] = useState<SatsConnector>();

  const [storedConnector, setStoredConnector] = useLocalStorage<string | undefined>(LocalStorageKeys.CONNECTOR);

  useEffect(() => {
    const init = () => {
      const readyConnectors: SatsConnector[] = [];

      if (network === 'mainnet') {
        const okx = new OKXConnector(network);

        readyConnectors.push(okx);
      }

      const xverse = new XverseConnector(network);

      readyConnectors.push(xverse);

      const unisat = new UnisatConnector(network, 'unisat');

      readyConnectors.push(unisat);

      const bitkeep = new UnisatConnector(network, 'bitkeep');

      readyConnectors.push(bitkeep);

      const binancew3w = new UnisatConnector(network, 'binancew3w');

      readyConnectors.push(binancew3w);

      const mmSnap = new MMSnapConnector(network);

      readyConnectors.push(mmSnap);

      const leather = new LeatherConnector(network);

      readyConnectors.push(leather);

      setConnectors(readyConnectors);
    };

    init();
  }, [network]);

  const setConnector = useCallback(
    (connector?: SatsConnector) => {
      setCurrentConnector(connector);
      setStoredConnector(connector?.id);
    },
    [setStoredConnector]
  );

  useEffect(() => {
    const autoConnect = async () => {
      const connector = connectors.find((connector) => connector.id === storedConnector);

      if (!connector) return;

      try {
        await connector.connect();
        setConnector(connector);
      } catch (e) {
        setStoredConnector(undefined);
      }
    };

    if (!connector && storedConnector && connectors.length) {
      autoConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors]);

  return (
    <QueryClientProvider client={queryClient}>
      <SatsWagmiContext.Provider value={{ connectors, connector, setConnector, network }}>
        {children}
      </SatsWagmiContext.Provider>
    </QueryClientProvider>
  );
};

export { SatsWagmiConfig, useSatsWagmi };
