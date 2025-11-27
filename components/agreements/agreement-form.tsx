"use client";

/**
 * Agreement Form Component
 * Creates new agreements using AI or manual input
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const partySchema = z.object({
    name: z.string().min(1, "Name is required"),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    role: z.string().min(1, "Role is required"),
    email: z.string().email().optional().or(z.literal("")),
});

const formSchema = z.object({
    type: z.enum([
        "collaboration",
        "service",
        "investment",
        "custom",
        "nda",
        "nca",
        "tos",
        "constitution",
        "declaration",
    ]),
    description: z.string().min(10, "Description must be at least 10 characters"),
    parties: z.array(partySchema).min(1, "At least one party is required"),
});

type FormData = z.infer<typeof formSchema>;

interface AgreementFormProps {
    onSuccess?: (agreement: unknown) => void;
    defaultWalletAddress?: string;
}

export function AgreementForm({ onSuccess, defaultWalletAddress }: AgreementFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            type: "collaboration",
            description: "",
            parties: [
                {
                    name: "",
                    walletAddress: defaultWalletAddress || "",
                    role: "Creator",
                    email: "",
                },
            ],
        },
    });

    const { fields: partyFields, append: addParty, remove: removeParty } = {
        fields: form.watch("parties"),
        append: (party: z.infer<typeof partySchema>) => {
            const current = form.getValues("parties");
            form.setValue("parties", [...current, party]);
        },
        remove: (index: number) => {
            const current = form.getValues("parties");
            form.setValue("parties", current.filter((_, i) => i !== index));
        },
    };

    async function onSubmit(data: FormData) {
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/agreements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    useAI: true,
                    parties: data.parties.map((p) => ({
                        ...p,
                        email: p.email || undefined,
                    })),
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create agreement");
            }

            const agreement = await response.json();
            toast.success("Agreement created successfully!");
            onSuccess?.(agreement);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create agreement");
        } finally {
            setIsSubmitting(false);
        }
    }

    const agreementTypes = [
        { value: "collaboration", label: "Collaboration Agreement", description: "For projects with multiple collaborators" },
        { value: "service", label: "Service Agreement", description: "For service provider and client relationships" },
        { value: "investment", label: "Investment Agreement", description: "For investment terms (SAFE, SAFT, etc.)" },
        { value: "nda", label: "Non-Disclosure Agreement", description: "Protect confidential information" },
        { value: "nca", label: "Non-Compete Agreement", description: "Restrict competitive activities" },
        { value: "tos", label: "Terms of Service", description: "Define service usage terms and conditions" },
        { value: "constitution", label: "Constitution", description: "Governance rules for DAOs and organizations" },
        { value: "declaration", label: "Declaration", description: "Manifestos, charters, and founding documents" },
        { value: "custom", label: "Custom Agreement", description: "Freeform custom agreement" },
    ];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Agreement Type */}
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Agreement Type</FormLabel>
                            <div className="grid grid-cols-2 gap-3">
                                {agreementTypes.map((type) => (
                                    <Card
                                        key={type.value}
                                        className={`cursor-pointer transition-all ${field.value === type.value
                                            ? "border-primary ring-2 ring-primary/20"
                                            : "hover:border-muted-foreground/50"
                                            }`}
                                        onClick={() => field.onChange(type.value)}
                                    >
                                        <CardHeader className="p-4">
                                            <CardTitle className="text-sm">{type.label}</CardTitle>
                                            <CardDescription className="text-xs">{type.description}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Description */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <textarea
                                    {...field}
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Describe the purpose and key terms of this agreement..."
                                />
                            </FormControl>
                            <FormDescription>
                                AI will use this to generate a comprehensive contract
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Parties */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Parties</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                addParty({
                                    name: "",
                                    walletAddress: "",
                                    role: "",
                                    email: "",
                                })
                            }
                        >
                            Add Party
                        </Button>
                    </div>

                    {partyFields.map((party, index) => (
                        <Card key={index} className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`parties.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="John Doe" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`parties.${index}.role`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Creator, Collaborator, etc." />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`parties.${index}.walletAddress`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Wallet Address</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="0x..." />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`parties.${index}.email`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email (Optional)</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="email" placeholder="email@example.com" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {partyFields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 text-destructive"
                                    onClick={() => removeParty(index)}
                                >
                                    Remove Party
                                </Button>
                            )}
                        </Card>
                    ))}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Generating Agreement..." : "Generate Agreement with AI"}
                </Button>
            </form>
        </Form>
    );
}
