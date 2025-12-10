/**
 * Express API server for contract generation
 * 
 * Provides endpoints for the frontend to generate contracts from transcripts
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { transcriptToContract } from './scripts/transcript-to-contract';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

/**
 * POST /api/generate/contract
 * 
 * Generate Accord contract artifacts from a transcript
 * 
 * Body: { transcript: string }
 * Returns: { model: string, template: string, data: string, html: string }
 */
app.post('/api/generate/contract', async (req: Request, res: Response) => {
  const { transcript } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'transcript is required and must be a string' });
  }

  if (transcript.length < 100) {
    return res.status(400).json({ error: 'transcript must be at least 100 characters' });
  }

  console.log(`[API] Generating contract from transcript (${transcript.length} chars)`);

  try {
    // Write transcript to temp file for processing
    const fs = await import('fs');
    const os = await import('os');
    const tempFile = path.join(os.tmpdir(), `transcript-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, transcript);

    // Generate contract artifacts
    const result = await transcriptToContract(tempFile);

    // Clean up temp file
    fs.unlinkSync(tempFile);

    // Return the artifacts
    res.json({
      model: result.validation.concertoModel,
      template: result.validation.templateMark,
      data: typeof result.validation.jsonData === 'string' 
        ? result.validation.jsonData 
        : JSON.stringify(result.validation.jsonData, null, 2),
      html: result.html || '',
    });
  } catch (error) {
    console.error('[API] Contract generation failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Contract generation failed' 
    });
  }
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`[API] Contract generation server running on http://localhost:${PORT}`);
});

export default app;
