/**
 * Test Script: Transcript Analyzer with Real LLM
 *
 * Directly calls the AI functions - no server needed, no mocking.
 *
 * Usage: pnpm test:transcript
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

// Load .env FIRST before importing anything that uses env vars
config({ path: resolve(__dirname, "../.env") });

async function main() {
  console.log("=".repeat(60));
  console.log("🔬 SESAP Transcript Analyzer Test (Real LLM - Direct)");
  console.log("=".repeat(60));

  // Check env vars
  const requiredVars = [
    "AZURE_AI_FOUNDRY_BASE_URL",
    "AZURE_AI_FOUNDRY_KEY",
    "AZURE_GPT_5_MINI_DEPLOYMENT",
  ];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n✅ Azure endpoint: ${process.env.AZURE_AI_FOUNDRY_BASE_URL}`);
  console.log(`✅ Deployment: ${process.env.AZURE_GPT_5_MINI_DEPLOYMENT}`);

  // Dynamic import AFTER env vars are loaded
  const { analyzeTranscript } = await import("../lib/ai/openai");

  // Load transcript
  const transcriptPath = resolve(
    __dirname,
    "../docs/Coastal_Elements_AI_Introduction_SL_Nusbaum_Transcript.txt"
  );
  const transcript = readFileSync(transcriptPath, "utf-8");

  console.log(
    `\n📄 Loaded: ${transcript.length} chars, ${
      transcript.split("\n").length
    } lines`
  );
  console.log("\n🤖 Calling Azure OpenAI directly...\n");

  const startTime = Date.now();

  const elements = await analyzeTranscript({
    transcript,
    context:
      "Business introduction meeting between Coastal Elements AI and S.L. Nusbaum about AI partnership",
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Analysis completed in ${duration}s`);
  console.log("\n" + "-".repeat(40));
  console.log("📊 Results:");
  console.log("-".repeat(40));

  console.log(`\nType: ${elements.suggestedType}`);
  console.log(`Title: ${elements.suggestedTitle}`);
  console.log(`Confidence: ${elements.confidence}%`);

  console.log(`\n👥 Parties (${elements.parties.length}):`);
  elements.parties.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} - ${p.role}`);
  });

  console.log(`\n📋 Key Terms (${elements.keyTerms.length}):`);
  elements.keyTerms.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.term}: ${t.value}`);
  });

  console.log(`\n⚖️ Obligations (${elements.obligations.length}):`);
  elements.obligations.slice(0, 5).forEach((o, i) => {
    console.log(`  ${i + 1}. [${o.party}] ${o.obligation}`);
  });

  console.log("\n📝 Summary:");
  console.log(elements.summary);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test passed!");
  console.log("=".repeat(60));

  console.log("\n🔍 Full JSON:");
  console.log(JSON.stringify(elements, null, 2));
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
