import { describe, it, expect } from "vitest";
import {
  ContactSchema,
  PartySchema,
  PhaseSchema,
  ScopeOfWorkSchema,
  TimelineSchema,
  CommercialTermsSchema,
  NextStepSchema,
  ContractStructureSchema,
  AccordArtifactsSchema,
  ValidationResultSchema,
} from "../../../server/schemas/contract";

describe("Contract Schemas", () => {
  // ---------- ContactSchema ----------
  describe("ContactSchema", () => {
    it("parses a valid contact", () => {
      const result = ContactSchema.parse({
        name: "Jane Doe",
        role: "CTO",
        notes: "Technical lead",
      });
      expect(result.name).toBe("Jane Doe");
    });

    it("allows null notes", () => {
      const result = ContactSchema.parse({
        name: "Jane Doe",
        role: "CTO",
        notes: null,
      });
      expect(result.notes).toBeNull();
    });

    it("rejects missing required fields", () => {
      expect(() => ContactSchema.parse({ name: "Jane" })).toThrow();
    });
  });

  // ---------- PartySchema ----------
  describe("PartySchema", () => {
    it("parses a party with contacts", () => {
      const result = PartySchema.parse({
        name: "Acme Corp",
        role: "Provider",
        contacts: [{ name: "Bob", role: "CEO", notes: null }],
      });
      expect(result.contacts).toHaveLength(1);
    });

    it("accepts empty contacts array", () => {
      const result = PartySchema.parse({
        name: "Acme Corp",
        role: "Client",
        contacts: [],
      });
      expect(result.contacts).toEqual([]);
    });
  });

  // ---------- PhaseSchema ----------
  describe("PhaseSchema", () => {
    it("parses a full phase", () => {
      const result = PhaseSchema.parse({
        name: "Phase 1 - Discovery",
        description: "Initial discovery phase",
        activities: ["Interview stakeholders"],
        dependencies: [],
        outputs: ["Report"],
      });
      expect(result.name).toBe("Phase 1 - Discovery");
    });

    it("allows null description", () => {
      const result = PhaseSchema.parse({
        name: "Phase 2",
        description: null,
        activities: [],
        dependencies: [],
        outputs: [],
      });
      expect(result.description).toBeNull();
    });
  });

  // ---------- ScopeOfWorkSchema ----------
  describe("ScopeOfWorkSchema", () => {
    it("parses scope with deliverables and phases", () => {
      const result = ScopeOfWorkSchema.parse({
        deliverables: ["Audit report", "Training docs"],
        phases: [],
      });
      expect(result.deliverables).toHaveLength(2);
    });
  });

  // ---------- TimelineSchema ----------
  describe("TimelineSchema", () => {
    it("parses a timeline with milestones", () => {
      const result = TimelineSchema.parse({
        startDate: "2025-01-01",
        duration: "6 months",
        milestones: [
          { name: "Kickoff", targetDate: "2025-01-15", details: null },
        ],
      });
      expect(result.milestones).toHaveLength(1);
    });

    it("allows null startDate", () => {
      const result = TimelineSchema.parse({
        startDate: null,
        duration: "3 months",
        milestones: [],
      });
      expect(result.startDate).toBeNull();
    });
  });

  // ---------- CommercialTermsSchema ----------
  describe("CommercialTermsSchema", () => {
    it("parses all-null commercial terms", () => {
      const result = CommercialTermsSchema.parse({
        paymentTerms: null,
        estimatedValue: null,
        roiExpectation: null,
      });
      expect(result.paymentTerms).toBeNull();
    });

    it("parses filled commercial terms", () => {
      const result = CommercialTermsSchema.parse({
        paymentTerms: "Net 30",
        estimatedValue: "$50,000",
        roiExpectation: "3x in 12 months",
      });
      expect(result.paymentTerms).toBe("Net 30");
    });
  });

  // ---------- NextStepSchema ----------
  describe("NextStepSchema", () => {
    it("parses a next step", () => {
      const result = NextStepSchema.parse({
        owner: "Dylan",
        action: "Schedule follow-up",
        status: "Planned",
        source: null,
      });
      expect(result.owner).toBe("Dylan");
    });
  });

  // ---------- ContractStructureSchema ----------
  describe("ContractStructureSchema", () => {
    const validStructure = {
      parties: {
        provider: {
          name: "Provider Inc",
          role: "Provider",
          contacts: [{ name: "Alice", role: "PM", notes: null }],
        },
        intermediary: null,
        client: {
          name: "Client LLC",
          role: "Client",
          contacts: [],
        },
      },
      engagementType: ["Consulting"],
      scopeOfWork: {
        deliverables: ["Report"],
        phases: [],
      },
      timeline: {
        startDate: null,
        duration: "3 months",
        milestones: [],
      },
      commercialTerms: {
        paymentTerms: null,
        estimatedValue: null,
        roiExpectation: null,
      },
      nextSteps: [
        { owner: "Alice", action: "Send proposal", status: null, source: null },
      ],
      keyQuotes: ["We should move fast."],
    };

    it("parses a valid contract structure", () => {
      const result = ContractStructureSchema.parse(validStructure);
      expect(result.parties.provider.name).toBe("Provider Inc");
      expect(result.parties.intermediary).toBeNull();
    });

    it("rejects missing parties", () => {
      const { parties, ...rest } = validStructure;
      expect(() => ContractStructureSchema.parse(rest)).toThrow();
    });
  });

  // ---------- AccordArtifactsSchema ----------
  describe("AccordArtifactsSchema", () => {
    it("parses valid artifacts", () => {
      const result = AccordArtifactsSchema.parse({
        concertoModel: "namespace test@1.0.0",
        templateMark: "## Hello {{name}}",
        jsonData: '{"$class":"test@1.0.0.Data","name":"World"}',
      });
      expect(result.concertoModel).toContain("namespace");
    });

    it("rejects non-string jsonData", () => {
      expect(() =>
        AccordArtifactsSchema.parse({
          concertoModel: "ns",
          templateMark: "tm",
          jsonData: { key: "value" },
        }),
      ).toThrow();
    });
  });

  // ---------- ValidationResultSchema ----------
  describe("ValidationResultSchema", () => {
    it("parses a valid result", () => {
      const result = ValidationResultSchema.parse({
        isValid: true,
        issues: [],
        fixes: [],
        concertoModel: "namespace test@1.0.0",
        templateMark: "## Hello",
        jsonData: "{}",
      });
      expect(result.isValid).toBe(true);
    });

    it("parses an invalid result with issues", () => {
      const result = ValidationResultSchema.parse({
        isValid: false,
        issues: ["Missing $class field", "Array type mismatch"],
        fixes: ["Added $class", "Converted to string array"],
        concertoModel: "ns",
        templateMark: "tm",
        jsonData: "{}",
      });
      expect(result.issues).toHaveLength(2);
      expect(result.fixes).toHaveLength(2);
    });
  });
});
