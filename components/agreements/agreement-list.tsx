"use client";

/**
 * Agreement List Component
 * Displays a list of agreements with filtering and status indicators
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Agreement } from "@/types/agreement";

interface AgreementListProps {
    walletAddress?: string;
    onSelect?: (agreement: Agreement) => void;
}

export function AgreementList({ walletAddress, onSelect }: AgreementListProps) {
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");

    useEffect(() => {
        async function fetchAgreements() {
            if (!walletAddress) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/agreements?walletAddress=${walletAddress}`);
                if (response.ok) {
                    const data = await response.json();
                    setAgreements(data);
                }
            } catch (error) {
                console.error("Failed to fetch agreements:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchAgreements();
    }, [walletAddress]);

    // Filter agreements
    const filteredAgreements = filter === "all"
        ? agreements
        : agreements.filter((a) => a.status === filter);

    // Status badge color
    const statusColors: Record<string, string> = {
        draft: "bg-yellow-100 text-yellow-800",
        pending: "bg-blue-100 text-blue-800",
        active: "bg-green-100 text-green-800",
        completed: "bg-gray-100 text-gray-800",
        cancelled: "bg-red-100 text-red-800",
    };

    // Type icons (text-based for simplicity)
    const typeLabels: Record<string, string> = {
        collaboration: "🤝 Collaboration",
        service: "💼 Service",
        investment: "💰 Investment",
        custom: "📝 Custom",
    };

    if (!walletAddress) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">Connect your wallet to view agreements</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
                {["all", "draft", "pending", "active", "completed"].map((status) => (
                    <Button
                        key={status}
                        variant={filter === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(status)}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Agreement List */}
            {filteredAgreements.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">
                            {filter === "all"
                                ? "No agreements yet. Create your first one!"
                                : `No ${filter} agreements`}
                        </p>
                        {filter === "all" && (
                            <Link href="/agreements/new">
                                <Button className="mt-4">Create Agreement</Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredAgreements.map((agreement) => {
                        const signedCount = agreement.parties.filter((p) => p.signature).length;
                        const totalParties = agreement.parties.length;

                        return (
                            <Card
                                key={agreement.id}
                                className="cursor-pointer transition-all hover:border-primary/50"
                                onClick={() => onSelect?.(agreement)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-lg">
                                                {typeLabels[agreement.type] || agreement.type}
                                            </CardTitle>
                                            <CardDescription>
                                                Created {new Date(agreement.createdAt).toLocaleDateString()}
                                            </CardDescription>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[agreement.status] || statusColors.draft}`}>
                                            {agreement.status}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Parties */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {agreement.parties.map((party) => (
                                            <span
                                                key={party.id}
                                                className={`rounded-full px-2 py-1 text-xs ${party.signature
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {party.name} ({party.role})
                                            </span>
                                        ))}
                                    </div>

                                    {/* Signature Progress */}
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 flex-1 rounded-full bg-gray-200">
                                            <div
                                                className="h-2 rounded-full bg-green-500 transition-all"
                                                style={{ width: `${(signedCount / totalParties) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {signedCount}/{totalParties} signed
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
