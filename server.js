
const express = require("express");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
 
const app = express();
app.use(express.json());
 
const PORT = process.env.PORT || 3000;
const PROXY_URL = process.env.HTTP_PROXY_URL;
 
console.log(`Starting ITA Relay...`);
console.log(`Proxy: ${PROXY_URL ? "configured ✓" : "NOT configured ✗"}`);
 
app.get("/health", (req, res) => {
  res.json({ status: "ok", proxy: PROXY_URL ? "configured" : "not configured" });
});
 
app.post("/api/ita-relay", async (req, res) => {
  const { url, method = "POST", headers = {}, body } = req.body;
 
  if (!url) {
    return res.status(400).json({ error: "Missing target URL" });
  }
 
  console.log(`[ITA-Relay] ${method} → ${url}`);
 
  // נרמל רק את שמות ה-headers (lowercase) — לא נוגעים בתוכן ה-body בכלל
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
 
  const contentType = normalizedHeaders["content-type"] || "application/json";
 
  // אם body הוא אובייקט, נשלח אותו כ-JSON מחרוזת; אם הוא כבר מחרוזת (form-urlencoded וכו'), נשלח כמו שהוא
  let outgoingBody = body;
  if (body && typeof body === "object" && contentType.includes("application/json")) {
    outgoingBody = JSON.stringify(body);
  }
 
  console.log(`[ITA-Relay] Outgoing body:`, typeof outgoingBody === "string" ? outgoingBody.substring(0, 300) : outgoingBody);
 
  try {
    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;
 
    const response = await axios({
      method,
      url,
      headers: {
        ...normalizedHeaders,
        "content-type": contentType,
      },
      data: outgoingBody || undefined,
      httpsAgent: agent,
      proxy: false,
      validateStatus: () => true,
      responseType: "text",
      transformRequest: [(data) => data],
    });
 
    console.log(`[ITA-Relay] Response: ${response.status}`);
    console.log(`[ITA-Relay] Response body: ${String(response.data)?.substring(0, 300)}`);
 
    res.status(response.status).send(response.data);
 
  } catch (err) {
    console.error("[ITA-Relay] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
 
app.listen(PORT, () => {
  console.log(`ITA Relay running on port ${PORT}`);
});
 
