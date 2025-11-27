"use client";

import { useState, useEffect, useCallback } from "react";
import { useWeb3Auth } from "./provider";

/**
 * Hook to get and cache the current wallet address
 */
export function useWalletAddress() {
  const { getAddress, isConnected } = useWeb3Auth();
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAddress = async () => {
      if (!isConnected) {
        setAddress(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const addr = await getAddress();
        setAddress(addr);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to get address")
        );
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, [isConnected, getAddress]);

  return { address, isLoading, error };
}

/**
 * Hook to sign messages with the connected wallet
 */
export function useSignMessage() {
  const { signMessage, isConnected } = useWeb3Auth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sign = useCallback(
    async (message: string): Promise<string | null> => {
      if (!isConnected) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const signature = await signMessage(message);
        return signature;
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to sign message")
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, signMessage]
  );

  return { sign, isLoading, error };
}

/**
 * Hook to check if the user is authenticated and get their session
 */
export function useAuthSession() {
  const { user, isConnected, isLoading, isInitialized } = useWeb3Auth();
  const { address } = useWalletAddress();

  return {
    user,
    address,
    isAuthenticated: isConnected && !!user,
    isLoading: isLoading || !isInitialized,
    isInitialized,
  };
}
