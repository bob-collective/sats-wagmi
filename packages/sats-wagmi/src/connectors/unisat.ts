import { AddressType, Network } from 'bitcoin-address-validation';

import { bitgetLogo } from '../assets/bitget';

import { PsbtInputAccounts, SatsConnector } from './base';

type WalletNetwork = 'livenet' | 'testnet';

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

type Balance = { confirmed: number; unconfirmed: number; total: number };

// https://docs.bitkeep.com/en/docs/guide/wallet/btc.html
// https://developers.binance.com/docs/binance-w3w/bitcoin-provider
// https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet
type UniSatBase = {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  getNetwork: () => Promise<WalletNetwork>;
  switchNetwork: (network: WalletNetwork) => Promise<void>;
  getPublicKey: () => Promise<string>;
  getBalance: () => Promise<Balance>;
  signMessage: (msg: string, type?: 'ecdsa' | 'bip322-simple') => Promise<string>;
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
  on: AccountsChangedEvent;
  removeListener: AccountsChangedEvent;
};

// additional methods not supported by all connectors
type UniSatExt = {
  sendBitcoin: (address: string, atomicAmount: number, options?: { feeRate: number }) => Promise<string>;
};

type WalletSource = 'bitkeep' | 'binancew3w' | 'unisat';

declare global {
  interface Window {
    unisat: UniSatBase & UniSatExt;
    bitkeep: {
      unisat: UniSatBase & UniSatExt;
    };
    binancew3w: {
      bitcoin: UniSatBase;
    };
  }
}

const metadata: Record<WalletSource, { id: string; name: string; homepage: string; icon?: string }> = {
  bitkeep: {
    id: 'bitget',
    name: 'Bitget Wallet',
    homepage: 'https://web3.bitget.com',
    icon: bitgetLogo
  },
  binancew3w: {
    id: 'binancew3w',
    name: 'Binance Web3 Wallet',
    homepage: 'https://www.binance.com/en-GB'
  },
  unisat: {
    id: 'unisat',
    name: 'UniSat',
    homepage: 'https://unisat.io/'
  }
};

class UnisatConnector extends SatsConnector {
  source: WalletSource;

  constructor(network: Network, source: WalletSource) {
    const { homepage, id, name, icon } = metadata[source];

    super(network, id, name, homepage, icon);

    this.source = source;
  }

  private getSource(): UniSatBase | (UniSatBase & UniSatExt) | undefined {
    switch (this.source) {
      case 'bitkeep':
        return window?.bitkeep?.unisat || undefined;
      case 'binancew3w':
        return window?.binancew3w?.bitcoin || undefined;
      case 'unisat':
        return window?.unisat || undefined;
    }
  }

  async connect(): Promise<void> {
    const walletSource = this.getSource()!;

    const network = await walletSource.getNetwork();
    const mappedNetwork = getLibNetwork(network);

    if (mappedNetwork !== this.network) {
      const expectedNetwork = getUnisatNetwork(this.network);

      await walletSource.switchNetwork(expectedNetwork);
    }

    const [accounts, publicKey] = await Promise.all([walletSource.requestAccounts(), walletSource.getPublicKey()]);

    this.paymentAddress = accounts[0];
    this.ordinalsAddress = accounts[0];
    this.publicKey = publicKey;

    // https://github.com/unisat-wallet/extension/blob/04cbfd6e7f7953815d35d8f77df457388fea2707/src/background/controller/provider/controller.ts#L39
    walletSource.on('accountsChanged', ([account]) => this.changeAccount(account));
  }

  disconnect() {
    this.paymentAddress = undefined;
    this.publicKey = undefined;
  }

  signMessage(message: string) {
    return this.getSource()!.signMessage(message);
  }

  on(callback: (account: string) => void): void {
    this.getSource()!.on('accountsChanged', ([account]) => {
      callback(account);

      this.changeAccount(account);
    });
  }

  removeListener(callback: (account: string) => void): void {
    this.getSource()!.removeListener('accountsChanged', ([account]) => {
      callback(account);

      this.changeAccount(account);
    });
  }

  async changeAccount(account: string) {
    this.paymentAddress = account;
    this.publicKey = await this.getSource()!.getPublicKey();
  }

  async isReady() {
    this.ready = typeof this.getSource() !== 'undefined';

    return this.ready;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    const source = this.getSource()!;

    if ('sendBitcoin' in source) {
      return source.sendBitcoin(toAddress, amount);
    } else {
      return super.sendToAddress(toAddress, amount);
    }
  }

  async signPsbt(psbtHex: string, psbtInputAccounts: PsbtInputAccounts[]): Promise<string> {
    // https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#signpsbt

    if (!this.publicKey) {
      throw new Error('Something went wrong while connecting');
    }

    // Extract all inputs to be signed
    let inputs: number[] = [];

    for (const input of psbtInputAccounts) {
      for (const index of input.signingIndexes) {
        inputs.push(index);
      }
    }

    if (!this.paymentAddress) {
      throw new Error('No payment address specified');
    }

    const toSignInputs = inputs.map((index) => {
      return {
        index,
        publicKey: this.publicKey,
        disableTweakSigner: this.getAddressType(this.paymentAddress!) !== AddressType.p2tr
      };
    });

    const signedPsbtHex = await this.getSource()!.signPsbt(psbtHex, {
      autoFinalized: false,
      toSignInputs: toSignInputs
    });

    return signedPsbtHex;
  }
}

export { UnisatConnector };
