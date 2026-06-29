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
      
      // 1. שדות טקסט (A) -> חייבים להיות String עם גרשיים לפי המפרט
      if (obj.Invoice_ID) obj.Invoice_ID = String(obj.Invoice_ID);
      if (obj.Invoice_Reference_Number) obj.Invoice_Reference_Number = String(obj.Invoice_Reference_Number);
      if (obj.Branch_ID) obj.Branch_ID = String(obj.Branch_ID);
      if (obj.Customer_Name) obj.Customer_Name = String(obj.Customer_Name);
      if (obj.Invoice_Date) obj.Invoice_Date = String(obj.Invoice_Date);
      if (obj.Invoice_Issuance_Date) obj.Invoice_Issuance_Date = String(obj.Invoice_Issuance_Date);

      // 2. שדות מספרים שלמים (N) -> חייבים להיות Integer נקי ללא גרשיים לפי המפרט
      if (obj.Invoice_Type) obj.Invoice_Type = parseInt(obj.Invoice_Type, 10);
      if (obj.Vat_Number) obj.Vat_Number = parseInt(obj.Vat_Number, 10);
      if (obj.Customer_VAT_Number) obj.Customer_VAT_Number = parseInt(obj.Customer_VAT_Number, 10);
      if (obj.Customer_Type) obj.Customer_Type = parseInt(obj.Customer_Type, 10);
      if (obj.Accounting_Software_Number) obj.Accounting_Software_Number = parseInt(obj.Accounting_Software_Number, 10);

      // 3. שדות סכומים (N12.2) -> מספרים עשרוניים (Float) ללא גרשיים
      if (obj.Amount_Before_Discount) obj.Amount_Before_Discount = Number(parseFloat(obj.Amount_Before_Discount).toFixed(2));
      if (obj.Payment_Amount) obj.Payment_Amount = Number(parseFloat(obj.Payment_Amount).toFixed(2));
      if (obj.VAT_Amount) obj.VAT_Amount = Number(parseFloat(obj.VAT_Amount).toFixed(2));
      if (obj.Payment_Amount_Including_VAT) obj.Payment_Amount_Including_VAT = Number(parseFloat(obj.Payment_Amount_Including_VAT).toFixed(2));

      // 4. נרמול פריטים בתוך מערך Items
      if (obj.Items && Array.isArray(obj.Items)) {
        obj.Items = obj.Items.map(item => ({
          Index: parseInt(item.Index || 1, 10),
          Description: String(item.Description || "בדיקה"),
          Quantity: Number(parseFloat(item.Quantity || 1).toFixed(2)),
          Price_Per_Unit: Number(parseFloat(item.Price_Per_Unit || 0).toFixed(2)),
          Total_Amount: Number(parseFloat(item.Total_Amount || 0).toFixed(2)),
          VAT_Rate: Number(parseFloat(item.VAT_Rate || 0).toFixed(2)),
          VAT_Amount: Number(parseFloat(item.VAT_Amount || 0).toFixed(2))
        }));
      }

      bodyData = obj;
    }
  } catch (e) {
    console.log("[ITA-Relay] Document Specs Normalization Error:", e.message);
  }

  console.log(`[ITA-Relay] Official Spec Body:`, JSON.stringify(bodyData));

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
