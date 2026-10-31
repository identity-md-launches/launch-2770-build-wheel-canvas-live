import { useState } from "react";
import { useConnect, useConnectors } from "wagmi";
import type { Connector } from "wagmi";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { OPEN_IN, isMobileBrowser } from "../lib/open-in";
export function WalletSheet({ onClose }: { onClose: () => void }) {
  const connectors = useConnectors();
  const { mutateAsync: connect, isPending, variables } = useConnect();
  const [error, setError] = useState("");
  const mobile =
    isMobileBrowser() &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && !(mobile && c.type === "injected"),
  );
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK"
        ? mobile
          ? "Coinbase Smart Wallet"
          : "Coinbase Wallet"
        : c.name;
  const pick = async (connector: Connector) => {
    setError("");
    try {
      await connect({ connector });
      onClose();
    } catch (e) {
      setError(
        /reject|denied|cancel/i.test(String(e))
          ? "Connection declined. Choose a wallet to try again."
          : connector.id === "injected"
            ? "No browser wallet found. Install a wallet extension, then reload this page."
            : "Could not connect. Check your wallet and try again.",
      );
    }
  };
  return (
    <Modal title="Connect a wallet" onClose={onClose}>
      <p className="muted">Connect to add your color to tonight’s canvas.</p>
      <div className="wallet-rows">
        {mobile &&
          OPEN_IN.map((w) => (
            <a className="wallet-row" key={w.id} href={w.href(location.href)}>
              <img
                src={`./wallets/${w.id}.svg`}
                width="28"
                height="28"
                alt=""
              />
              <span>Open in {w.name}</span>
              <Icon name="external" size={16} />
            </a>
          ))}
        {listed.map((c) => (
          <button
            key={c.uid}
            className="wallet-row"
            disabled={isPending}
            onClick={() => void pick(c)}
          >
            {c.icon ? (
              <img src={c.icon} width="28" height="28" alt="" />
            ) : c.id === "coinbaseWalletSDK" ? (
              <img src="./wallets/coinbase.svg" width="28" height="28" alt="" />
            ) : (
              <Icon name="wallet" size={28} />
            )}
            <span>
              {label(c)}
              {isPending && variables?.connector === c ? " · opening…" : ""}
            </span>
            <Icon name="arrow" size={16} />
          </button>
        ))}
      </div>
      <p className="feedback" role="status">
        {error}
      </p>
      <p className="safe-note">
        <Icon name="info" size={16} />
        <span>
          Sepolia testnet only. No real funds. Signing requests one zero-value
          SQK approval to your own address, plus testnet gas. Nothing else.
        </span>
      </p>
    </Modal>
  );
}
