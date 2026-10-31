import { createConfig, fallback, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import { injected } from "wagmi/connectors/injected";
import { createPublicClient, parseAbi, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

export const TOKEN = "0x5501e1fa81be1c3f49225fa7668da0245d07db60" as const;
export const CHAIN_ID = 11155111;
export const PUBLIC_RPCS = [
  "https://rpc.sepolia.ethpandaops.io",
  "https://public.1rpc.io/sepolia",
  "https://ethereum-sepolia-rpc.publicnode.com",
] as const;
const transport = () =>
  fallback(
    PUBLIC_RPCS.map((url) => http(url, { timeout: 10_000, retryCount: 0 })),
    { retryCount: 0 },
  );
export const config = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Wheel Canvas", preference: { options: "all" } }),
  ],
  transports: { [sepolia.id]: transport() },
});
export const client = createPublicClient({
  chain: sepolia,
  transport: transport(),
});
export const approvalABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
export const approvalEvent = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);
