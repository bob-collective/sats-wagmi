import { Network } from 'bitcoin-address-validation';

import { UnisatConnector } from '../unisat';

// @ts-ignore
global.unisat = {
  signPsbt: jest.fn()
};

describe('Unisat connector', () => {
  it('should specify correct parameters when signing psbt', async () => {
    // @ts-ignore
    global.unisat.signPsbt = jest.fn();

    const unisatConnector = new UnisatConnector(Network.mainnet, 'unisat');

    unisatConnector.publicKey = 'test_public_key';
    // p2tr
    unisatConnector.paymentAddress = 'bc1p9u077kplyqud8qyc404l2t5ud8jerwph6t77cd8xqvnan30lef5sqxfjhm';
    const psbtHex = '76a914602ba26f38a2f38a0d60b38d2ab5f7ab1562c8e588ac';

    const signingIndexes = [1, 2, 3];

    await unisatConnector.signPsbt(psbtHex, [
      {
        signingIndexes,
        address: 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt_test'
      }
    ]);

    // @ts-ignore
    expect(global.unisat.signPsbt).toHaveBeenCalledWith(psbtHex, {
      autoFinalized: false,
      toSignInputs: expect.arrayContaining(
        signingIndexes.map((index) => ({
          index,
          publicKey: unisatConnector.publicKey,
          disableTweakSigner: false
        }))
      )
    });

    // segwit
    unisatConnector.paymentAddress = 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt';

    await unisatConnector.signPsbt(psbtHex, [
      {
        signingIndexes,
        address: 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt_test'
      }
    ]);

    // @ts-ignore
    expect(global.unisat.signPsbt).toHaveBeenCalledWith(psbtHex, {
      autoFinalized: false,
      toSignInputs: expect.arrayContaining(
        signingIndexes.map((index) => ({
          index,
          publicKey: unisatConnector.publicKey,
          disableTweakSigner: true
        }))
      )
    });
  });
});
