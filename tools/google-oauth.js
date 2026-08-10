#!/usr/bin/env node
/*
 * TEMPORARY DEVELOPMENT-ONLY Google OAuth helper for the Live Classes
 * calendar integration. It is a Node CLI under tools/, is never loaded by
 * the static frontend, and must not be deployed as a browser asset.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET       (only needed for `token`)
 *
 * Optional environment variable:
 *   GOOGLE_REDIRECT_URI        (default: http://localhost:3000/oauth2/callback)
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... node tools/google-oauth.js url
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node tools/google-oauth.js token <authorization-code>
 */

"use strict";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
    "https://www.googleapis.com/auth/calendar.events"
];

function required(name) {
    const value = String(process.env[name] || "").trim();
    if (!value) {
        throw new Error(`${name} is required. Set it in your shell; do not add it to source code.`);
    }
    return value;
}

function redirectUri() {
    return String(
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2/callback"
    ).trim();
}

function printUsage() {
    console.log("Usage:");
    console.log("  GOOGLE_CLIENT_ID=... node tools/google-oauth.js url");
    console.log("  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node tools/google-oauth.js token <authorization-code>");
}

function authorizationUrl() {
    const params = new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent"
    });

    return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: required("GOOGLE_CLIENT_ID"),
            client_secret: required("GOOGLE_CLIENT_SECRET"),
            redirect_uri: redirectUri(),
            grant_type: "authorization_code"
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || "Google token exchange failed.");
    }
    if (!data.refresh_token) {
        throw new Error("Google did not return a refresh token. Revoke the app's access, then repeat the flow using the generated URL.");
    }

    console.log("Add these values as Supabase Edge Function secrets:");
    console.log(`GOOGLE_CLIENT_ID=${required("GOOGLE_CLIENT_ID")}`);
    console.log(`GOOGLE_CLIENT_SECRET=${required("GOOGLE_CLIENT_SECRET")}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
}

async function main() {
    const [command, code] = process.argv.slice(2);
    if (!command || command === "help" || command === "--help") {
        printUsage();
        return;
    }

    if (command === "url") {
        console.log(authorizationUrl());
        return;
    }

    if (command === "token") {
        if (!code) throw new Error("Provide the authorization code returned by Google.");
        await exchangeCode(code);
        return;
    }

    printUsage();
    throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
    console.error(`Google OAuth setup failed: ${error.message}`);
    process.exitCode = 1;
});
