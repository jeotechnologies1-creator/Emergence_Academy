// // /* ==========================================================
// //    EMERGENCE ACADEMY
// //    Supabase Configuration
// //    File: assets/js/supabase.js
// // ========================================================== */

// // const SUPABASE_URL = "https://yzvtwoqeosnsmnfpbisc.supabase.co";

// // const SUPABASE_ANON_KEY =
// // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";

const SUPABASE_URL = "https://yzvtwoqeosnsmnfpbisc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;
window.supabaseReady = true;
window.supabaseInitMessage = "Supabase initialized successfully.";