import { Psbt } from 'bitcoinjs-lib';
import { isValidBTCAddress } from '@gobob/utils';

import { WalletNetwork } from '../types';

import { SatsConnector } from './base';

// function extractAccountNumber(path: string) {
//   const segments = path.split('/');
//   const accountNum = parseInt(segments[3].replaceAll("'", ''), 10);

//   if (isNaN(accountNum)) throw new Error('Cannot parse account number from path');

//   return accountNum;
// }

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

type RequestAddressesResult = {
  addresses: AddressResult[];
};

type RequestAddressesFn = (method: 'getAddresses') => Promise<Response<RequestAddressesResult>>;

type SendBTCFn = (
  method: 'sendTransfer',
  options: {
    address: string;
    amount: string;
    network: WalletNetwork;
  }
) => Promise<Response<{ txid: string }>>;

type SignPsbtFn = (method: 'signPsbt', options: SignPsbtRequestParams) => Promise<Response<{ hex: string }>>;

declare global {
  interface Window {
    btc: {
      request: RequestAddressesFn & SendBTCFn & SignPsbtFn;
    };
  }
}

class LeatherConnector extends SatsConnector {
  id = 'leather';
  name = 'Leather';
  homepage = 'https://leather.io/';

  derivationPath: string | undefined;

  constructor(network: WalletNetwork) {
    super(network);
  }

  async connect(): Promise<void> {
    const userAddresses = await window.btc.request('getAddresses');
    const account = userAddresses.result.addresses.find((el: { type: string }) => el.type === 'p2tr');

    if (!account) {
      throw new Error('Failed to connect wallet');
    }

    if (!isValidBTCAddress(this.network as any, account.address)) {
      throw new Error(`Invalid Network. Please switch to bitcoin ${this.network}.`);
    }

    this.address = account.address;
    this.publicKey = account.publicKey;
    this.derivationPath = account.derivationPath;
  }

  async isReady() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.ready = !!(window as any).LeatherProvider;

    return this.ready;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    const resp = await window.btc.request('sendTransfer', {
      address: toAddress,
      amount: amount.toString(),
      network: this.network
    });

    return resp.result.txid;
  }

  async signInput(inputIndex: number, psbt: Psbt): Promise<Psbt> {
    const response = await window.btc.request('signPsbt', {
      hex: psbt.toHex(),
      signAtIndex: inputIndex,
      // account: extractAccountNumber(this.derivationPath as string),
      network: this.network,
      broadcast: false
    });

    return Psbt.fromHex(response.result.hex);
  }
}

export { LeatherConnector };
