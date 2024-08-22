import validate, { Network } from 'bitcoin-address-validation';

import { PsbtInputAccounts, SatsConnector } from './base';

type Response<T> = {
  jsonrpc: string;
  id: string;
  result: T;
};

type AddressResult = {
  symbol: 'BTC' | 'STX';
  type: 'p2wpkh' | 'p2tr';
  address: string;
  publicKey: string;
  tweakedPublicKey: string;
  derivationPath: string;
};

interface SignPsbtRequestParams {
  hex: string;
  allowedSighash?: any[];
  signAtIndex?: number | number[];
  network?: any; // default is user's current network
  account?: number; // default is user's current account
  broadcast?: boolean; // default is false - finalize/broadcast tx
}

interface SignMessageParams {
  message: string;
  paymentType?: 'p2wpkh' | 'p2tr'; // paymentType Address type to use. p2wpkh for Native Segwit (default) or p2tr for Taproot.
  network?: any; // default is user's current network
  account?: number; // Index of account for signing (defaults to active account)
}

type RequestAddressesResult = {
  addresses: AddressResult[];
};

type RequestSignMessageResult = {
  signature: string;
  address: string;
  message: string;
};

type RequestAddressesFn = (method: 'getAddresses') => Promise<Response<RequestAddressesResult>>;

type SendBTCFn = (
  method: 'sendTransfer',
  options: {
    address: string;
    amount: string;
    network: Network;
  }
) => Promise<Response<{ txid: string }>>;

type SignPsbtFn = (method: 'signPsbt', options: SignPsbtRequestParams) => Promise<Response<{ hex: string }>>;

type SignMessageFn = (method: 'signMessage', options: SignMessageParams) => Promise<Response<RequestSignMessageResult>>;

declare global {
  interface Window {
    LeatherProvider: {
      request: RequestAddressesFn & SendBTCFn & SignPsbtFn & SignMessageFn;
    };
  }
}

class LeatherConnector extends SatsConnector {
  derivationPath: string | undefined;

  constructor(network: Network) {
    super(network, 'leather', 'Leather', 'https://leather.io/');
  }

  async connect(): Promise<void> {
    const userAddresses = await window.LeatherProvider.request('getAddresses');

    const paymentAccount = userAddresses.result.addresses.find((el: { type: string }) => el.type === 'p2wpkh');
    const ordinalsAccount = userAddresses.result.addresses.find((el: { type: string }) => el.type === 'p2tr');

    if (!paymentAccount || !ordinalsAccount) {
      throw new Error('Failed to connect wallet');
    }

    if (!validate(paymentAccount.address, this.network)) {
      throw new Error(`Invalid Network. Please switch to Bitcoin ${this.network}.`);
    }

    this.paymentAddress = paymentAccount.address;
    this.ordinalsAddress = ordinalsAccount.address;
    this.publicKey = paymentAccount.publicKey;
    this.derivationPath = paymentAccount.derivationPath;
  }

  on(): void {}

  removeListener(): void {}

  async isReady() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.ready = !!(window as any).LeatherProvider;

    return this.ready;
  }

  async signMessage(message: string): Promise<string> {
    const resp = await window.LeatherProvider.request('signMessage', {
      message,
      network: this.network
    } as SignMessageParams);

    return resp.result.signature;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    const resp = await window.LeatherProvider.request('sendTransfer', {
      address: toAddress,
      amount: amount.toString(),
      network: this.network
    });

    return resp.result.txid;
  }

  async signPsbt(psbtHex: string, psbtInputAccounts: PsbtInputAccounts[]): Promise<string> {
    // https://leather.gitbook.io/developers/bitcoin-methods/signpsbt

    // Extract all inputs to be signed
    let inputs: number[] = [];

    for (const input of psbtInputAccounts) {
      for (const index of input.signingIndexes) {
        inputs.push(index);
      }
    }

    const response = await window.LeatherProvider.request('signPsbt', {
      hex: psbtHex,
      signAtIndex: inputs,
      network: this.network,
      broadcast: false
    });

    return response.result.hex;
  }
}

export { LeatherConnector };
