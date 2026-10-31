import { useState } from "react";
import { useConnection, useSwitchChain, useWriteContract } from "wagmi";
import { decodeEventLog } from "viem";
import type { Hash } from "viem";
import {
  approvalABI,
  approvalEvent,
  CHAIN_ID,
  client,
  TOKEN,
  PUBLIC_RPCS,
} from "./chain";
import { dayKey } from "./data";

export function useSign(onConfirmed: () => void) {
  const { address, chainId } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();
  const { mutateAsync: write } = useWriteContract();
  const [phase, setPhase] = useState<
    "idle" | "switching" | "wallet" | "pending" | "confirmed" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [confirmed, setConfirmed] = useState<{
    address: string;
    date: string;
  }>();
  const changeChain = async () => {
    setError("");
    setPhase("switching");
    try {
      const params = {
        chainId: CHAIN_ID,
        addEthereumChainParameter: {
          rpcUrls: [...PUBLIC_RPCS],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
          chainName: "Sepolia",
          nativeCurrency: {
            name: "Sepolia Ether",
            symbol: "ETH",
            decimals: 18,
          },
        },
      };
      try {
        await switchChain(params);
      } catch (error) {
        // Some EIP-1193 wallets add a network without switching to it.
        if (!String(error).includes("switch after adding network")) throw error;
        await switchChain(params);
      }
      setPhase("idle");
    } catch {
      setError(
        "Switch declined. Choose Sepolia in your wallet, then try again.",
      );
      setPhase("error");
    }
  };
  const confirm = async (transaction: Hash, signer: string) => {
    setPhase("pending");
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: transaction,
        confirmations: 1,
        timeout: 120_000,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      const approved = receipt.logs.some((log) => {
        if (log.address.toLowerCase() !== TOKEN) return false;
        try {
          const decoded = decodeEventLog({
            abi: [approvalEvent],
            data: log.data,
            topics: log.topics,
          });
          return (
            decoded.args.owner?.toLowerCase() === signer.toLowerCase() &&
            decoded.args.spender?.toLowerCase() === signer.toLowerCase() &&
            decoded.args.value === 0n
          );
        } catch {
          return false;
        }
      });
      if (!approved) throw new Error("No matching signature event");
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      setConfirmed({
        address: signer,
        date: dayKey(Number(block.timestamp) * 1000),
      });
      setPhase("confirmed");
      onConfirmed();
    } catch (e) {
      setError(
        /reverted/i.test(String(e))
          ? "The transaction reverted. Check the explorer, then try again."
          : "Confirmation is taking longer. Check the transaction, or check confirmation again.",
      );
      setPhase("error");
    }
  };
  const sign = async () => {
    if (!address) return;
    if (chainId !== CHAIN_ID) {
      await changeChain();
      return;
    }
    setError("");
    setHash(undefined);
    setPhase("wallet");
    try {
      // Exact scope: SQK approve(own address, 0), on Sepolia, no ETH transfer.
      const transaction = await write({
        account: address,
        address: TOKEN,
        abi: approvalABI,
        functionName: "approve",
        args: [address, 0n],
        chainId: CHAIN_ID,
      });
      setHash(transaction);
      await confirm(transaction, address);
    } catch (e) {
      const message = String(e);
      setError(
        /reject|denied|cancel/i.test(message)
          ? "Signature declined. Nothing was sent. You can try again."
          : /insufficient/i.test(message)
            ? "You need a little Sepolia ETH for testnet gas. Add some to your wallet, then retry."
            : "Could not send the signature. Check your wallet and try again.",
      );
      setPhase("error");
    }
  };
  return {
    phase,
    error,
    hash,
    confirmed,
    sign,
    changeChain,
    check: () => (hash && address ? confirm(hash, address) : Promise.resolve()),
    busy: ["switching", "wallet", "pending"].includes(phase),
  };
}
