// Vercel Serverless Function: POST form JSON → create a Notion page
const NOTION_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";

// ----- Helpers to build Notion properties -----
const title = (v = "") => ({ title: [{ type: "text", text: { content: String(v).slice(0, 2000) } }] });
const rich  = (v = "") => ({ rich_text: [{ type: "text", text: { content: String(v).slice(0, 2000) } }] });
const email = (v = "") => ({ email: v || "" });
const phone = (v = "") => ({ phone_number: v || "" });
const num   = (v) => ({ number: isFinite(Number(v)) ? Number(v) : null });
const sel   = (v) => (v ? { select: { name: String(v) } } : { select: null });
const box   = (v) => ({ checkbox: v === true || String(v).toLowerCase() === "true" });

// Edit the property names to match your Notion columns EXACTLY (accents, case)
function mapToNotionProps(d) {
  return {
    // Your Title property name MUST match the first key here ("Name" by default)
    "Name": title(d.Name || `${d["First Name"] || ""} ${d["Last Name"] || ""}`.trim()),
    "Email": email(d.Email),
    "Phone": phone(d.Phone),
    "Company": rich(d.Company),
    "Country": sel(d.Country),
    "Role": sel(d.Role),
    "Department": sel(d.Department),
    "Headcount": num(d.Headcount),
    "Hourly rate (€)": num(d["Hourly rate (€)"] || d.HourlyRate),
    "Message": rich(d.Message),
    "Language": sel(d.Language),
    "Consent": box(d.Consent)
  };
}

// Simple CORS: allow your domain(s)
const ALLOWED = [
  "https://leancompanion.com",
  "https://www.leancompanion.com",
  "http://localhost:5173" // dev preview if you need it
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  // Read JSON
  const data = req.body || {};
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  // Build Notion request
  const payload = {
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: mapToNotionProps(data)
  };

  try {
    const r = await fetch(NOTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({ ok: false, error: errText });
    }
    const out = await r.json();
    return res.status(201).json({ ok: true, data: { id: out?.id } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
}
