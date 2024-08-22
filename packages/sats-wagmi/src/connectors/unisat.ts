import { Network } from 'bitcoin-address-validation';

import { bitkeepLogo } from '../assets/bitget';

import { PsbtInputAccounts, SatsConnector } from './base';

const getLibNetwork = (network: WalletNetwork): Network => {
  switch (network) {
    case 'livenet':
      return Network.mainnet;
    case 'testnet':
      return Network.testnet;
  }
};

const getUnisatNetwork = (network: Network): WalletNetwork => {
  switch (network) {
    default:
    case Network.mainnet:
      return 'livenet';
    case Network.testnet:
      return 'testnet';
  }
};

type AccountsChangedEvent = (event: 'accountsChanged', handler: (accounts: Array<string>) => void) => void;

type Inscription = {
  inscriptionId: string;
  inscriptionNumber: string;
  address: string;
  outputValue: string;
  content: string;
  contentLength: string;
  contentType: string;
  preview: string;
  timestamp: number;
  offset: number;
  genesisTransaction: string;
  location: string;
};

type getInscriptionsResult = { total: number; list: Inscription[] };

type SendInscriptionsResult = { txid: string };

type Balance = { confirmed: number; unconfirmed: number; total: number };

type WalletNetwork = 'livenet' | 'testnet';

type Unisat = {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  on: AccountsChangedEvent;
  removeListener: AccountsChangedEvent;
  getInscriptions: (cursor: number, size: number) => Promise<getInscriptionsResult>;
  sendInscription: (
    address: string,
    inscriptionId: string,
    options?: { feeRate: number }
  ) => Promise<SendInscriptionsResult>;
  switchNetwork: (network: 'livenet' | 'testnet') => Promise<void>;
  getNetwork: () => Promise<WalletNetwork>;
  getPublicKey: () => Promise<string>;
  getBalance: () => Promise<Balance>;
  sendBitcoin: (address: string, atomicAmount: number, options?: { feeRate: number }) => Promise<string>;
  signPsbt: (
    psbtHex: string,
    options?: {
      autoFinalized?: boolean;
      toSignInputs: {
        index: number;
        address?: string;
        publicKey?: string;
        sighashTypes?: number[];
        disableTweakSigner?: boolean;
      }[];
    }
  ) => Promise<string>;
  signMessage: (msg: string, type?: 'ecdsa' | 'bip322-simple') => Promise<string>;
};

type WalletSource = 'bitkeep' | 'unisat';

declare global {
  interface Window {
    unisat: Unisat;
    bitkeep: {
      unisat: Unisat;
    };
  }
}

const metadata: Record<WalletSource, { id: string; name: string; homepage: string; icon?: string }> = {
  bitkeep: {
    id: 'com.bitget.web3',
    name: 'Bitget Wallet',
    homepage: 'https://web3.bitget.com',
    icon: bitkeepLogo
  },
  unisat: {
    id: 'unisat',
    name: 'Unisat',
    homepage: 'https://unisat.io/'
  }
};

class UnisatConnector extends SatsConnector {
  source: WalletSource;

  constructor(network: WalletNetwork, source: WalletSource) {
    const { homepage, id, name, icon } = metadata[source];

    super(getLibNetwork(network), id, name, homepage, icon);

    this.source = source;
  }

  private getSource() {
    return this.source === 'bitkeep' ? window?.bitkeep?.unisat : window?.unisat;
  }

  async connect(): Promise<void> {
    const walletSource = this.getSource();

    const network = await walletSource.getNetwork();
    const mappedNetwork = getLibNetwork(network);

    if (mappedNetwork !== this.network) {
      const expectedNetwork = getUnisatNetwork(this.network);

      await walletSource.switchNetwork(expectedNetwork);
    }

    const [accounts, publicKey] = await Promise.all([window.unisat.requestAccounts(), window.unisat.getPublicKey()]);

    this.paymentAddress = accounts[0];
    this.ordinalsAddress = accounts[0];
    this.publicKey = publicKey;

    window.unisat.on('accountsChanged', this.changeAccount);
  }

  disconnect() {
    this.paymentAddress = undefined;
    this.publicKey = undefined;
  }

  signMessage(message: string) {
    return this.getSource().signMessage(message);
  }

  on(callback: (account: string) => void): void {
    this.getSource().on('accountsChanged', ([account]) => {
      callback(account);

      this.changeAccount(account);
    });
  }

  removeListener(callback: (account: string) => void): void {
    this.getSource().removeListener('accountsChanged', ([account]) => {
      callback(account);

      this.changeAccount(account);
    });
  }

  async changeAccount(account: string) {
    this.paymentAddress = account;
    this.publicKey = await this.getSource().getPublicKey();
  }

  async isReady() {
    this.ready = typeof this.getSource() !== 'undefined';

    return this.ready;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    return this.getSource().sendBitcoin(toAddress, amount);
  }

  async signPsbt(psbtHex: string, psbtInputAccounts: PsbtInputAccounts[]): Promise<string> {
    // https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#signpsbt
    const publicKey = await this.getPublicKey();

    // Extract all inputs to be signed
    let inputs: number[] = [];

    for (const input of psbtInputAccounts) {
      for (const index of input.signingIndexes) {
        inputs.push(index);
      }
    }
    const toSignInputs = inputs.map((index) => {
      return {
        index,
        publicKey,
        disableTweakSigner: true
      };
    });

    const signedPsbtHex = await this.getSource().signPsbt(psbtHex, {
      autoFinalized: false,
      toSignInputs: toSignInputs
    });

    return signedPsbtHex;
  }
}

export { UnisatConnector };
