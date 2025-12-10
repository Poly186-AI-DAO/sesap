/**
 * Accord Project Engine Wrapper
 * 
 * Server-side wrapper for rendering Accord Project artifacts to HTML
 * Based on the frontend store.ts rebuild() function
 */

import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkInterpreter } from '@accordproject/template-engine';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { transform } from '@accordproject/markdown-transform';

// Hardcoded money model to avoid network issues
const MONEY_MODEL = `namespace org.accordproject.money@0.3.0

enum CurrencyCode {
  o AED o AFN o ALL o AMD o ANG o AOA o ARS o AUD o AWG o AZN
  o BAM o BBD o BDT o BGN o BHD o BIF o BMD o BND o BOB o BOV o BRL o BSD o BTN o BWP o BYN o BZD
  o CAD o CDF o CHE o CHF o CHW o CLF o CLP o CNY o COP o COU o CRC o CUC o CUP o CVE o CZK
  o DJF o DKK o DOP o DZD o EGP o ERN o ETB o EUR o FJD o FKP o GBP o GEL o GHS o GIP o GMD
  o GNF o GTQ o GYD o HKD o HNL o HRK o HTG o HUF o IDR o ILS o INR o IQD o IRR o ISK o JMD
  o JOD o JPY o KES o KGS o KHR o KMF o KPW o KRW o KWD o KYD o KZT o LAK o LBP o LKR o LRD
  o LSL o LYD o MAD o MDL o MGA o MKD o MMK o MNT o MOP o MRU o MUR o MVR o MWK o MXN o MXV
  o MYR o MZN o NAD o NGN o NIO o NOK o NPR o NZD o OMR o PAB o PEN o PGK o PHP o PKR o PLN
  o PYG o QAR o RON o RSD o RUB o RWF o SAR o SBD o SCR o SDG o SEK o SGD o SHP o SLL o SOS
  o SRD o SSP o STN o SVC o SYP o SZL o THB o TJS o TMT o TND o TOP o TRY o TTD o TWD o TZS
  o UAH o UGX o USD o USN o UYI o UYU o UYW o UZS o VES o VND o VUV o WST o XAF o XAG o XAU
  o XBA o XBB o XBC o XBD o XCD o XDR o XOF o XPD o XPF o XPT o XSU o XTS o XUA o XXX o YER
  o ZAR o ZMW o ZWL
}

concept MonetaryAmount {
  o Double doubleValue
  o CurrencyCode currencyCode
}`;

export interface RenderResult {
  html: string;
  success: boolean;
  error?: string;
}

/**
 * Render Accord Project artifacts to HTML
 * 
 * @param model - Concerto model (.cto content)
 * @param template - TemplateMark template (.tem.md content)
 * @param data - JSON data object
 * @returns Rendered HTML
 */
export async function renderToHtml(
  model: string,
  template: string,
  data: Record<string, unknown>
): Promise<RenderResult> {
  try {
    console.log('[Accord] Starting render...');
    
    // Create model manager
    const modelManager = new ModelManager({ strict: true });
    
    // Add the user's model
    modelManager.addCTOModel(model, undefined, true);
    console.log('[Accord] User model added');
    
    // Add money model for common types
    try {
      modelManager.addCTOModel(MONEY_MODEL, 'money@0.3.0.cto', true);
      console.log('[Accord] Money model added');
    } catch (e) {
      // Money model might not be needed, continue
      console.log('[Accord] Money model skipped (not needed)');
    }
    
    // Create template engine
    const engine = new TemplateMarkInterpreter(modelManager, {});
    const templateMarkTransformer = new TemplateMarkTransformer();
    
    // Parse template
    const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
      { content: template },
      modelManager,
      'contract',
      { verbose: false }
    );
    console.log('[Accord] Template parsed');
    
    // Generate CiceroMark
    const ciceroMark = await engine.generate(templateMarkDom as object, data);
    console.log('[Accord] CiceroMark generated');
    
    // Transform to HTML
    const html = await transform(
      ciceroMark.toJSON() as object,
      'ciceromark_parsed',
      ['html'],
      {},
      { verbose: false }
    );
    console.log('[Accord] HTML rendered');
    
    return {
      html: html as string,
      success: true,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Accord] Render error:', message);
    
    return {
      html: '',
      success: false,
      error: message,
    };
  }
}

/**
 * Render contract from file paths
 */
export async function renderFromFiles(
  modelPath: string,
  templatePath: string,
  dataPath: string
): Promise<RenderResult> {
  const fs = await import('fs');
  
  const model = fs.readFileSync(modelPath, 'utf-8');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  return renderToHtml(model, template, data);
}
