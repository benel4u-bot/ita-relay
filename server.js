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
  res.json({ 
    status: "ok", 
    proxy: PROXY_URL ? "configured" : "not configured" 
  });
});

app.post("/api/ita-relay", async (req, res) => {
  const { url, method = "POST", headers = {}, body } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing target URL" });
  }

  console.log(`[ITA-Relay] ${method} → ${url}`);

  try {
    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

    const response = await axios({
      method,
      url,
      headers,
      data: body || undefined,
      httpsAgent: agent,
      proxy: false, // חשוב: מונע מ-axios להשתמש ב-proxy משלו
      validateStatus: () => true, // מחזיר את כל ה-status codes בלי לזרוק שגיאה
      responseType: "text",
    });

    console.log(`[ITA-Relay] Response: ${response.status}`);

    res.status(response.status).set(response.headers).send(response.data);

  } catch (err) {
    console.error("[ITA-Relay] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ITA Relay running on port ${PORT}`);
});
