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
  let { url, method = "POST", headers = {}, body } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing target URL" });
  }

  console.log(`[ITA-Relay] ${method} → ${url}`);
  
  // מגן לייזר: החלפת טקסט גורפת על ה-string הגולמי כדי להכריח גרשיים על השדה הסורר
  try {
    let rawString = typeof body === "string" ? body : JSON.stringify(body);
    
    // החלפה ישירה של מספר התוכנה החשוף למבנה עם גרשיים
    if (rawString && rawString.includes('"Accounting_Software_Number":99999999')) {
      rawString = rawString.replace('"Accounting_Software_Number":99999999', '"Accounting_Software_Number":"99999999"');
    }
    
    // החלפה של שאר שדות הסיווג ליתר ביטחון אם חזרו להיות מספרים
    if (rawString) {
      rawString = rawString.replace('"Invoice_Type":305', '"Invoice_Type":"305"');
      rawString = rawString.replace('"Branch_ID":0', '"Branch_ID":"0"');
      rawString = rawString.replace('"Customer_Type":1', '"Customer_Type":"1"');
    }

    // הגדרה מחדש של ה-body כטקסט מעובד וסגור
    body = rawString;
  } catch (e) {
    console.log("[ITA-Relay] Laser bypass error:", e.message);
  }

  // מדפיס ללוג של רנדר את ה-JSON המלא והסופי שנשלח
  console.log(`[ITA-Relay] Incoming Payload Body:`, body);

  // נרמל את ה-headers — ודא שהם נשלחים בפורמט הנכון
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  // ודא ש-content-type נשמר בדיוק
  const contentType = normalizedHeaders["content-type"] || "application/json";

  try {
    const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

    const response = await axios({
      method,
      url,
      headers: {
        ...normalizedHeaders,
        "content-type": contentType,
      },
      data: body || undefined,
      httpsAgent: agent,
      proxy: false,
      validateStatus: () => true,
      responseType: "text",
      // מנע axios מלהוסיף headers מיותרים
      transformRequest: [(data) => data],
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
