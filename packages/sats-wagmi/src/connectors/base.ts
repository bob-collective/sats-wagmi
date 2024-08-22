import { DefaultEsploraClient, createTransfer } from '@gobob/bob-sdk';
import retry from 'async-retry';
import { Transaction } from '@scure/btc-signer';
import { hex } from '@scure/base';
import { AddressType, getAddressInfo, Network } from 'bitcoin-address-validation';

type Address = string;

interface PsbtInputAccounts {
  address: string;
  signingIndexes: number[];
}

abstract class SatsConnector {
  /** Unique connector id */
  id: string;
  /** Connector name */
  name: string;
  /** Extension or Snap homepage */
  homepage: string;

  /** Connector icon */
  icon?: string;

  /** Whether connector is usable */
  ready: boolean = false;

  /** Address types depend on which wallet is connected. Some wallets support connecting multiple addresses.
  For example:
  - Xverse: payment (P2SH) and ordinals (P2TR)
  - UniSat: depends on the user selection in the extension
  - Leather: payment (P2WPKH) and ordinals (P2TR)
  - BOB MM Snap: payment (P2WPKH) and ordinals (P2TR) */
  paymentAddress: Address | undefined = '';
  /** P2TR address for ordinals and runes is kept separate from the payment address to ensure
  that the user does not accidentally spend from the ordinals address */
  ordinalsAddress: Address | undefined = '';

  /** The public key is required to spend from P2SH and P2WSH addresses */
  publicKey: string | undefined;

  /** The Bitcoin network (mainnet, testnet, regtest) */
  // NOTE: signet is currently not supported
  network: Network;

  // TODO: add an optional electrs URL argument to the constructor
  constructor(network: Network, id: string, name: string, homepage: string, icon?: string) {
    this.network = network;
    this.id = id;
    this.name = name;
    this.homepage = homepage;
    this.icon = icon;
  }

  /** Connect to the wallet */
  abstract connect(): Promise<void>;

  /** Sign a message
   * @param message - The message to sign.
   * @returns The signature of the message.
   *
   * @example
   * ```typescript
   * const message = 'Hello, World!';
   * const signature = await connector.signMessage(message);
   * ```
   */
  abstract signMessage(message: string): Promise<string>;

  /** Sign a PSBT. This method is useful when creating custom PSBTs
   * @param psbtHex - The PSBT hex to sign.
   * @param psbtInputAccounts - The accounts to sign the PSBT with.
   * @returns The signed PSBT hex.
   *
   * @example
   * ```typescript
   * const psbtHex = 'cHNidP8BAFICAAAAA...';
   * const psbtInputAccounts = [
   *  {
   *   address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
   *  signingIndexes: [0, 1]
   * }
   * ];
   * const signed = await connector.signPsbt(psbtHex, psbtInputAccounts);
   * ```
   * @note The signingIndexes are the indexes of the inputs to sign in the PSBT.
   * @note The address is the address to sign the PSBT with.
   * @note Each wallet handle the PSBT signing differently. Check the wallet documentation for more information.
   * Unisat: https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#signpsbts
   * Xverse: https://docs.xverse.app/sats-connect/bitcoin-methods/signpsbt
   * Leather: https://leather.gitbook.io/developers/bitcoin-methods/signpsbt
   */
  abstract signPsbt(psbtHex: string, psbtInputAccounts: PsbtInputAccounts[]): Promise<string>;

  /** Verify if the wallet connection is ready (wallet unlocked, ...) */
  abstract isReady(): Promise<boolean>;

  /** Disconnect from the wallet */
  disconnect() {
    this.paymentAddress = undefined;
    this.ordinalsAddress = undefined;
    this.publicKey = undefined;
  }

  /** Get the payment address
   * @returns The payment address
   */
  getPaymentAddress(): string | undefined {
    return this.paymentAddress;
  }

  /** Get the ordinals address
   * @returns The ordinals address
   */
  getOrdinalsAddress(): string | undefined {
    return this.ordinalsAddress;
  }

  /** Convience wrapper around the getAddressInfo function
   * @param address - The address to get the type of.
   * @returns The address type of the address.
   */
  getAddressType(address: string): AddressType | undefined {
    return getAddressInfo(address).type;
  }

  /** Check if the address is authorized */
  isAuthorized(): boolean {
    const address = this.getPaymentAddress();

    return !!address;
  }
  /** Return the public key of the connected address.
   * @returns The public key of the connected address.
   */
  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Something went wrong while connecting');
    }

    return this.publicKey;
  }

  abstract on(callback: (account: string) => void): void;

  abstract removeListener(callback: (account: string) => void): void;

  /** Get the transaction from the transaction ID
   * @param txId - The transaction ID to get the transaction from.
   * @returns The transaction hex.
   *
   * @example
   * ```typescript
   * import { Transaction } from '@scure/btc-signer';
   *
   * const txId = 'f5e7 ... 3b';
   * const txHex = await connector.getTransaction(txId);
   *
   * // Decode the transaction
   * Transaction.fromRaw(Buffer.from(txHex));
   * ```
   */
  async getTransaction(txId: string): Promise<string> {
    // TODO: allow setting different electrs URLs
    const electrsClient = new DefaultEsploraClient(this.network as string);

    return retry(
      async (bail) => {
        // if anything throws, we retry
        const txHex = await electrsClient.getTransactionHex(txId);

        if (!txHex) {
          bail(new Error('Failed'));
        }

        return txHex;
      },
      {
        retries: 20,
        minTimeout: 2000,
        maxTimeout: 5000
      } as any
    );
  }

  /** Send BTC to an address
   * @param toAddress - The address to send BTC to. Can be any valid BTC address.
   * @param amount - The BTC to send denomination in satoshis.
   * @returns The transaction ID of the sent transaction.
   *
   * @example
   * ```typescript
   * const toAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
   * const amount = 10000; // 0.0001 BTC
   * const txId = await connector.sendToAddress(toAddress, amount);
   * ```
   */
  abstract sendToAddress(toAddress: string, amount: number): Promise<string>;

  /** Send BTC to an address with data in an OP_RETURN output
   * @param toAddress - The address to send BTC to. Can be any valid BTC address.
   * @param amount - The BTC to send denomination in satoshis.
   * @param data - Optional OP_RETURN data to include in the transaction.
   * @returns The transaction ID of the sent transaction.
   *
   * @example
   * ```typescript
   * const toAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
   * const amount = 10000; // 0.0001 BTC
   * const data = 'Hello, World!';
   * const txId = await connector.sendToAddressWithData(toAddress, amount, data);
   * ```
   * @note Most wallets don't support transfers with OP_RETURN data, so we need to handle this case separately
   * where wallets do not support it. This function is overwritten in the connectors that support transfer with OP_RETURN.
   * @note Most Bitcoin nodes accept 80 bytes maximum for OP_RETURN data. If you want to include more data,
   * consider using a dedicated service that can include such transactions in a block.
   */
  async sendToAddressWithData(toAddress: string, amount: number, data: string): Promise<string> {
    const electrsClient = new DefaultEsploraClient(this.network as string);

    const signedTx = await this.createTxWithOpReturn(toAddress, amount, data);

    const txId = await electrsClient.broadcastTx(signedTx);

    return txId;
  }

  /** Create and sign a transaction with an OP_RETURN output
   * @param toAddress - The address to send BTC to. Can be any valid BTC address.
   * @param amount - The BTC to send denomination in satoshis.
   * @param data - The OP_RETURN data to include in the transaction.
   * @returns The signed transaction hex.
   *
   * @example
   * ```typescript
   * const toAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
   * const amount = 10000; // 0.0001 BTC
   * const data = 'Hello, World!';
   * const signedTx = await connector.createTxWithOpReturn(toAddress, amount, data);
   * ```
   */
  async createTxWithOpReturn(toAddress: string, amount: number, data: string): Promise<string> {
    if (!this.paymentAddress) {
      throw new Error('No payment address specified');
    }

    const addressType = this.getAddressType(this.paymentAddress);

    if (!addressType) {
      throw new Error('Invalid address type');
    }

    const unsignedTransaction = await createTransfer(
      this.network as any,
      addressType,
      this.paymentAddress,
      toAddress,
      amount,
      this.publicKey,
      data
    );

    // Determine how many inputs to sign
    const inputLength = unsignedTransaction.inputsLength;
    const inputsToSign = Array.from({ length: inputLength }, (_, i) => i);

    // Sign all inputs
    const psbt = unsignedTransaction.toPSBT(0);
    const psbtHex = hex.encode(psbt);

    // Sign all inputs with the payment address
    const signedPsbtHex = await this.signPsbt(psbtHex, [
      {
        address: this.paymentAddress,
        signingIndexes: inputsToSign
      }
    ]);

    const signedTx = Transaction.fromRaw(Buffer.from(signedPsbtHex, 'hex'));

    signedTx.finalize();

    // TODO: verify this is correct.
    return signedTx.toBytes().toString();
  }
}

export { SatsConnector };
export type { PsbtInputAccounts };
