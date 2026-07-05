import { readFileSync, writeFileSync } from 'fs';
const lines = readFileSync('C:\\Users\\Jirayu\\.gemini\\antigravity\\brain\\4118224e-e733-44be-913b-e0360a938823\\.system_generated\\logs\\transcript.jsonl', 'utf8').split('\n');
for (const line of lines) {
    if (line.includes('"step_index":120,')) {
        const data = JSON.parse(line);
        writeFileSync('c:\\Users\\Jirayu\\_playground\\PittaPDFToolkit\\old_gs.diff', data.content);
        break;
    }
}
