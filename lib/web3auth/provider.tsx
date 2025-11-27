"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { web3AuthConfig } from "./config";

interface Web3AuthContextType {
    web3auth: Web3Auth | null;
    provider: any;
    user: any;
    isLoading: boolean;
    isConnected: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getAddress: () => Promise<string | null>;
}

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

export function Web3AuthProvider({ children }: { children: ReactNode }) {
    const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
    const [provider, setProvider] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            // Mock init
            setIsLoading(false);
        };

        init();
    }, []);

    const login = async () => {
        // Mock login for testing
        setProvider({ isMock: true });
        setUser({
            name: "Test User",
            email: "test@example.com",
            profileImage: "https://github.com/shadcn.png"
        });
        /*
        if (!web3auth) return;
        const web3authProvider = await web3auth.connect();
        setProvider(web3authProvider);
        const userInfo = await web3auth.getUserInfo();
        setUser(userInfo);
        */
    };

    const logout = async () => {
        if (!web3auth) return;
        await web3auth.logout();
        setProvider(null);
        setUser(null);
    };

    const getAddress = async (): Promise<string | null> => {
        if (!provider) return null;
        const { ethers } = await import("ethers");
        const ethersProvider = new ethers.BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        return signer.getAddress();
    };

    return (
        <Web3AuthContext.Provider
            value={{
                web3auth,
                provider,
                user,
                isLoading,
                isConnected: !!provider,
                login,
                logout,
                getAddress,
            }}
        >
            {children}
        </Web3AuthContext.Provider>
    );
}

export const useWeb3Auth = () => {
    const context = useContext(Web3AuthContext);
    if (!context) {
        throw new Error("useWeb3Auth must be used within Web3AuthProvider");
    }
    return context;
};
