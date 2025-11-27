"use client";

import { ReactNode, createContext, useContext, useCallback } from "react";
import {
    Web3AuthProvider as Web3AuthProviderBase,
    useWeb3Auth as useWeb3AuthBase,
    useWeb3AuthConnect,
    useWeb3AuthDisconnect,
    useWeb3AuthUser,
    type Web3AuthContextConfig,
} from "@web3auth/modal/react";
import { WEB3AUTH_NETWORK, type IWeb3AuthState } from "@web3auth/modal";
import { useAccount, useSignMessage as useWagmiSignMessage } from "wagmi";
import { WagmiProvider } from "@web3auth/modal/react/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

// Web3Auth v10 config - chainConfig is now managed via dashboard
const web3AuthContextConfig: Web3AuthContextConfig = {
    web3AuthOptions: {
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        uiConfig: {
            appName: "SESAP",
            mode: "light",
            defaultLanguage: "en",
        },
        ssr: true,
    },
};

const queryClient = new QueryClient();

// Custom context to provide a unified API for the rest of the app
export interface Web3AuthUser {
    email?: string;
    name?: string;
    profileImage?: string;
    verifier?: string;
    verifierId?: string;
    aggregateVerifier?: string;
    typeOfLogin?: string;
}

interface Web3AuthContextType {
    user: Web3AuthUser | null;
    isLoading: boolean;
    isConnected: boolean;
    isInitialized: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getAddress: () => Promise<string | null>;
    signMessage: (message: string) => Promise<string | null>;
}

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

// Inner provider that uses the hooks
function Web3AuthInnerProvider({ children }: { children: ReactNode }) {
    const { connect, isConnected, loading: connectLoading } = useWeb3AuthConnect();
    const { disconnect, loading: disconnectLoading } = useWeb3AuthDisconnect();
    const { userInfo } = useWeb3AuthUser();
    const { address } = useAccount();
    const { signMessageAsync } = useWagmiSignMessage();
    const { isInitialized } = useWeb3AuthBase();

    const login = useCallback(async () => {
        await connect();
    }, [connect]);

    const logout = useCallback(async () => {
        await disconnect();
    }, [disconnect]);

    const getAddress = useCallback(async (): Promise<string | null> => {
        return address ?? null;
    }, [address]);

    const signMessage = useCallback(async (message: string): Promise<string | null> => {
        if (!isConnected) return null;
        try {
            const signature = await signMessageAsync({ message });
            return signature;
        } catch (error) {
            console.error("Sign message error:", error);
            return null;
        }
    }, [isConnected, signMessageAsync]);

    return (
        <Web3AuthContext.Provider
            value={{
                user: userInfo ?? null,
                isLoading: connectLoading || disconnectLoading,
                isConnected,
                isInitialized,
                login,
                logout,
                getAddress,
                signMessage,
            }}
        >
            {children}
        </Web3AuthContext.Provider>
    );
}

// Main provider that wraps Web3AuthProviderBase and wagmi
interface Web3AuthProviderProps {
    children: ReactNode;
    web3authInitialState?: IWeb3AuthState;
}

export function Web3AuthProvider({ children, web3authInitialState }: Web3AuthProviderProps) {
    return (
        <Web3AuthProviderBase config={web3AuthContextConfig} initialState={web3authInitialState}>
            <QueryClientProvider client={queryClient}>
                <WagmiProvider>
                    <Web3AuthInnerProvider>{children}</Web3AuthInnerProvider>
                </WagmiProvider>
            </QueryClientProvider>
        </Web3AuthProviderBase>
    );
}

export const useWeb3Auth = () => {
    const context = useContext(Web3AuthContext);
    if (!context) {
        throw new Error("useWeb3Auth must be used within Web3AuthProvider");
    }
    return context;
};

// Re-export the Web3Auth hooks for direct usage if needed
export { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser };
