"use client";

/**
 * Agreement View Component
 * Displays agreement details with markdown rendering and signature status
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Agreement } from "@/types/agreement";

interface AgreementViewProps {
    agreement: Agreement;
    currentWalletAddress?: string;
    onSign?: (agreement: Agreement) => void;
    onRefresh?: () => void;
}

export function AgreementView({
    agreement,
    currentWalletAddress,
    onSign,
    onRefresh,
}: AgreementViewProps) {
    const [isSigning, setIsSigning] = useState(false);

    // Find current user's party
    const currentParty = agreement.parties.find(
        (p) => p.walletAddress.toLowerCase() === currentWalletAddress?.toLowerCase()
    );

    // Check if current user has already signed
    const hasCurrentUserSigned = currentParty?.signature !== null && currentParty?.signature !== undefined;

    // Count signatures
    const totalParties = agreement.parties.length;
    const signedCount = agreement.parties.filter((p) => p.signature).length;

    // Status badge color
    const statusColors: Record<string, string> = {
        draft: "bg-yellow-100 text-yellow-800",
        pending: "bg-blue-100 text-blue-800",
        active: "bg-green-100 text-green-800",
        completed: "bg-gray-100 text-gray-800",
        cancelled: "bg-red-100 text-red-800",
    };

    async function handleSign() {
        if (!currentWalletAddress) {
            toast.error("Please connect your wallet first");
            return;
        }

        setIsSigning(true);
        try {
            const response = await fetch(`/api/agreements/${agreement.id}/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: currentWalletAddress,
                    signature: `signed-by-${currentWalletAddress}-at-${Date.now()}`, // Placeholder - replace with actual Web3Auth signature
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to sign agreement");
            }

            const result = await response.json();
            toast.success("Agreement signed successfully!");
            onSign?.(result);
            onRefresh?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to sign agreement");
        } finally {
            setIsSigning(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold capitalize">
                        {agreement.type.replace(/-/g, " ")} Agreement
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Created {new Date(agreement.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[agreement.status] || statusColors.draft}`}>
                    {agreement.status}
                </span>
            </div>

            {/* Signature Progress */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Signatures</CardTitle>
                    <CardDescription>
                        {signedCount} of {totalParties} parties have signed
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {agreement.parties.map((party) => (
                            <div
                                key={party.id}
                                className="flex items-center justify-between rounded-lg border p-3"
                            >
                                <div>
                                    <p className="font-medium">{party.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {party.role} • {party.walletAddress.slice(0, 6)}...{party.walletAddress.slice(-4)}
                                    </p>
                                </div>
                                {party.signature ? (
                                    <div className="text-right">
                                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                            Signed
                                        </span>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(party.signature.signedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ) : (
                                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                                        Pending
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Sign Button */}
                    {currentParty && !hasCurrentUserSigned && (
                        <Button
                            className="mt-4 w-full"
                            onClick={handleSign}
                            disabled={isSigning}
                        >
                            {isSigning ? "Signing..." : "Sign Agreement"}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Contract Text */}
            <Card>
                <CardHeader>
                    <CardTitle>Agreement Content</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{agreement.contractText}</ReactMarkdown>
                    </div>
                </CardContent>
            </Card>

            {/* Blockchain Info */}
            {(agreement.ipfsHash || agreement.txHash) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Blockchain Record</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {agreement.ipfsHash && (
                            <div>
                                <p className="text-sm font-medium">IPFS Hash</p>
                                <p className="text-xs text-muted-foreground font-mono break-all">
                                    {agreement.ipfsHash}
                                </p>
                            </div>
                        )}
                        {agreement.txHash && (
                            <div>
                                <p className="text-sm font-medium">Transaction Hash</p>
                                <p className="text-xs text-muted-foreground font-mono break-all">
                                    {agreement.txHash}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
