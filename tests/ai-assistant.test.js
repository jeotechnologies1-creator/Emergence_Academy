const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = (...parts) => fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");

const client = read("assets", "js", "dashboard", "ai.js");
const functionSource = read("supabase", "functions", "ai-chat", "index.ts");

assert.match(client, /functions\.invoke\("ai-chat"/, "the dashboard should invoke the AI chat Edge Function");
assert.match(client, /await API\.functionErrorMessage\(error/, "the dashboard should display Edge Function error bodies");
assert.match(client, /deploy the ai-chat service/i, "the dashboard should explain a missing AI function deployment");
assert.match(client, /HISTORY_PREFIX.*profile/, "chat history should be scoped to the signed-in profile");
assert.doesNotMatch(client, /OLLAMA_BASE_URL/, "the model server URL must remain server-side");

assert.match(functionSource, /await caller\(req\)/, "the Edge Function should authenticate each caller");
assert.match(functionSource, /\['teacher', 'student'\]\.includes\(role\)/, "the Edge Function should limit access to teachers and students");
assert.match(functionSource, /\/api\/chat/, "the Edge Function should call the Ollama chat API");
assert.match(functionSource, /Deno\.env\.get\("OLLAMA_BASE_URL"\)/, "the Edge Function should read the Ollama server URL");
assert.match(functionSource, /Deno\.env\.get\("OLLAMA_MODEL"\)/, "the Edge Function should read the Ollama model");
assert.match(functionSource, /Deno\.env\.get\("OLLAMA_API_KEY"\)/, "the Edge Function should read the server-side Ollama API key");
assert.match(functionSource, /Authorization.*Bearer/, "the Edge Function should authorize Ollama Cloud requests");
assert.match(functionSource, /status === 401 \|\| status === 403/, "the Edge Function should explain Ollama Cloud authentication failures");
assert.match(functionSource, /ollamaErrorMessage/, "the Edge Function should return actionable Ollama errors");

const config = read("supabase", "config.toml");
assert.match(config, /\[functions\.ai-chat\]/, "Supabase should register the AI chat function locally");

console.log("AI Assistant integration test passed");
