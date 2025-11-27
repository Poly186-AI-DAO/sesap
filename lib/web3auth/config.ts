import { WEB3AUTH_NETWORK } from "@web3auth/modal";

// Web3Auth v10 - chain configuration is now managed via Web3Auth Dashboard
// See: https://dashboard.web3auth.io/

export const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;
export const web3AuthNetwork = WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
