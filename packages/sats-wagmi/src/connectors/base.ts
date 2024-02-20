import { DefaultElectrsClient, RemoteSigner, createTextInscription, inscribeData } from '@gobob/bob-sdk';
import { Network as LibNetwork, Psbt, Transaction, networks } from 'bitcoinjs-lib';
import retry from 'async-retry';
import { createImageInscription, estimateTxSize, findUtxoForInscriptionId } from '@gobob/utils';

import { WalletNetwork } from '../types';

const toXOnly = (pubKey: Buffer) => (pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33));

type Address = string;

abstract class SatsConnector {
  /** Unique connector id */
  abstract readonly id: string;
  /** Connector name */
  abstract readonly name: string;
  /** Extension or Snap homepage */
  abstract homepage: string;

  /** Whether connector is usable */
  ready: boolean = false;

  address: Address | undefined = '';

  publicKey: string | undefined;

  network: WalletNetwork;

  constructor(network: WalletNetwork) {
    this.network = network;
  }

  abstract connect(): Promise<void>;

  abstract sendToAddress(toAddress: string, amount: number): Promise<string>;

  abstract signInput(inputIndex: number, psbt: Psbt): Promise<Psbt>;

  abstract isReady(): Promise<boolean>;

  disconnect() {
    this.address = undefined;
    this.publicKey = undefined;
  }

  getAccount(): string | undefined {
    return this.address;
  }

  isAuthorized(): boolean {
    const address = this.getAccount();

    return !!address;
  }

  // Get bitcoinlib-js network
  async getNetwork(): Promise<LibNetwork> {
    switch (this.network) {
      case 'mainnet':
        return networks.bitcoin;
      case 'testnet':
        return networks.testnet;
      default:
        throw new Error('Unknown network');
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Something went wrong while connecting');
    }

    return this.publicKey;
  }

  async sendInscription(address: string, inscriptionId: string, feeRate: number = 1) {
    if (!this.address || !this.publicKey) {
      throw new Error('Connect wallet');
    }

    const network = await this.getNetwork();

    const electrsClient = new DefaultElectrsClient(this.network as string);

    const utxos = await electrsClient.getAddressUtxos(this.address);

    const inscriptionUtxo = await findUtxoForInscriptionId(electrsClient, utxos, inscriptionId);

    if (inscriptionUtxo === undefined) {
      throw Error(
        `Unable to find utxo owned by address [${this.address}] containing inscription id [${inscriptionId}]`
      );
    }

    const txHex = await electrsClient.getTransactionHex(inscriptionUtxo.txid);
    const utx = Transaction.fromHex(txHex);

    const witnessUtxo = {
      script: utx.outs[inscriptionUtxo.vout].script,
      value: inscriptionUtxo.value
    };

    const nonWitnessUtxo = utx.toBuffer();

    let psbt = new Psbt({
      network
    });

    psbt.addInput({
      hash: inscriptionUtxo.txid,
      index: inscriptionUtxo.vout,
      witnessUtxo,
      nonWitnessUtxo,
      tapInternalKey: toXOnly(Buffer.from(this.publicKey, 'hex'))
    });

    const txSize = estimateTxSize(network, address);
    const fee = txSize * feeRate;

    psbt.addOutput({
      address,
      value: inscriptionUtxo.value - fee
    });

    psbt = await this.signInput(0, psbt);

    psbt.finalizeAllInputs();

    return electrsClient.broadcastTx(psbt.extractTransaction().toHex());
  }

  async getTransaction(txId: string): Promise<Transaction> {
    const electrsClient = new DefaultElectrsClient(this.network as string);

    return retry(
      async (bail) => {
        // if anything throws, we retry
        const txHex = await electrsClient.getTransactionHex(txId);

        if (!txHex) {
          bail(new Error('Failed'));
        }

        return Transaction.fromHex(txHex);
      },
      {
        retries: 20,
        minTimeout: 2000,
        maxTimeout: 5000
      } as any
    );
  }

  async inscribe(contentType: 'text' | 'image', content: string): Promise<string> {
    if (!this.address) {
      throw new Error('Something went wrong while connecting');
    }

    const electrsClient = new DefaultElectrsClient(this.network as string);

    let inscription;

    if (contentType === 'image') {
      const buffer = Buffer.from(content, 'base64');

      inscription = createImageInscription(buffer);
    } else {
      inscription = createTextInscription(content);
    }

    const feeRate = await electrsClient.getFeeEstimate(6);

    const inscribeTx = await inscribeData(this.getSigner(), this.address, feeRate, inscription);

    return electrsClient.broadcastTx(inscribeTx.toHex());
  }

  // lib needs this signer
  getSigner(): RemoteSigner {
    return this;
  }
}

export { SatsConnector };
