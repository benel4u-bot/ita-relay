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

  // נרמל את ה-headers — ודא שהם נשלחים בפורמט הנכון
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

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
      // מגן ברזל סופי: החלפת טקסט אגרסיבית ישירות על הסטרינג שיוצא מה-Axios פיזית לרשת!
      transformRequest: [
        (data) => {
          let str = typeof data === "string" ? data : JSON.stringify(data);
          if (str) {
            // מחליף את כל המספרים החשופים לסטרינגים עם גרשיים באופן גורף
            str = str.replace(/"Accounting_Software_Number"\s*:\s*99999999/g, '"Accounting_Software_Number":"99999999"');
            str = str.replace(/"Invoice_Type"\s*:\s*305/g, '"Invoice_Type":"305"');
            str = str.replace(/"Branch_ID"\s*:\s*0/g, '"Branch_ID":"0"');
            str = str.replace(/"Customer_Type"\s*:\s*1/g, '"Customer_Type":"1"');
          }
          console.log("[ITA-Relay] Ultra Final Wire Payload:", str);
          return str;
        }
      ],
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
