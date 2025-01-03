import { Network } from 'bitcoin-address-validation';

import { OKXConnector } from '../okx';

// @ts-ignore
global.okxwallet = {
  bitcoin: {
    signPsbt: jest.fn()
  }
};

describe('OKX connector', () => {
  it('should specify correct parameters when signing psbt', async () => {
    const okxConnector = new OKXConnector(Network.mainnet);

    okxConnector.publicKey = 'test_public_key';
    // p2tr
    okxConnector.paymentAddress = 'bc1p9u077kplyqud8qyc404l2t5ud8jerwph6t77cd8xqvnan30lef5sqxfjhm';
    const psbtHex = '76a914602ba26f38a2f38a0d60b38d2ab5f7ab1562c8e588ac';

    const signingIndexes = [1, 2, 3];

    await okxConnector.signPsbt(psbtHex, [
      {
        signingIndexes,
        address: 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt_test'
      }
    ]);

    // @ts-ignore
    expect(global.okxwallet.bitcoin.signPsbt).toHaveBeenCalledWith(psbtHex, {
      autoFinalized: false,
      toSignInputs: expect.arrayContaining(
        signingIndexes.map((index) => ({
          index,
          address: okxConnector.paymentAddress,
          disableTweakSigner: false
        }))
      )
    });

    // segwit
    okxConnector.paymentAddress = 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt';

    await okxConnector.signPsbt(psbtHex, [
      {
        signingIndexes,
        address: 'bc1qqfnxscmxnfhy2ek5uvp6u9wjd9xhs95ksydtnt_test'
      }
    ]);

    // @ts-ignore
    expect(global.okxwallet.bitcoin.signPsbt).toHaveBeenCalledWith(psbtHex, {
      autoFinalized: false,
      toSignInputs: expect.arrayContaining(
        signingIndexes.map((index) => ({
          index,
          publicKey: okxConnector.publicKey,
          disableTweakSigner: true
        }))
      )
    });
  });
});
