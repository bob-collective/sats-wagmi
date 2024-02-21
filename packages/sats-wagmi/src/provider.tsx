import { BitcoinNetwork } from '@gobob/types';
import { FC, ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@gobob/react-query';

import { LeatherConnector, MMSnapConnector, UnisatConnector, XverseConnector } from './connectors';
import { SatsConnector } from './connectors/base';

type SatsConfigData = {
  connector?: SatsConnector;
  connectors: SatsConnector[];
  setConnector: (connector?: SatsConnector) => void;
};

const StatsWagmiContext = createContext<SatsConfigData>({
  connector: undefined,
  connectors: [],
  setConnector: () => {}
});

const useSatsWagmi = (): SatsConfigData => {
  const context = useContext(StatsWagmiContext);

  if (context === undefined) {
    throw new Error('useSatsWagmi must be used within a SatsWagmiConfig!');
  }

  return context;
};

type SatsWagmiConfigProps = {
  children: ReactNode;
  network?: BitcoinNetwork;
  queryClient?: QueryClient;
};

const SatsWagmiConfig: FC<SatsWagmiConfigProps> = ({
  children,
  network = 'mainnet',
  queryClient = new QueryClient()
}) => {
  const [connectors, setConnectors] = useState<SatsConnector[]>([]);
  const [connector, setCurrentConnector] = useState<SatsConnector>();

  useEffect(() => {
    const init = () => {
      const readyConnectors: SatsConnector[] = [];

      const xverse = new XverseConnector(network);

      readyConnectors.push(xverse);

      const unisat = new UnisatConnector(network);

      readyConnectors.push(unisat);

      const mmSnap = new MMSnapConnector(network);

      mmSnap.connect();

      readyConnectors.push(mmSnap);

      const leather = new LeatherConnector(network);

      readyConnectors.push(leather);

      setConnectors(readyConnectors);
    };

    init();
  }, []);

  const setConnector = useCallback((connector?: SatsConnector) => {
    setCurrentConnector(connector);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatsWagmiContext.Provider value={{ connectors, connector, setConnector }}>
        {children}
      </StatsWagmiContext.Provider>
    </QueryClientProvider>
  );
};

export { SatsWagmiConfig, useSatsWagmi };
