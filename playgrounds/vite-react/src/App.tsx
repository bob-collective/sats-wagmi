import type { FormEvent } from 'react';

import { type Hex, formatUnits, parseUnits } from 'viem';
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSignMessage,
  useWaitForTransactionReceipt
} from '@gobob/sats-wagmi';

import Gateway from './Gateway.tsx';

function formatBtc(sats: bigint) {
  return formatUnits(sats, 8);
}

function parseBtc(ether: string) {
  return parseUnits(ether, 8);
}

function App() {
  return (
    <>
      <Account />
      <Connect />
      <SignMessage />
      <Balance />
      <SendTransaction />
      <Gateway />
    </>
  );
}

function Account() {
  const account = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <div>
      <h2>Account</h2>

      <div>
        account: {account.address}
        <br />
        addressType: {account.addressType}
        {/* <br />
        status: {account.status} */}
      </div>

      {/* {account.status !== 'disconnected' && ( */}
      <button type='button' onClick={() => disconnect()}>
        Disconnect
      </button>
      {/* )} */}
    </div>
  );
}

function Connect() {
  const { connectors, connect, status, error } = useConnect();

  return (
    <div>
      <h2>Connect</h2>
      {connectors.map((connector) => (
        <button key={connector.name} type='button' onClick={() => connect({ connector })}>
          {connector.name}
        </button>
      ))}
      <div>{status}</div>
      <div>{error?.message}</div>
    </div>
  );
}

function SignMessage() {
  const { data, signMessage } = useSignMessage();

  return (
    <div>
      <h2>Sign Message</h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.target as HTMLFormElement);

          signMessage({ message: formData.get('message') as string });
        }}
      >
        <input name='message' />
        <button type='submit'>Sign Message</button>
      </form>

      {data}
    </div>
  );
}

function Balance() {
  const { data: account_ } = useBalance();

  return (
    <div>
      <h2>Balance</h2>
      <div>Balance (confirmed): {!!account_?.confirmed && formatBtc(account_.confirmed)}</div>
      <div>Balance (unconfirmed): {!!account_?.unconfirmed && formatBtc(account_.unconfirmed)}</div>
      <div>Balance (total): {!!account_?.total && formatBtc(account_.total)}</div>
    </div>
  );
}

function SendTransaction() {
  const { data: hash, error, isPending, sendTransaction } = useSendTransaction();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const to = formData.get('address') as Hex;
    const value = formData.get('value') as string;

    sendTransaction({ to, value: parseBtc(value) });
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash
  });

  return (
    <div>
      <h2>Send Transaction</h2>
      <form onSubmit={submit}>
        <input required name='address' placeholder='Address' />
        <input required name='value' placeholder='Amount (BTC)' step='0.00000001' type='number' />
        <button disabled={isPending} type='submit'>
          {isPending ? 'Confirming...' : 'Send'}
        </button>
      </form>
      {hash && <div>Transaction Hash: {hash}</div>}
      {isConfirming && 'Waiting for confirmation...'}
      {isConfirmed && 'Transaction confirmed.'}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}

export default App;
