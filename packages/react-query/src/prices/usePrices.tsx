import { useQuery } from '@tanstack/react-query';

const BASE_URL = 'https://pro-api.coingecko.com/api/v3/simple/price';

enum PriceCurrency {
  USD = 'usd',
  BTC = 'btc',
  EUR = 'eur'
}

type PricesData = Record<string, Record<PriceCurrency, number>>;

const availableVersusCurrencies = Object.values(PriceCurrency);

// TODO: this is going elsewhere
const currencies = ['ethereum'];

const getPrices = async (allCurrencies?: boolean) => {
  const vsCurrencies = allCurrencies ? availableVersusCurrencies.join(',') : PriceCurrency.USD;
  const ids = currencies.join(',');

  const searchParams = new URLSearchParams({
    x_cg_pro_api_key: (import.meta as any).env.VITE_COINGECKO_API_KEY,
    vs_currencies: vsCurrencies,
    ids
  });

  const url = `${BASE_URL}?${searchParams.toString()}`;

  const response = await fetch(url);
  const json = await response.json();

  return json;
};

type UsePricesProps = { allCurrencies?: boolean };

const usePrices = ({ allCurrencies }: UsePricesProps = {}) => {
  const query = useQuery<PricesData>({
    queryFn: () => getPrices(allCurrencies),
    queryKey: ['prices'],
    staleTime: 15000,
    cacheTime: 60000,
    refetchOnWindowFocus: false
  });

  const getPrice = (token: string, versusCurrency: PriceCurrency = PriceCurrency.USD) =>
    query.data?.[token][versusCurrency];

  return { ...query, getPrice };
};

export { usePrices };
