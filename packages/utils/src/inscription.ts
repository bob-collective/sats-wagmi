import { ElectrsClient, Inscription } from '@gobob/bob-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { InscriptionId } from '@gobob/bob-sdk/dist/ordinal-api';

const TAPROOT_ANNEX_PREFIX = 0x50;
const PROTOCOL_ID = Buffer.from('6f7264', 'hex');

const CONTENT_TYPE_TAG = bitcoin.opcodes.OP_1;

export function getTapscript(witness: Buffer[]) {
  const len = witness.length;
  const last = witness[len - 1];

  if (typeof last === 'undefined') {
    return null;
  }
  let scriptPosFromLast = 2;

  if (len >= 2 && last[0] == TAPROOT_ANNEX_PREFIX) {
    scriptPosFromLast = 3;
  }
  if (typeof witness[len - scriptPosFromLast] === 'undefined') {
    return null;
  }

  return bitcoin.script.decompile(witness[len - scriptPosFromLast]);
}

interface Tags {
  [key: number]: Buffer | null;
}
interface ParseInscription {
  tags: Tags;
  body: Buffer[];
}

export function parseInscriptions(tx: bitcoin.Transaction) {
  let inscriptions: ParseInscription[] = [];

  for (const txInput of tx.ins) {
    const tapscript = getTapscript(txInput.witness);

    if (tapscript == null) {
      continue;
    }

    const chunks = tapscript.values();

    for (let chunk = chunks.next(); !chunk.done; chunk = chunks.next()) {
      // envelope is `OP_FALSE OP_IF ... OP_ENDIF`
      if (chunk.value != bitcoin.opcodes.OP_FALSE) {
        continue;
      }
      if (chunks.next().value != bitcoin.opcodes.OP_IF) {
        continue;
      }

      // check next push is "ord"
      const data = chunks.next().value;

      if (!Buffer.isBuffer(data) && !data.equals(PROTOCOL_ID)) {
        continue;
      }

      let tags: Tags = {};
      let body: Buffer[] = [];
      let isBody = false;

      for (let chunk = chunks.next(); !chunk.done; chunk = chunks.next()) {
        if (chunk.value == bitcoin.opcodes.OP_ENDIF) {
          inscriptions.push({ tags, body });
          break;
        } else if (chunk.value == bitcoin.opcodes.OP_0) {
          // `OP_PUSH 0` indicates that subsequent data pushes contain the content itself
          isBody = true;
          continue;
        }
        // fields are before body, e.g. `OP_PUSH 1` is content type
        if (!isBody) {
          const data = chunks.next().value;

          if (typeof chunk.value == 'number' && Buffer.isBuffer(data)) {
            tags[chunk.value] = data;
          }
        } else if (Buffer.isBuffer(chunk.value)) {
          body.push(chunk.value);
        }
      }
    }
  }

  return inscriptions;
}

export async function getTxInscriptions(electrsClient: ElectrsClient, txid: string) {
  const txHex = await electrsClient.getTransactionHex(txid);
  const tx = bitcoin.Transaction.fromHex(txHex);

  return parseInscriptions(tx);
}

export function parseInscriptionId(id: string): { txid: string; index: number } {
  const [txid, index] = id.split('i');

  return {
    txid,
    index: parseInt(index, 10)
  };
}

const encoder = new TextEncoder();

export function createImageInscription(image: Buffer): Inscription {
  const contentType = Buffer.from(encoder.encode('image/jpg'));

  return { contentType, content: image };
}

export async function getInscriptionFromId(electrsClient: ElectrsClient, inscriptionId: string) {
  const { txid, index } = InscriptionId.fromString(inscriptionId);
  const inscriptions = await getTxInscriptions(electrsClient, txid);

  return inscriptions[index];
}

export function getContentType(inscription: ParseInscription): string | null {
  const data: Buffer | null = inscription.tags[CONTENT_TYPE_TAG];

  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }

  return null;
}
