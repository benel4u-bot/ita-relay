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
  
  // מגן ברזל: מפרק את ה-body, מתקן את כל שדות הסיווג לטקסט עם גרשיים, ואורז מחדש
  try {
    let parsedBody = typeof body === "string" ? JSON.parse(body) : body;
    
    if (parsedBody && typeof parsedBody === "object") {
      if (parsedBody.Invoice_Type !== undefined) parsedBody.Invoice_Type = String(parsedBody.Invoice_Type);
      if (parsedBody.Branch_ID !== undefined) parsedBody.Branch_ID = String(parsedBody.Branch_ID);
      if (parsedBody.Customer_Type !== undefined) parsedBody.Customer_Type = String(parsedBody.Customer_Type);
      if (parsedBody.Accounting_Software_Number !== undefined) parsedBody.Accounting_Software_Number = String(parsedBody.Accounting_Software_Number);
      
      // מחזיר את ה-body המתוקן למבנה המקורי שלו
      body = typeof req.body.body === "string" ? JSON.stringify(parsedBody) : parsedBody;
    }
  } catch (e) {
    console.log("[ITA-Relay] Body parse bypass:", e.message);
  }

  // מדפיס ללוג של רנדר את ה-JSON המלא והסופי שנשלח
  console.log(`[ITA-Relay] Incoming Payload Body:`, typeof body === 'object' ? JSON.stringify(body, null, 2) : body);

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
