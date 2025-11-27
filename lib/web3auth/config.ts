import { Web3AuthOptions } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

export const web3AuthConfig: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  chainConfig: {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x64", // Gnosis Chain (100 in hex)
    rpcTarget: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
    displayName: "Gnosis Chain",
    blockExplorerUrl: "https://gnosisscan.io",
    ticker: "xDAI",
    tickerName: "xDAI",
  },
  uiConfig: {
    appName: "SESAP",
    mode: "light",
    loginMethodsOrder: ["google", "discord", "email_passwordless"],
    defaultLanguage: "en",
  },
};
