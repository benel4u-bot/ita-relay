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
  let targetUrl = req.body.url;
  let method = req.body.method || "POST";
  let headers = req.body.headers || {};
  let bodyData = req.body.body;

  if (!targetUrl) {
    return res.status(400).json({ error: "Missing target URL" });
  }

  console.log(`[ITA-Relay] ${method} → ${targetUrl}`);

  // מגן לייזר מורחב: הופך גם את מספרי הח"פ לסטרינגים עם גרשיים בכוח!
  try {
    let isString = (typeof bodyData === "string");
    let str = isString ? bodyData : JSON.stringify(bodyData);

    if (str) {
      // 1. תיקון מספרי הח"פ (העסק והלקוח) מאינטג'ר לסטרינג
      str = str.replace(/"Vat_Number"\s*:\s*200342426/g, '"Vat_Number":"200342426"');
      str = str.replace(/"Customer_VAT_Number"\s*:\s*511234567/g, '"Customer_VAT_Number":"511234567"');

      // 2. תיקון שאר שדות הסיווג והתוכנה
      str = str.replace(/"Accounting_Software_Number"\s*:\s*99999999/g, '"Accounting_Software_Number":"99999999"');
      str = str.replace(/"Invoice_Type"\s*:\s*305/g, '"Invoice_Type":"305"');
      str = str.replace(/"Branch_ID"\s*:\s*0/g, '"Branch_ID":"0"');
      str = str.replace(/"Customer_Type"\s*:\s*1/g, '"Customer_Type":"1"');
      
      bodyData = isString ? str : JSON.parse(str);
    }
  } catch (e) {
    console.log("[ITA-Relay] Force replacement error:", e.message);
  }

  console.log(`[ITA-Relay] Prepared Payload Body:`, typeof bodyData === "object" ? JSON.stringify(bodyData) : bodyData);

  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const contentType = normalizedHeaders["content-type"] || "application/json";

  try {
    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

    const response = await axios({
      method,
      url: targetUrl,
      headers: {
        ...normalizedHeaders,
        "content-type": contentType,
      },
      data: bodyData || undefined,
      httpsAgent: agent,
      proxy: false,
      validateStatus: () => true,
      responseType: "text",
      transformRequest: [(data) => (typeof data === "string" ? data : JSON.stringify(data))],
    });

    console.log(`[ITA-Relay] Response: ${response.status}`);
    console.log(`[ITA-Relay] Response body: ${response.data?.substring(0, 200)}`);

    res.status(response.status).send(response.data);

  } catch (err) {
    console.error("[ITA-Relay] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ITA Relay running on port ${PORT}`);
});
