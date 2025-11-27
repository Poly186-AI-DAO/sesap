"use client";

/**
 * Transcript Analyzer Component
 * Analyzes meeting transcripts/documents and extracts SSC elements
 * Then allows conversion to a full agreement
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Party {
    name: string;
    role: string;
    identifiers?: string[];
}

interface KeyTerm {
    term: string;
    value: string;
    context: string;
}

interface Obligation {
    party: string;
    obligation: string;
    deadline?: string;
}

interface ExtractedElements {
    suggestedType: string;
    parties: Party[];
    keyTerms: KeyTerm[];
    obligations: Obligation[];
    suggestedTitle: string;
    summary: string;
    confidence: number;
}

interface GeneratedContract {
    title: string;
    markdown: string;
    data: Record<string, unknown>;
    type: string;
}

interface TranscriptAnalyzerProps {
    defaultWalletAddress?: string;
    onAgreementCreated?: (agreement: unknown) => void;
}

export function TranscriptAnalyzer({ defaultWalletAddress, onAgreementCreated }: TranscriptAnalyzerProps) {
    const [transcript, setTranscript] = useState("");
    const [context, setContext] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [extractedElements, setExtractedElements] = useState<ExtractedElements | null>(null);
    const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
    const [generatedContract, setGeneratedContract] = useState<GeneratedContract | null>(null);

    async function handleAnalyze() {
        if (transcript.length < 50) {
            toast.error("Transcript must be at least 50 characters");
            return;
        }

        setIsAnalyzing(true);
        setExtractedElements(null);
        setGeneratedContract(null);

        try {
            const response = await fetch("/api/agents/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcript,
                    context: context || undefined,
                    generateDraft: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to analyze transcript");
            }

            const data = await response.json();
            setExtractedElements(data.elements);

            // Initialize wallet addresses with default for first party
            const initialAddresses: Record<string, string> = {};
            data.elements.parties.forEach((party: Party, index: number) => {
                initialAddresses[party.name] = index === 0 && defaultWalletAddress
                    ? defaultWalletAddress
                    : "";
            });
            setWalletAddresses(initialAddresses);

            toast.success("Transcript analyzed successfully!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to analyze transcript");
        } finally {
            setIsAnalyzing(false);
        }
    }

    async function handleGenerateAgreement() {
        if (!extractedElements) return;

        // Validate all parties have wallet addresses
        const missingAddresses = extractedElements.parties.filter(
            (p) => !walletAddresses[p.name] || !walletAddresses[p.name].match(/^0x[a-fA-F0-9]{40}$/)
        );

        if (missingAddresses.length > 0) {
            toast.error(`Please provide valid wallet addresses for: ${missingAddresses.map(p => p.name).join(", ")}`);
            return;
        }

        setIsGenerating(true);

        try {
            const response = await fetch("/api/agents/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcript,
                    context: context || undefined,
                    generateDraft: true,
                    walletAddresses,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to generate agreement");
            }

            const data = await response.json();

            if (data.draftAgreement) {
                setGeneratedContract(data.draftAgreement);
                toast.success("Agreement draft generated!");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to generate agreement");
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleSaveAgreement() {
        if (!generatedContract || !extractedElements) return;

        try {
            const response = await fetch("/api/agreements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: extractedElements.suggestedType,
                    description: extractedElements.summary,
                    parties: extractedElements.parties.map((p) => ({
                        name: p.name,
                        role: p.role,
                        walletAddress: walletAddresses[p.name],
                        email: p.identifiers?.find((id) => id.includes("@")),
                    })),
                    useAI: false, // Already generated
                    contractText: generatedContract.markdown,
                    title: generatedContract.title,
                    templateData: generatedContract.data,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save agreement");
            }

            const agreement = await response.json();
            toast.success("Agreement saved successfully!");
            onAgreementCreated?.(agreement);

            // Reset form
            setTranscript("");
            setContext("");
            setExtractedElements(null);
            setGeneratedContract(null);
            setWalletAddresses({});
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save agreement");
        }
    }

    function handleReset() {
        setTranscript("");
        setContext("");
        setExtractedElements(null);
        setGeneratedContract(null);
        setWalletAddresses({});
    }

    const agreementTypeLabels: Record<string, string> = {
        collaboration: "Collaboration Agreement",
        service: "Service Agreement",
        investment: "Investment Agreement",
        nda: "Non-Disclosure Agreement",
        nca: "Non-Compete Agreement",
        tos: "Terms of Service",
        constitution: "Constitution",
        declaration: "Declaration",
        custom: "Custom Agreement",
    };

    return (
        <div className="space-y-6">
            {/* Step 1: Input Transcript */}
            {!extractedElements && (
                <Card>
                    <CardHeader>
                        <CardTitle>Analyze Transcript</CardTitle>
                        <CardDescription>
                            Paste a meeting transcript, discussion notes, or existing document to extract agreement elements
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="context">Context (Optional)</Label>
                            <Input
                                id="context"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="E.g., Partnership discussion between Company A and Company B"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="transcript">Transcript / Document</Label>
                            <textarea
                                id="transcript"
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                placeholder={`Paste your meeting transcript here...

Example:
"Alice and Bob met to discuss their collaboration on Project X. Alice agreed to provide 60% of the funding while Bob would lead the development. They agreed to split profits 50/50. The project should be completed by March 2026. Alice's wallet is 0x123... and Bob's is 0x456..."`}
                            />
                            <p className="text-xs text-muted-foreground">
                                Minimum 50 characters. The AI will extract parties, terms, and obligations.
                            </p>
                        </div>

                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || transcript.length < 50}
                            className="w-full"
                        >
                            {isAnalyzing ? "Analyzing..." : "Analyze Transcript"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Review Extracted Elements */}
            {extractedElements && !generatedContract && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Extracted Elements</h3>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            Start Over
                        </Button>
                    </div>

                    {/* Summary Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{extractedElements.suggestedTitle}</CardTitle>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    {agreementTypeLabels[extractedElements.suggestedType] || extractedElements.suggestedType}
                                </span>
                            </div>
                            <CardDescription>{extractedElements.summary}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Confidence:</span>
                                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`bg-primary h-2 rounded-full transition-all ${extractedElements.confidence >= 80 ? "w-4/5" :
                                                extractedElements.confidence >= 60 ? "w-3/5" :
                                                    extractedElements.confidence >= 40 ? "w-2/5" :
                                                        extractedElements.confidence >= 20 ? "w-1/5" : "w-0"
                                            }`}
                                    />
                                </div>
                                <span>{extractedElements.confidence}%</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Parties */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Parties ({extractedElements.parties.length})</CardTitle>
                            <CardDescription>Assign wallet addresses to each party</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {extractedElements.parties.map((party, index) => (
                                <div key={index} className="grid grid-cols-3 gap-4 items-end">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Name</Label>
                                        <p className="font-medium">{party.name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Role</Label>
                                        <p className="font-medium">{party.role}</p>
                                    </div>
                                    <div>
                                        <Label htmlFor={`wallet-${index}`}>Wallet Address</Label>
                                        <Input
                                            id={`wallet-${index}`}
                                            value={walletAddresses[party.name] || ""}
                                            onChange={(e) =>
                                                setWalletAddresses((prev) => ({
                                                    ...prev,
                                                    [party.name]: e.target.value,
                                                }))
                                            }
                                            placeholder="0x..."
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Key Terms */}
                    {extractedElements.keyTerms.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Key Terms ({extractedElements.keyTerms.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {extractedElements.keyTerms.map((term, index) => (
                                        <div key={index} className="flex justify-between items-start border-b pb-2 last:border-0">
                                            <div>
                                                <p className="font-medium text-sm">{term.term}</p>
                                                <p className="text-xs text-muted-foreground">{term.context}</p>
                                            </div>
                                            <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                                                {term.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Obligations */}
                    {extractedElements.obligations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Obligations ({extractedElements.obligations.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {extractedElements.obligations.map((obligation, index) => (
                                        <div key={index} className="border-b pb-2 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs bg-secondary px-2 py-0.5 rounded">{obligation.party}</span>
                                                {obligation.deadline && (
                                                    <span className="text-xs text-muted-foreground">by {obligation.deadline}</span>
                                                )}
                                            </div>
                                            <p className="text-sm mt-1">{obligation.obligation}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Button
                        onClick={handleGenerateAgreement}
                        disabled={isGenerating}
                        className="w-full"
                    >
                        {isGenerating ? "Generating Agreement..." : "Generate Full Agreement"}
                    </Button>
                </div>
            )}

            {/* Step 3: Review Generated Contract */}
            {generatedContract && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Generated Agreement</h3>
                        <div className="space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setGeneratedContract(null)}>
                                ← Back to Elements
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleReset}>
                                Start Over
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{generatedContract.title}</CardTitle>
                            <CardDescription>
                                Type: {agreementTypeLabels[generatedContract.type] || generatedContract.type}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <div
                                    className="bg-secondary/50 rounded-lg p-4 max-h-[400px] overflow-y-auto font-mono text-xs whitespace-pre-wrap"
                                >
                                    {generatedContract.markdown}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={() => setGeneratedContract(null)}
                            className="flex-1"
                        >
                            Edit Elements
                        </Button>
                        <Button
                            onClick={handleSaveAgreement}
                            className="flex-1"
                        >
                            Save Agreement
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
