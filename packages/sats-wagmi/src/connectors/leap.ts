import { Network } from 'bitcoin-address-validation';

import { SatsConnector } from './base';

declare global {
  interface Window {
    /* @ts-ignore */
    leapBitcoin: any;
  }
}

class LeapConnector extends SatsConnector {
  constructor(network: Network) {
    super(network, 'leap', 'Leap Wallet', 'https://www.leapwallet.io/');
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

  async signPsbt(psbtHex: string): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Something went wrong while connecting');
    }

    if (!this.paymentAddress) {
      throw new Error('No payment address specified');
    }

    return window.leapBitcoin.signPsbt(psbtHex, { autoFinalized: false });
  }
}

export { LeapConnector };
