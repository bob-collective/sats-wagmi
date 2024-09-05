import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { BIP32API, BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import { base64, hex } from '@scure/base';
import { Network } from 'bitcoin-address-validation';
/* @ts-ignore */

import { SnapError } from '../utils';

import { PsbtInputAccounts, SatsConnector } from './base';

// https://github.com/bob-collective/bob-snap/blob/e34ab61def4ad65792d6150cd46af8c733a73c0d/packages/snap/src/interface.ts#L122-L125
type WalletNetwork = 'main' | 'test';

const getLibNetwork = (network: WalletNetwork): Network => {
  switch (network) {
    case 'main':
      return Network.mainnet;
    case 'test':
      return Network.testnet;
  }
};

const getSnapNetwork = (network: Network): WalletNetwork => {
  switch (network) {
    default:
    case 'mainnet':
      return 'main';
    case 'testnet':
      return 'test';
  }
};

const getBitcoinJsNetwork = (network: Network): bitcoin.Network => {
  switch (network) {
    default:
    case 'mainnet':
      return bitcoin.networks.bitcoin;
    case 'testnet':
      return bitcoin.networks.testnet;
  }
};

function anyPubToXpub(xyzpub: string, network: bitcoin.Network) {
  let data = bs58check.decode(xyzpub);

  data = data.subarray(4);

  // force to xpub/tpub format
  const tpubPrefix = '043587cf';
  const xpubPrefix = '0488b21e';
  const prefix = network === bitcoin.networks.testnet ? tpubPrefix : xpubPrefix;

  data = Buffer.concat([Buffer.from(prefix, 'hex'), data]);

  return bs58check.encode(data);
}

function addressFromExtPubKey(bip32: BIP32API, xyzpub: string, network: bitcoin.Network) {
  const forcedXpub = anyPubToXpub(xyzpub, network);
  const pubkey = bip32.fromBase58(forcedXpub, network).derive(0).derive(0).publicKey;

  return bitcoin.payments.p2wpkh({ pubkey, network }).address;
}

export enum BitcoinScriptType {
  P2WPKH = 'P2WPKH'
}

const getDefaultBip32Path = (scriptType: BitcoinScriptType, network: WalletNetwork): string => {
  switch (scriptType) {
    case BitcoinScriptType.P2WPKH:
      return `m/84'/${network === 'main' ? '0' : '1'}'/0'/0/0`;
  }
};

const DEFAULT_SCRIPT_TYPE = BitcoinScriptType.P2WPKH;

interface ExtendedPublicKey {
  xpub: string;
  mfp: string;
}

declare global {
  interface Window {
    /* @ts-ignore */
    readonly ethereum: MetaMaskInpageProvider;
  }
}

const { ethereum } = window;

const snapId = 'npm:@gobob/bob-snap';

// TODO: distinguish between payment and ordinals address
class MMSnapConnector extends SatsConnector {
  extendedPublicKey: ExtendedPublicKey | undefined;
  snapNetwork: WalletNetwork = 'main';
  bip32: BIP32API;

  constructor(network: Network) {
    super(network, 'metamask_snap', 'MetaMask', 'https://snaps.metamask.io/snap/npm/gobob/bob-snap/');
    bitcoin.initEccLib(ecc);
    this.bip32 = BIP32Factory(ecc);
  }

  async connect(): Promise<void> {
    this.snapNetwork = getSnapNetwork(this.network);

    try {
      const result: any = await ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [snapId]: {
            version: '2.2.2'
          }
        }
      });

      // eslint-disable-next-line no-console
      console.log('Using snap version:', result?.[snapId]?.version);
    } finally {
      const mappedNetwork = getLibNetwork(this.snapNetwork);

      if (mappedNetwork !== this.network) {
        const expectedNetwork = getSnapNetwork(this.network);

        // Switch in case current network is wrong
        await this.updateNetworkInSnap(expectedNetwork);
      }

      this.extendedPublicKey = await this.getExtendedPublicKey();
      this.publicKey = await this.getPublicKey();
      // Set the address to P2WPKH
      this.paymentAddress = addressFromExtPubKey(
        this.bip32,
        this.extendedPublicKey.xpub,
        getBitcoinJsNetwork(this.network)
      );
    }
  }

  async isReady(): Promise<boolean> {
    const snaps = await ethereum.request({
      method: 'wallet_getSnaps'
    });

    return Object.keys(snaps || {}).includes(snapId);
  }

  on(): void {}

  removeListener(): void {}

  async getExtendedPublicKey() {
    if (this.extendedPublicKey) {
      return this.extendedPublicKey;
    }

    try {
      return (await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_getPublicExtendedKey',
            params: {
              network: this.snapNetwork,
              scriptType: DEFAULT_SCRIPT_TYPE
            }
          }
        }
      })) as ExtendedPublicKey;
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Get extended public key failed');

      throw error;
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.extendedPublicKey) {
      throw new Error('Something wrong with connect');
    }

    const network = getBitcoinJsNetwork(this.network);

    // extKey.xpub is a vpub with purpose and cointype (mainnet vs testnet) path embedded
    // convert to xpub/tpub before getting pubkey
    const forcedXpub = anyPubToXpub(this.extendedPublicKey.xpub, network);

    // child is m/84'/0'/0'/0/0
    const pubkey = this.bip32.fromBase58(forcedXpub, network).derive(0).derive(0).publicKey;

    return pubkey.toString('hex');
  }

  signMessage(): Promise<string> {
    throw new Error('Not implemented');
  }

  async signInput(inputIndex: number, psbt: Psbt) {
    try {
      const psbtBase64 = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_signInput',
            params: {
              psbt: psbt.toBase64(),
              network: this.snapNetwork,
              scriptType: DEFAULT_SCRIPT_TYPE,
              inputIndex,
              path: getDefaultBip32Path(DEFAULT_SCRIPT_TYPE, this.snapNetwork)
            }
          }
        }
      });

      if (!psbtBase64) {
        throw new Error('');
      }

      return bitcoin.Psbt.fromBase64(psbtBase64 as string);
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Sign Input failed');

      throw error;
    }
  }

  async getMasterFingerprint() {
    try {
      return await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_getMasterFingerprint'
          }
        }
      });
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Snap get master fingerprint failed');

      throw error;
    }
  }

  async signPsbt(psbtHex: string, _psbtInputAccounts: PsbtInputAccounts[]): Promise<string> {
    const psbt = bitcoin.Psbt.fromHex(psbtHex);
    const masterFingerprint = Buffer.from((await this.getMasterFingerprint()) as any, 'hex');
    const publicKey = Buffer.from(this.publicKey!, 'hex');
    const bip32Path = getDefaultBip32Path(DEFAULT_SCRIPT_TYPE, this.snapNetwork);

    psbt.data.inputs.forEach(
      (psbtInput) =>
        (psbtInput.bip32Derivation = [
          {
            masterFingerprint: masterFingerprint,
            path: bip32Path,
            pubkey: publicKey
          }
        ])
    );

    try {
      const psbtBase64 = (await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_signPsbt',
            params: {
              psbt: psbt.toBase64(),
              network: this.snapNetwork,
              scriptType: DEFAULT_SCRIPT_TYPE,
              opts: {
                autoFinalize: false
              }
            }
          }
        }
      })) as string;

      return hex.encode(base64.decode(psbtBase64));
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Could not sign psbt');

      throw error;
    }
  }

  async updateNetworkInSnap(expectedNetwork: WalletNetwork) {
    try {
      return await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_network',
            params: {
              action: 'set',
              network: expectedNetwork
            }
          }
        }
      });
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Snap set network failed');

      throw error;
    }
  }
}

export { MMSnapConnector };
