import { ElectrsClient, UTXO } from '@gobob/bob-sdk';
import { TESTNET_ORD_BASE_PATH } from '@gobob/bob-sdk/dist/ordinal-api';

import { getTxInscriptions, parseInscriptionId } from './inscription';

interface InscriptionUTXO {
  value: number;
  script_pubkey: string;
  address: string;
  transaction: string;
  sat_ranges: string;
  inscriptions: string[];
  runes: Record<string, any>;
}

export async function findUtxoForInscriptionId(
  electrsClient: ElectrsClient,
  utxos: UTXO[],
  inscriptionId: string
): Promise<UTXO | undefined> {
  // TODO: can we get the current UTXO of the inscription from ord?
  // we can use the satpoint for this
  const { txid, index } = parseInscriptionId(inscriptionId);

  for (const utxo of utxos) {
    if (utxo.confirmed) {
      const res = await fetch(`${TESTNET_ORD_BASE_PATH}/output/${utxo.txid}:${utxo.vout}`, {
        headers: {
          Accept: 'application/json'
        }
      });

      const inscriptionUtxo: InscriptionUTXO = await res.json();

      if (inscriptionUtxo.inscriptions && inscriptionUtxo.inscriptions.includes(inscriptionId)) {
        return utxo;
      }
    } else if (txid == utxo.txid) {
      const inscriptions = await getTxInscriptions(electrsClient, utxo.txid);

      if (typeof inscriptions[index] !== 'undefined') {
        return utxo;
      }
    }
  }

  return undefined;
}

export async function findUtxosWithoutInscriptions(electrsClient: ElectrsClient, utxos: UTXO[]): Promise<UTXO[]> {
  const safeUtxos = [];

  for (const utxo of utxos) {
    if (utxo.confirmed) {
      const res = await fetch(`${TESTNET_ORD_BASE_PATH}/output/${utxo.txid}:${utxo.vout}`, {
        headers: {
          Accept: 'application/json'
        }
      });

      const inscriptionUtxo: InscriptionUTXO = await res.json();

      if (inscriptionUtxo.inscriptions.length === 0) {
        safeUtxos.push(utxo);
      }
    } else {
      // we can't use the ord indexer if the tx is unconfirmed
      const inscriptions = await getTxInscriptions(electrsClient, utxo.txid);

      if (inscriptions.length === 0) {
        safeUtxos.push(utxo);
      }
    }
  }

  return safeUtxos;
}
