"use client";

import { useEffect } from "react";
import { useWeb3Auth } from "@/lib/web3auth/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { login, isConnected, isLoading, user } = useWeb3Auth();
    const router = useRouter();

    useEffect(() => {
        if (isConnected && user) {
            router.push("/");
        }
    }, [isConnected, user, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Welcome to SESAP</CardTitle>
                    <CardDescription>
                        Sign in to manage your Smart Social Agreements
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Button
                        onClick={() => login()}
                        disabled={isLoading || isConnected}
                        className="w-full"
                    >
                        {isLoading ? "Loading..." : "Login with Web3Auth"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
