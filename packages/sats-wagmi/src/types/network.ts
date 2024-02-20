import { BitcoinNetwork } from '@gobob/types';

export type WalletNetwork = Omit<BitcoinNetwork, 'regtest'>;
