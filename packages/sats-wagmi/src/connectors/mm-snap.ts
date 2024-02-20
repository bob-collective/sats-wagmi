import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import { DefaultElectrsClient } from '@gobob/bob-sdk';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import { estimateTxSize, findUtxoForInscriptionId, findUtxosWithoutInscriptions } from '@gobob/utils';
/* @ts-ignore */
import coinSelect from 'coinselect';

import { BitcoinScriptType, WalletNetwork } from '../types';
import { SnapError } from '../utils';

import { SatsConnector } from './base';

const getSnapNetwork = (network: WalletNetwork): Network => {
  switch (network) {
    default:
    case 'mainnet':
      return 'main';
    case 'testnet':
      return 'test';
  }
};

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

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

function addressFromExtPubKey(xyzpub: string, network: bitcoin.Network) {
  const forcedXpub = anyPubToXpub(xyzpub, network);
  const pubkey = bip32.fromBase58(forcedXpub, network).derive(0).derive(0).publicKey;

  return bitcoin.payments.p2wpkh({ pubkey, network }).address;
}

const DEFAULT_BIP32_PATH = "m/84'/1'/0'/0/0";
const hardcodedScriptType = BitcoinScriptType.P2WPKH;

interface ExtendedPublicKey {
  xpub: string;
  mfp: string;
}

type Network = 'main' | 'test';

declare global {
  interface Window {
    /* @ts-ignore */
    readonly ethereum: MetaMaskInpageProvider;
  }
}

const { ethereum } = window;

const snapId = 'npm:@gobob/btcsnap';

class MMSnapConnector extends SatsConnector {
  id = 'metamask_snap';
  name = 'MetaMask';
  // TODO: add when snap is published
  homepage = 'https://metamask.io/snaps/';

  extendedPublicKey: ExtendedPublicKey | undefined;
  snapNetwork: 'main' | 'test' = 'main';

  constructor(network: WalletNetwork) {
    super(network);
  }

  async connect(): Promise<void> {
    this.snapNetwork = getSnapNetwork(this.network);

    try {
      const result: any = await ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [snapId]: {}
        }
      });

      const hasError = !!result?.snaps?.[snapId]?.error;

      if (hasError) {
        throw new Error('Failed Connect');
      }
    } finally {
      // Switch in case current network is testnet
      if (this.snapNetwork === 'test') {
        await this.updateNetworkInSnap();
      }

      this.extendedPublicKey = await this.getExtendedPublicKey();
      this.publicKey = await this.getPublicKey();
      this.address = addressFromExtPubKey(this.extendedPublicKey.xpub, await this.getNetwork());
    }
  }

  async isReady(): Promise<boolean> {
    const snaps = await ethereum.request({
      method: 'wallet_getSnaps'
    });

    return Object.keys(snaps || {}).includes(snapId);
  }

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
              scriptType: BitcoinScriptType.P2WPKH
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

    const network = await this.getNetwork();

    // extKey.xpub is a vpub with purpose and cointype (mainnet vs testnet) path embedded
    // convert to xpub/tpub before getting pubkey
    const forcedXpub = anyPubToXpub(this.extendedPublicKey.xpub, await this.getNetwork());

    // child is m/84'/1'/0'/0/0 (same as DEFAULT_BIP32_PATH)
    const pubkey = bip32.fromBase58(forcedXpub, network).derive(0).derive(0).publicKey;

    return pubkey.toString('hex');
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Public key missing');
    }

    const electrsClient = new DefaultElectrsClient(this.network as string);

    const libNetwork = await this.getNetwork();
    const senderPubKey = Buffer.from(this.publicKey, 'hex');
    const senderAddress = bitcoin.payments.p2wpkh({
      pubkey: senderPubKey,
      network: libNetwork
    }).address!;

    const txOutputs = [
      {
        address: toAddress,
        value: amount
      }
    ];

    const allConfirmedUtxos = await electrsClient.getAddressUtxos(senderAddress);
    const utxos = await findUtxosWithoutInscriptions(electrsClient, allConfirmedUtxos);

    const { inputs, outputs } = coinSelect(
      utxos.map((utxo) => {
        return {
          txId: utxo.txid,
          vout: utxo.vout,
          value: utxo.value
        };
      }),
      txOutputs,
      1 // fee rate
    );

    if (!inputs || !outputs) {
      throw Error('Please make sure you gave enough funds');
    }

    const psbt = new bitcoin.Psbt({ network: libNetwork });

    for (const input of inputs) {
      const txHex = await electrsClient.getTransactionHex(input.txId);
      const utx = bitcoin.Transaction.fromHex(txHex);

      const witnessUtxo = {
        script: utx.outs[input.vout].script,
        value: input.value
      };
      const nonWitnessUtxo = utx.toBuffer();

      psbt.addInput({
        hash: input.txId,
        index: input.vout,
        nonWitnessUtxo,
        witnessUtxo,
        bip32Derivation: [
          {
            masterFingerprint: Buffer.from((await this.getMasterFingerprint()) as any, 'hex'),
            path: DEFAULT_BIP32_PATH,
            pubkey: senderPubKey
          }
        ]
      });
    }

    const changeAddress = senderAddress;

    outputs.forEach((output: any) => {
      // output may have been added for change
      if (!output.address) {
        output.address = changeAddress;
      }

      psbt.addOutput({
        address: output.address,
        value: output.value
      });
    });

    const txResult = await this.signPsbt(psbt.toBase64(), hardcodedScriptType);

    return electrsClient.broadcastTx(txResult.txHex);
  }

  async sendInscription(address: string, inscriptionId: string, feeRate = 1): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Connect failed');
    }
    const pubkey = Buffer.from(await this.publicKey, 'hex');

    const libNetwork = await this.getNetwork();
    const senderAddress = bitcoin.payments.p2wpkh({ pubkey, network: libNetwork }).address!;

    const electrsClient = new DefaultElectrsClient(this.network as string);

    const utxos = await electrsClient.getAddressUtxos(senderAddress);
    const inscriptionUtxo = await findUtxoForInscriptionId(electrsClient, utxos, inscriptionId);

    if (inscriptionUtxo === undefined) {
      throw Error(
        `Unable to find utxo owned by address [${senderAddress}] containing inscription id [${inscriptionId}]`
      );
    }

    const psbt = new bitcoin.Psbt({ network: libNetwork });
    const txHex = await electrsClient.getTransactionHex(inscriptionUtxo.txid);
    const utx = bitcoin.Transaction.fromHex(txHex);

    const witnessUtxo = {
      script: utx.outs[inscriptionUtxo.vout].script,
      value: inscriptionUtxo.value
    };
    const nonWitnessUtxo = utx.toBuffer();
    const masterFingerprint = Buffer.from((await this.getMasterFingerprint()) as any, 'hex');

    // prepare single input
    psbt.addInput({
      hash: inscriptionUtxo.txid,
      index: inscriptionUtxo.vout,
      nonWitnessUtxo,
      witnessUtxo,
      bip32Derivation: [
        {
          masterFingerprint,
          path: DEFAULT_BIP32_PATH,
          pubkey: pubkey
        }
      ]
    });

    const txSize = estimateTxSize(libNetwork, address);
    const fee = txSize * feeRate;

    psbt.addOutput({
      address: address,
      value: inscriptionUtxo.value - fee
    });

    const txResult = await this.signPsbt(psbt.toBase64(), hardcodedScriptType);

    return electrsClient.broadcastTx(txResult.txHex);
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
              scriptType: BitcoinScriptType.P2WPKH,
              inputIndex,
              path: DEFAULT_BIP32_PATH
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

  async signPsbt(base64Psbt: string, scriptType: BitcoinScriptType) {
    try {
      return (await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_signPsbt',
            params: {
              psbt: base64Psbt,
              network: this.snapNetwork,
              scriptType
            }
          }
        }
      })) as Promise<{ txId: string; txHex: string }>;
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Sign PSBT failed');

      throw error;
    }
  }

  async updateNetworkInSnap() {
    try {
      return await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId,
          request: {
            method: 'btc_network',
            params: {
              action: 'set',
              network: this.snapNetwork
            }
          }
        }
      });
    } catch (err: any) {
      const error = new SnapError(err?.message || 'Snap set Network failed');

      throw error;
    }
  }
}

export { MMSnapConnector };
