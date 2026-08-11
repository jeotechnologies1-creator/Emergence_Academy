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
assert.doesNotMatch(client, /OPENAI_API_KEY/, "the OpenAI key must never be shipped to the browser");

assert.match(functionSource, /await caller\(req\)/, "the Edge Function should authenticate each caller");
assert.match(functionSource, /\['teacher', 'student'\]\.includes\(role\)/, "the Edge Function should limit access to teachers and students");
assert.match(functionSource, /https:\/\/api\.openai\.com\/v1\/responses/, "the Edge Function should call the OpenAI Responses API");
assert.match(functionSource, /Deno\.env\.get\("OPENAI_API_KEY"\)/, "the Edge Function should read the server-side OpenAI key");
assert.match(functionSource, /store: false/, "the OpenAI request should not persist response state");
assert.match(functionSource, /openAIErrorMessage/, "the Edge Function should return actionable OpenAI configuration errors");
assert.match(functionSource, /status === 429/, "the Edge Function should identify OpenAI quota or rate-limit errors");

const config = read("supabase", "config.toml");
assert.match(config, /\[functions\.ai-chat\]/, "Supabase should register the AI chat function locally");

console.log("AI Assistant integration test passed");
