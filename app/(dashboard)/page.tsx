"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AgreementForm } from "@/components/agreements/agreement-form";
import { AgreementList } from "@/components/agreements/agreement-list";
import { AgreementView } from "@/components/agreements/agreement-view";
import { useWalletAddress } from "@/lib/web3auth/hooks";
import type { Agreement } from "@/types/agreement";

export default function DashboardPage() {
    const { address } = useWalletAddress();
    const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [stats, setStats] = useState({ total: 0, pending: 0, active: 0 });
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch stats
    useEffect(() => {
        async function fetchStats() {
            if (!address) return;

            try {
                const response = await fetch(`/api/agreements?walletAddress=${address}`);
                if (response.ok) {
                    const agreements: Agreement[] = await response.json();
                    setStats({
                        total: agreements.length,
                        pending: agreements.filter((a) => a.status === "pending" || a.status === "draft").length,
                        active: agreements.filter((a) => a.status === "active").length,
                    });
                }
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        }

        fetchStats();
    }, [address, refreshKey]);

    function handleAgreementCreated() {
        setIsCreateOpen(false);
        setRefreshKey((k) => k + 1);
    }

    function handleAgreementSelect(agreement: Agreement) {
        setSelectedAgreement(agreement);
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Agreements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Signatures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.active}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Your Agreements</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>Create Agreement</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Agreement</DialogTitle>
                        </DialogHeader>
                        <AgreementForm
                            defaultWalletAddress={address || undefined}
                            onSuccess={handleAgreementCreated}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Agreement List or View */}
            {selectedAgreement ? (
                <div className="space-y-4">
                    <Button variant="outline" onClick={() => setSelectedAgreement(null)}>
                        ← Back to List
                    </Button>
                    <AgreementView
                        agreement={selectedAgreement}
                        currentWalletAddress={address || undefined}
                        onRefresh={() => setRefreshKey((k) => k + 1)}
                    />
                </div>
            ) : (
                <AgreementList
                    key={refreshKey}
                    walletAddress={address || undefined}
                    onSelect={handleAgreementSelect}
                />
            )}
        </div>
    );
}
