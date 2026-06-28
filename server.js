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

  try {
    let isString = (typeof bodyData === "string");
    let obj = isString ? JSON.parse(bodyData) : bodyData;

    if (obj && typeof obj === "object") {
      // 1. הזרקת שדות חובה של V2 שאולי חסרים בלאבאבול ומשגעים את שע"ם
      if (obj.Discount_Amount === undefined) obj.Discount_Amount = 0.0;
      if (obj.Property_Type === undefined) obj.Property_Type = "1"; // 1 מייצג שירות/טובין רגיל
      if (obj.Payment_Method === undefined) obj.Payment_Method = "3"; // 3 מייצג כרטיס אשראי (או "6" להעברה)

      // 2. המרה קשיחה של סכומים למספרים עשרוניים (.0) למניעת שגיאות integer
      if (obj.Amount_Before_Discount) obj.Amount_Before_Discount = parseFloat(obj.Amount_Before_Discount).toFixed(1);
      if (obj.Payment_Amount) obj.Payment_Amount = parseFloat(obj.Payment_Amount).toFixed(1);
      if (obj.VAT_Amount) obj.VAT_Amount = parseFloat(obj.VAT_Amount).toFixed(1);
      if (obj.Payment_Amount_Including_VAT) obj.Payment_Amount_Including_VAT = parseFloat(obj.Payment_Amount_Including_VAT).toFixed(1);

      // 3. המרה קשיחה של מזהים וסיווגים לסטרינגים עם גרשיים
      if (obj.Vat_Number) obj.Vat_Number = String(obj.Vat_Number);
      if (obj.Customer_VAT_Number) obj.Customer_VAT_Number = String(obj.Customer_VAT_Number);
      if (obj.Accounting_Software_Number) obj.Accounting_Software_Number = String(obj.Accounting_Software_Number);
      if (obj.Invoice_Type) obj.Invoice_Type = String(obj.Invoice_Type);
      if (obj.Branch_ID) obj.Branch_ID = String(obj.Branch_ID);
      if (obj.Customer_Type) obj.Customer_Type = String(obj.Customer_Type);

      // עדכון ה-body המעובד
      bodyData = obj;
    }
  } catch (e) {
    console.log("[ITA-Relay] Data Injection Error:", e.message);
  }

  // הדפסה נקייה ללוג כדי שנוכל לראות את המבנה המוזרק והשלם
  console.log(`[ITA-Relay] Prepared Payload Body:`, JSON.stringify(bodyData));

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
