import * as bitcoin from 'bitcoinjs-lib';

export function estimateTxSize(network: bitcoin.Network, toAddress: string) {
  const tx = new bitcoin.Transaction();

  tx.addInput(Buffer.alloc(32, 0), 0);
  tx.ins[0].witness = [Buffer.alloc(71, 0), Buffer.alloc(33, 0)];
  tx.addOutput(bitcoin.address.toOutputScript(toAddress, network), 0);

  return tx.virtualSize();
}
