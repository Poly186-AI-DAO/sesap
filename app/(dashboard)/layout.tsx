"use client";

import { useEffect } from "react";
import { useWeb3Auth } from "@/lib/web3auth/provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isConnected, isLoading, logout } = useWeb3Auth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isConnected) {
            router.push("/login");
        }
    }, [isLoading, isConnected, router]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!isConnected) {
        return null;
    }

    return (
        <div className="flex min-h-screen flex-col">
            <header className="border-b bg-white px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">SESAP Dashboard</h1>
                <Button variant="outline" onClick={() => logout()}>Logout</Button>
            </header>
            <main className="flex-1 p-6 bg-gray-50">
                {children}
            </main>
        </div>
    );
}
