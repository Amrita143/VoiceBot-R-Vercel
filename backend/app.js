// app.js
const express = require("express");
const cors = require("cors");
const Retell = require("retell-sdk");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY });

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Serverless is running" });
});

app.post("/api/create-web-call", async (req, res) => {
  try {
    const webCallResponse = await retellClient.call.createWebCall({
      agent_id: process.env.AGENT_ID,
      agent_version: parseInt(process.env.AGENT_VERSION),
      retell_llm_dynamic_variables: {
        ssn_last_four_digit: req.body.ssn_last_four_digit || "1234",
        full_name: req.body.full_name || "John Smith",
      },
      metadata: {
        created_at: new Date().toISOString(),
        client_type: "web",
        ...req.body.metadata,
      },
    });

    res.json({
      success: true,
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id,
      agent_name: webCallResponse.agent_name,
    });
  } catch (error) {
    console.error("create-web-call error:", error);
    res.status(500).json({ success: false, error: "Failed to create web call", details: error.message });
  }
});

app.get("/api/get-call-analysis/:call_id", async (req, res) => {
  try {
    const callResponse = await retellClient.call.retrieve(req.params.call_id);
    res.json(callResponse);
  } catch (error) {
    console.error("get-call-analysis error:", error);
    res.status(500).json({ error: "Failed to retrieve call analysis", details: error.message });
  }
});

module.exports = app;
