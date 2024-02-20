import { Psbt } from 'bitcoinjs-lib';
import {
  AddressPurpose,
  BitcoinNetworkType,
  createInscription,
  getAddress,
  sendBtcTransaction,
  signTransaction
} from 'sats-connect';
import { isValidBTCAddress } from '@gobob/utils';

import { WalletNetwork } from '../types';

import { SatsConnector } from './base';

const getWalletNetwork = (network: WalletNetwork) => ({
  type: network === 'mainnet' ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet
});

declare global {
  interface Window {
    /* @ts-ignore */
    XverseProviders: any;
  }
}

class XverseConnector extends SatsConnector {
  id = 'xverse';
  name = 'Xverse';
  homepage = 'https://www.xverse.app/';

  // Needed for sendBtcTransaction function
  paymentAddress: string | undefined;

  constructor(network: WalletNetwork) {
    super(network);
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await getAddress({
        payload: {
          purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
          message: 'Address for receiving Ordinals and payments',
          network: getWalletNetwork(this.network)
        },
        onFinish: (res) => {
          const { address, publicKey } = res.addresses.find(
            (address) => address.purpose === AddressPurpose.Ordinals
          ) as {
            address: string;
            publicKey: string;
            purpose: string;
          };

          const { address: paymentAddress } = res.addresses.find(
            (address) => address.purpose === AddressPurpose.Payment
          ) as {
            address: string;
            publicKey: string;
            purpose: string;
          };

          if (!isValidBTCAddress(this.network as any, address)) {
            throw new Error(`Invalid Network. Please switch to bitcoin ${this.network}.`);
          }

          this.address = address;
          this.paymentAddress = paymentAddress;
          this.publicKey = publicKey;
          resolve();
        },
        onCancel: () => {
          reject(new Error('User rejected connect'));
        }
      });
    });
  }

  async isReady() {
    this.ready = !!window.XverseProviders;

    return this.ready;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!this.address || !this.paymentAddress) {
        return reject(new Error('Something went wrong while connecting'));
      }

      await sendBtcTransaction({
        payload: {
          network: getWalletNetwork(this.network),
          recipients: [{ address: toAddress, amountSats: BigInt(amount) }],
          senderAddress: this.paymentAddress
        },
        onFinish: (response) => {
          resolve(response);
        },
        onCancel: () => {
          reject(new Error('Send BTC Transaction canceled'));
        }
      });
    });
  }

  async inscribe(contentType: 'text' | 'image', content: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      await createInscription({
        payload: {
          network: getWalletNetwork(this.network),
          content,
          contentType: contentType === 'text' ? 'text/plain;charset=utf-8' : 'image/jpeg',
          payloadType: contentType === 'text' ? 'PLAIN_TEXT' : 'BASE_64'
        },
        onFinish: (response) => {
          resolve(response.txId);
        },
        onCancel: () => reject(new Error('Canceled'))
      });
    });
  }

  async signInput(inputIndex: number, psbt: Psbt): Promise<Psbt> {
    return new Promise(async (resolve, reject) => {
      if (!this.address) {
        return reject(new Error('Something went wrong while connecting'));
      }

      await signTransaction({
        payload: {
          network: getWalletNetwork(this.network),
          message: 'Sign Transaction',
          psbtBase64: psbt.toBase64(),
          broadcast: false,
          inputsToSign: [
            {
              address: this.address,
              signingIndexes: [inputIndex]
            }
          ]
        },
        onFinish: (response) => {
          resolve(Psbt.fromBase64(response.psbtBase64));
        },
        onCancel: () => reject(new Error('Canceled'))
      });
    });
  }
}

export { XverseConnector };
