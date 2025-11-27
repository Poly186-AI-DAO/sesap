/**
 * Template Constants
 * Shared constants for template management
 */

// Template categories for organization
export const TEMPLATE_CATEGORIES = [
  "legal",
  "governance",
  "business",
  "custom",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// Category display labels
export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  legal: "Legal",
  governance: "Governance",
  business: "Business",
  custom: "Custom",
};

// Category colors for UI
export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  legal: "bg-blue-100 text-blue-800",
  governance: "bg-purple-100 text-purple-800",
  business: "bg-green-100 text-green-800",
  custom: "bg-gray-100 text-gray-800",
};
