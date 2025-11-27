"use client";

/**
 * Template List Component
 * Browse and select templates for creating agreements
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    TEMPLATE_CATEGORIES,
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    type TemplateCategory,
} from "@/lib/templates/constants";

interface Template {
    id: string;
    name: string;
    description: string | null;
    category: TemplateCategory;
    isPublic: boolean;
    createdAt: string;
}

interface TemplateListProps {
    onSelect?: (template: Template) => void;
    selectedId?: string;
}

export function TemplateList({ onSelect, selectedId }: TemplateListProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (category) params.set("category", category);

            const response = await fetch(`/api/templates?${params.toString()}`);
            if (!response.ok) {
                throw new Error("Failed to fetch templates");
            }

            const data = await response.json();
            setTemplates(data.templates || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [search, category]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const categories = TEMPLATE_CATEGORIES;

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchTemplates} className="mt-4">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <Input
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1"
                />
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={category === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategory(null)}
                    >
                        All
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat}
                            variant={category === cat ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCategory(cat)}
                        >
                            {CATEGORY_LABELS[cat]}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Template Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-4 bg-muted rounded w-3/4"></div>
                                <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-3 bg-muted rounded w-full"></div>
                                <div className="h-3 bg-muted rounded w-2/3 mt-2"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No templates found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {search || category ? "Try adjusting your filters" : "Create your first template to get started"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                        <Card
                            key={template.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${selectedId === template.id ? "ring-2 ring-primary" : ""
                                }`}
                            onClick={() => onSelect?.(template)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg">{template.name}</CardTitle>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom
                                            }`}
                                    >
                                        {CATEGORY_LABELS[template.category] || template.category}
                                    </span>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    {template.description || "No description"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>
                                        {new Date(template.createdAt).toLocaleDateString()}
                                    </span>
                                    {template.isPublic ? (
                                        <span className="text-green-600">Public</span>
                                    ) : (
                                        <span className="text-yellow-600">Private</span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
