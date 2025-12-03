// @ts-ignore
import { Template, Clause } from '@accordproject/cicero-core';
// @ts-ignore
import { Engine } from '@accordproject/cicero-engine';
// @ts-ignore
import * as path from 'path';
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import { fileURLToPath } from 'url';
// @ts-ignore
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// @ts-ignore
import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

async function run() {
    try {
        console.log('--- Starting Accord Project Test ---');

        // 1. Load the template
        const templatePath = path.resolve(__dirname);
        console.log(`Loading template from: ${templatePath}`);
        
        // Manual Model Loading Test
        // const { ModelManager } = require('@accordproject/concerto-core');
        // const mm = new ModelManager();
        
        // const modelPath = path.join(templatePath, 'model', 'model.cto');
        // const contractPath = path.join(templatePath, 'model', 'contract.cto');
        // const runtimePath = path.join(templatePath, 'model', 'runtime.cto');

        // mm.addCTOModel(fs.readFileSync(contractPath, 'utf8'), 'contract.cto');
        // mm.addCTOModel(fs.readFileSync(runtimePath, 'utf8'), 'runtime.cto');
        // mm.addCTOModel(fs.readFileSync(modelPath, 'utf8'), 'model.cto');
        
        // console.log('Manual model load success. Namespaces:', mm.getModelFiles().map((mf: any) => mf.getNamespace()));
        
        const template = await Template.fromDirectory(templatePath);
        console.log('Template loaded successfully.');
        console.log('Template Model Type:', template.getTemplateModel().getFullyQualifiedName());
        
        // Validate template
        await template.validate();

        // Manually add logic file (workaround for loader issue)
        const logicPath = path.join(templatePath, 'logic', 'logic.ergo');
        const logicContent = fs.readFileSync(logicPath, 'utf8');
        template.getLogicManager().addLogicFile(logicContent, 'logic.ergo');

        // Explicitly compile to JS using LogicManager
        console.log('Compiling logic...');
        await template.getLogicManager().compileLogic(true);
        console.log('Logic compiled to JavaScript.');
        
        // 2. Create a clause from text
        const sampleText = '"Alice" accepts "Bob"';
        console.log(`Parsing text: "${sampleText}"`);
        const clause = new Clause(template);
        clause.parse(sampleText);
        console.log('Clause parsed successfully.');
        console.log('Clause data:', JSON.stringify(clause.getData(), null, 2));

        // 3. Initialize Engine
        const engine = new Engine();
        console.log('Engine initialized.');

        // 4. Create a request
        const request = {
            "$class": "org.accordproject.acceptance.AcceptanceRequest"
        };
        console.log('Sending request:', JSON.stringify(request, null, 2));

        // 5. Execute the Engine
        // We need to pass the clause data, request, and state (can be empty/null for stateless)
        // trigger(clause, request, state, currentTime)
        const state = { "$class": "org.accordproject.runtime.State" };
        const result = await engine.trigger(clause, request, state);
        
        console.log('--- Execution Result ---');
        console.log('Response:', JSON.stringify(result.response, null, 2));

        // Verify result
        if (result.response.message === "Delivery accepted by Alice from Bob") {
            console.log('SUCCESS: Logic executed correctly.');
        } else {
            console.log('FAILURE: Unexpected response message.');
            process.exit(1);
        }

    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    }
}

run();
