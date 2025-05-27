import { Network } from 'bitcoin-address-validation';

import { PsbtInputAccounts, SatsConnector } from './base';

declare global {
  interface Window {
    /* @ts-ignore */
    leapBitcoin: any;
  }
}

class LeapConnector extends SatsConnector {
  constructor(network: Network) {
    super(network, 'leap', 'Leap', 'https://www.leapwallet.io/');
  }

  async connect(): Promise<void> {
    await window.leapBitcoin.switchNetwork(this.network);

    const [accounts, publicKey] = await Promise.all([
      window.leapBitcoin.connectWallet(),
      window.leapBitcoin.getPublicKey()
    ]);

    this.paymentAddress = accounts[0];
    this.ordinalsAddress = accounts[0];
    this.publicKey = publicKey;
  }

  on(): void {}

  removeListener(): void {}

  async isReady() {
    this.ready = !!window.leapBitcoin;

    return this.ready;
  }

  disconnect() {
    this.paymentAddress = undefined;
    this.publicKey = undefined;
  }

  signMessage(message: string) {
    return window.leapBitcoin.signMessage(message);
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    return window.leapBitcoin.sendBitcoin(toAddress, amount);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signPsbt(psbtHex: string, psbtInputAccounts: PsbtInputAccounts[]): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Something went wrong while connecting');
    }

    // // Extract all inputs to be signed
    // let inputs: number[] = [];

    // for (const input of psbtInputAccounts) {
    //   for (const index of input.signingIndexes) {
    //     inputs.push(index);
    //   }
    // }

    if (!this.paymentAddress) {
      throw new Error('No payment address specified');
    }

    // // Map psbtInputAccounts to SignPsbtOptions for Wallet B's API
    // const options = {
    //   autoFinalized: false, // Default value; adjust as needed
    //   contracts: psbtInputAccounts.map((account) => ({
    //     id: account.address, // Use address as a unique identifier for the contract
    //     params: {
    //       signingIndexes: account.signingIndexes // Pass signing indices, though Wallet B may ignore this
    //     }
    //   }))
    // };

    // // @ts-ignore
    // return await window.leapBitcoin.request({
    //   method: 'btc_signPsbt',
    //   params: [psbtHex, options]
    // });

    // MEMO: leap wallet only accepts an argument
    return window.leapBitcoin.signPsbt(psbtHex);
  }
}

export { LeapConnector };
