import React, { useEffect, useState } from "react";

export default function App() {
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);

  // load wallet balance, history, addresses
  useEffect(() => {
    fetch("http://127.0.0.1:5000/balance")
      .then(res => res.json())
      .then(setBalance);

    fetch("http://127.0.0.1:5000/history")
      .then(res => res.json())
      .then(data => setHistory(data.response || []));

    reloadAddresses();
  }, []);

  const reloadAddresses = () => {
    fetch("http://127.0.0.1:5000/addresses")
      .then(res => res.json())
      .then(setAddresses);
  };

  const createAddress = async () => {
    const label = prompt("Label for new address (optional):") || null;
    await fetch("http://127.0.0.1:5000/addresses", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ label })
    });
    reloadAddresses();
  };

  const setLabel = async (addr) => {
    const label = prompt("New label:");
    if (label === null) return;
    await fetch("http://127.0.0.1:5000/label", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ address: addr, label })
    });
    reloadAddresses();
  };

  const checkAddressBalance = async (addr) => {
    setSelected(null);
    const res = await fetch(`http://127.0.0.1:5000/balance/${addr}`);
    const data = await res.json();
    setSelected(data);
  };

  const sendToken = async () => {
    const address = prompt("Enter recipient address:");
    const amount = prompt("Enter amount:");
    if (!address || !amount) return;
    const res = await fetch("http://127.0.0.1:5000/send", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({address, amount})
    });
    alert(await res.text());
  };

  return (
    <div className="p-4 font-sans max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🚀 MyToken Wallet</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Wallet Total (All Addresses)</h2>
        {balance && balance.token ? (
          <p>Balance: <b>{balance.sendable}</b> {balance.token}</p>
        ) : <p>Loading…</p>}
        <button onClick={sendToken} className="bg-blue-600 text-white px-4 py-2 mt-3 rounded">
          Send Token
        </button>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-2">Addresses</h2>
          <button onClick={createAddress} className="bg-green-600 text-white px-3 py-2 rounded">
            + New Address
          </button>
        </div>

        <ul className="divide-y">
          {addresses.map((a) => (
            <li key={a.address} className="py-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="text-sm text-gray-600">{a.label || "(no label)"}</div>
                  <div className="font-mono text-sm break-all">{a.address}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkAddressBalance(a.address)}
                    className="border px-3 py-1 rounded"
                  >
                    Check Balance
                  </button>
                  <button
                    onClick={() => setLabel(a.address)}
                    className="border px-3 py-1 rounded"
                  >
                    Set Label
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="mt-4 p-3 border rounded">
            <div className="text-sm text-gray-600 mb-1">Address:</div>
            <div className="font-mono text-sm break-all mb-2">{selected.address}</div>
            <div><b>Balance:</b> {selected.balance}</div>
            <details className="mt-2">
              <summary className="cursor-pointer">UTXOs</summary>
              <pre className="text-xs overflow-auto">{JSON.stringify(selected.utxos, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Transaction History</h2>
        <ul className="list-disc pl-6 text-sm">
          {history.map((tx, i) => (
            <li key={i} className="break-all">{tx.txpowid}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
