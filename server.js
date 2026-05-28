const express = require("express");
const fetch = require("node-fetch");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROXY_URL = process.env.HTTP_PROXY_URL;

app.get("/health", (req, res) => {
  res.json({ status: "ok", proxy: PROXY_URL ? "configured" : "not configured" });
});

app.post("/api/ita-relay", async (req, res) => {
  const { url, method = "POST", headers = {}, body } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing target URL" });
  }

  console.log(`[ITA-Relay] ${method} → ${url}`);
  console.log(`[ITA-Relay] Proxy: ${PROXY_URL ? "enabled" : "disabled"}`);

  try {
    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

    const response = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      agent,
    });

    const responseText = await response.text();
    console.log(`[ITA-Relay] Response status: ${response.status}`);

    // העבר את כל ה-headers בחזרה
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    res.status(response.status).set(responseHeaders).send(responseText);

  } catch (err) {
    console.error("[ITA-Relay] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ITA Relay running on port ${PORT}`);
  console.log(`Proxy: ${PROXY_URL || "not configured"}`);
});
