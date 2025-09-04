import React, { useEffect, useMemo, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import panzoom from "panzoom";
import mermaid from "mermaid";

// -----------------------------
// Backend URL
// -----------------------------
// const API_URL = "https://4a5785e5-d05a-4b8a-a904-dfa5736df5c5-00-17f4grk3hzgw9.picard.replit.dev";

// Mermaid source (do not modify the diagram text)
const MERMAID_CODE = `
---
config:
  theme: redux
  look: neo
---
flowchart TD
    Start(["Full Name Verification"]) --> Tape["Tape Disclosure & SSN Verification"]
    Tape --> Purpose["Purpose of Call"]
    Purpose --> Questions["7 Lead Qualification Questions"]
    Questions --> IncomeDecision{"Income Source?"}
    IncomeDecision -- Eligible Employment --> BankDecision{"Bank for Income Deposit?"}
    IncomeDecision -- Ineligible --> IncomeReject["❌ DISQUALIFIED<br>Financial/Legal entities,<br>Unemployment benefits,<br>Uber/DoorDash drivers"]
    BankDecision -- "Acceptable Banks<br>JPMC, BofA, etc." --> AcceptableBank["✓ Acceptable Bank Verified"]
    BankDecision -- Unacceptable --> BankReject["❌ DISQUALIFIED<br>UMB, Chime etc."]
    AcceptableBank --> DirectDeposit["Direct Deposit Confirmation"]
    DirectDeposit --> CardType["Card Type Verification<br>Visa/Mastercard Required"]
    CardType --> BalanceDecision{"Current Available<br>Balance?"}
    BalanceDecision -- Balance > Negative $505 --> PayFreqDecision{"Pay Frequency?"}
    BalanceDecision -- Balance ≤ Negative $505 --> BalanceReject["❌ DISQUALIFIED<br>Insufficient Balance<br>Below -$505 threshold"]
    PayFreqDecision -- "Weekly/Bi-weekly/<br>Semi-monthly/Monthly" --> AcceptableFreq["✓ Acceptable Pay Schedule"]
    PayFreqDecision -- Daily --> FreqReject["❌ DISQUALIFIED<br>Daily Pay"]
    AcceptableFreq --> IncomeAmountDecision{"Monthly Income?"}
    IncomeAmountDecision -- ≥ $950 --> AcceptableIncome["✓ Income Requirement Met"]
    IncomeAmountDecision -- &lt; $950 --> AmountReject["❌ DISQUALIFIED<br>Below $950<br>Monthly Minimum"]
    AcceptableIncome --> Success(["🎉 QUALIFIED<br>Transfer to<br>Verification Department"])
     Start:::processNode
     Tape:::processNode
     Purpose:::processNode
     Questions:::processNode
     IncomeDecision:::decisionNode
     BankDecision:::decisionNode
     IncomeReject:::rejectNode
     AcceptableBank:::acceptNode
     BankReject:::rejectNode
     DirectDeposit:::processNode
     CardType:::processNode
     BalanceDecision:::decisionNode
     PayFreqDecision:::decisionNode
     BalanceReject:::rejectNode
     AcceptableFreq:::acceptNode
     FreqReject:::rejectNode
     IncomeAmountDecision:::decisionNode
     AcceptableIncome:::acceptNode
     AmountReject:::rejectNode
     Success:::successNode
    classDef processNode fill:#3498db,stroke:#2c3e50,stroke-width:2px,color:#fff
    classDef decisionNode fill:#9b59b6,stroke:#2c3e50,stroke-width:2px,color:#fff
    classDef rejectNode fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef acceptNode fill:#27ae60,stroke:#229954,stroke-width:2px,color:#fff
    classDef successNode fill:#27ae60,stroke:#229954,stroke-width:3px,color:#fff,font-weight:bold
`;

// -----------------------------
// Helpers
// -----------------------------
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const listener = (e) => setMatches(e.matches);
    m.addEventListener("change", listener);
    return () => m.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

// Throttle setState with requestAnimationFrame to avoid flicker
function useRafUpdater(initial) {
  const [state, setState] = useState(initial);
  const frame = useRef(0);
  const next = useRef(initial);
  const set = (val) => {
    next.current = typeof val === "function" ? val(next.current) : val;
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setState(next.current);
      });
    }
  };
  useEffect(() => () => frame.current && cancelAnimationFrame(frame.current), []);
  return [state, set];
}

// Smooth autoscroll if user is near bottom
function scrollToBottomIfNeeded(container) {
  if (!container) return;
  const threshold = 120; // px from bottom considered "near"
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  if (isNearBottom) {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
}

// -----------------------------
// UI Atoms
// -----------------------------
const Pill = ({ children, className = ""}) => (
  <span className={`inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ${className}`}>{children}</span>
);

const IconBtn = ({ label, onClick, disabled, children, className = "" }) => (
  <button
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex select-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

// -----------------------------
// Dynamic Variables Editor
// -----------------------------
function VariablesEditor({ open, onClose, onSave, initial }) {
  const [rows, setRows] = useState(() => initial || [
    { key: "full_name", value: "John Smith" },
    { key: "ssn_last_four_digit", value: "1234" },
  ]);

  useEffect(() => {
    if (open) {
      setRows(initial && initial.length ? initial : [
        { key: "full_name", value: "John Smith" },
        { key: "ssn_last_four_digit", value: "1234" },
      ]);
    }
  }, [open]);

  if (!open) return null;

  const addRow = () => setRows((r) => [...r, { key: "", value: "" }]);
  const delRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const setCell = (i, field, val) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-lg font-semibold">Pre-Call Info</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-1">Key</th>
                <th className="px-2 py-1">Value</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="">
                  <td className="px-2 py-1"><input value={row.key} onChange={(e) => setCell(i, "key", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></td>
                  <td className="px-2 py-1"><input value={row.value} onChange={(e) => setCell(i, "value", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></td>
                  <td className="px-2 py-1 text-right"><button onClick={() => delRow(i)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50" onClick={addRow}>Add Row</button>
          <div className="space-x-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => onSave(rows)} className="rounded-lg bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-black">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Post-call Analysis Panel
// -----------------------------
function AnalysisPanel({ open, onClose, analysis }) {
  if (!open) return null;
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(analysis || {}, null, 2));
    } catch {}
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-lg font-semibold">Post Call Analysis</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        {analysis ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500">Summary</div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed">{analysis.call_summary || "—"}</div>
              <div className="text-xs font-medium text-gray-500">User Sentiment</div>
              <Pill>{analysis.user_sentiment || "—"}</Pill>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Extracted Info</div>
              <div className="mt-2 space-y-2 text-sm">
                {analysis.custom_analysis_data && Object.entries(analysis.custom_analysis_data).map(([k,v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">No analysis available.</div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={copyJson} className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Copy JSON</button>
          <button onClick={onClose} className="rounded-lg bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-black">Close</button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Conversation Transcript (smooth, incremental)
// -----------------------------
function Transcript({ messages }) {
  const ref = useRef(null);
  useEffect(() => {
    scrollToBottomIfNeeded(ref.current);
  }, [messages]);

  return (
    <div ref={ref} className="h-[420px] w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
      {messages.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-500">Click <b>Start Call</b> and grant mic permission to begin.</div>
      )}
      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${
              m.role === "agent"
                ? "self-start border-indigo-200 bg-indigo-50"
                : m.role === "user"
                ? "self-end border-gray-200 bg-gray-50"
                : "mx-auto border-amber-200 bg-amber-50"
            }`}
          >
            <div className="mb-1 text-xs font-medium text-gray-500">{m.role === "agent" ? "Agent" : m.role === "user" ? "You" : "System"}</div>
            <div>{m.content}</div>
            <div className="mt-1 text-right text-[10px] text-gray-400">{new Date(m.ts).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------
// Right-side: Call Progression Flow (from provided steps)
// -----------------------------
const FLOW_STEPS = [
  { title: "Full Name Verification" },
  { title: "Tape Disclosure & SSN Verification" },
  { title: "Purpose of Call" },
  { title: "7 Lead Qualification / Eligibility Questions" },
  {
    title: "Income Source?",
    sideNotes: [
      {
        type: "no",
        text:
          "Ineligible income source (Financial/Legal entities, Unemployment benefits, or delivery/driving services like Uber driver / DoorDash delivery agent are not acceptable)",
      },
    ],
  },
  { title: "Bank Used for Eligible Income Source", sideNotes: [{ type: "no", text: "Unacceptable Banks (UMB, Chime etc.)" }] },
  { title: "Acceptable Banks (JPMC, Bank of America etc.)", accept: true },
  { title: "Direct Deposit Confirmation" },
  { title: "Type of Card Linked" },
  { title: "Acceptable Cards (Visa / MasterCard)", accept: true },
  { title: "Current Available Balance", sideNotes: [{ type: "no", text: "Unacceptable balance (< –$505)" }] },
  { title: "Pay Frequency", sideNotes: [{ type: "no", text: "Unacceptable: Daily" }] },
  { title: "Acceptable Pay Frequency (Weekly, Bi-weekly, Monthly, Semi-monthly)", accept: true },
  { title: "Income Amount / Salary", sideNotes: [{ type: "no", text: "Unacceptable: < $950 monthly" }] },
  { title: "Acceptable Salary (≥ $950 monthly)", accept: true },
  { title: "Successful Lead Qualification → Transfer to Verification Department", final: true },
];

type FlowNodeProps = {
  title: string;
  accept?: boolean;
  final?: boolean;
  sideNotes?: { type: string; text: string }[];
};

function FlowNode({ title, accept = false, final = false, sideNotes = [] }: FlowNodeProps) {
  return (
    <div className="relative pl-12 pb-8">
      <div className="absolute left-[14px] top-2 h-3 w-3 rounded-full bg-gray-400 ring-4 ring-white" />
      {!final && <div className="absolute left-[25px] top-5 bottom-0 w-[2px] bg-gray-200" />}
      <div className={`rounded-2xl border p-4 ${final ? "border-indigo-300 bg-indigo-50" : accept ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"}`}>
        <div className="text-sm font-semibold">{title}</div>
        {accept && <div className="mt-1 text-xs font-medium text-emerald-700">✓ Acceptable condition</div>}
        {final && <div className="mt-1 text-xs font-medium text-indigo-700">End of qualification path</div>}
        {sideNotes?.length > 0 && (
          <div className="mt-3 space-y-2">
            {sideNotes.map((n, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-6 top-3 h-[2px] w-6 bg-[#D77A86]" />
                <div className="rounded-xl border border-[#E8BAC2] bg-[#FFE5E9] px-3 py-2 text-xs text-[#8C2F3B]">
                <span className="mr-1 font-semibold">Unacceptable →</span>
                {n.text}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CallProgressionFlow() {
  return (
    <div className="w-full p-4 bg-[#FFF5F3] rounded-2xl border border-[#F7E9E6]">

      <h2 className="mb-3 text-lg font-semibold">Call Progression Flow</h2>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-gray-200" />
        <div>
          {FLOW_STEPS.map((s, i) => (
            <FlowNode key={i} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Right-side: Mermaid Canvas (zoom & pan)
// -----------------------------
function MermaidCanvas() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({ startOnLoad: false });
    const render = async () => {
      try {
        const { svg } = await mermaid.render(`m-${Date.now()}`, MERMAID_CODE);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          svgRef.current = containerRef.current.querySelector("svg");
          if (svgRef.current) {
            panRef.current = panzoom(svgRef.current, { maxZoom: 8, minZoom: 0.2 });
          }
        }
      } catch (e) {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class=\\"text-xs text-gray-600\\">${MERMAID_CODE.replace(/</g, "&lt;")}</pre>`;
        }
      }
    };
    render();
    return () => { cancelled = true; if (panRef.current) panRef.current.dispose?.(); };
  }, []);

  const zoom = (delta) => {
    if (!panRef.current) return;
    const pz = panRef.current;
    const t = pz.getTransform();
    const factor = delta > 0 ? 1.2 : 0.8;
    pz.zoomAbs(0, 0, t.scale * factor);
  };

  const reset = () => panRef.current?.moveTo(0, 0) || panRef.current?.zoomAbs(0, 0, 1);

  return (
    <div className="flex h-full w-full flex-col p-4 bg-[#FFF5F3] rounded-2xl border border-[#F7E9E6]">

      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Call Flow Diagram</span>
        <div className="ml-auto flex items-center gap-2">
          <IconBtn label="Zoom Out" onClick={() => zoom(-1)} disabled={false}>-</IconBtn>
          <IconBtn label="Zoom In" onClick={() => zoom(1)} disabled={false}>+</IconBtn>
          <IconBtn label="Reset" onClick={reset} disabled={false}>Reset</IconBtn>
        </div>
      </div>
      <div className="h-full w-full overflow-auto rounded-2xl border border-gray-200 bg-white">
        <div ref={containerRef} className="min-w-[640px] p-4"></div>
      </div>
    </div>
  );
}

// -----------------------------
// Main: Voicebot Interaction (left side)
// -----------------------------
function VoicebotInteraction() {
  const retellRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [varsOpen, setVarsOpen] = useState(false);
  const [vars, setVars] = useState([
    { key: "full_name", value: "John Smith" },
    { key: "ssn_last_four_digit", value: "1234" },
  ]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [callId, setCallId] = useState(null);
  const [agentTalking, setAgentTalking] = useState(false);
  const [messages, setMessages] = useRafUpdater([]);

  // Initialize SDK once
  useEffect(() => {
    console.log("Initializing Retell SDK...");
    // Create the SDK instance
    const sdk = new RetellWebClient();
    retellRef.current = sdk;

    // Define all event handlers
    const handleCallStarted = () => {
      console.log("SDK Event: call_started");
      setStatus("active");
      // Don't clear messages here - do it when starting the call
      addSystem("📞 Call connected. You can start speaking now.");
    };

    const handleCallEnded = () => {
    console.log("SDK Event: call_ended");
    setStatus("ended");
    addSystem("📞 Call disconnected.");
    setAgentTalking(false);
    };

    const handleAgentStartTalking = () => {
    console.log("SDK Event: agent_start_talking");
    setAgentTalking(true);
    };

    const handleAgentStopTalking = () => {
    console.log("SDK Event: agent_stop_talking");
    setAgentTalking(false);
    };

    const handleUpdate = (update) => {
      console.log("SDK Event: update", update);
      
      // The transcript is an array of utterances with incremental updates
      if (!update?.transcript || update.transcript.length === 0) return;
      
      // Build the message array from the transcript
      // Each utterance represents the current state of that part of the conversation
      const messages = update.transcript.map((utterance, index) => ({
        role: utterance.role,
        content: utterance.content,
        // Use a stable timestamp based on index to maintain order
        ts: Date.now()
      }));
    
    setMessages(messages);
    };
  
  const handleError = (error) => {
    console.error("SDK Event: error", error);
    addSystem(`⚠️ Error: ${error?.message || "Unknown error"}`);
    setStatus("idle");
    setAgentTalking(false);
  };
  
  const handleDisconnect = () => {
    console.log("SDK Event: disconnect");
    setStatus("reconnecting");
  };
  
  const handleReconnect = () => {
    console.log("SDK Event: reconnect");
    setStatus("active");
  };
  
  // Attach all event listeners
  sdk.on("call_started", handleCallStarted);
  sdk.on("call_ended", handleCallEnded);
  sdk.on("agent_start_talking", handleAgentStartTalking);
  sdk.on("agent_stop_talking", handleAgentStopTalking);
  sdk.on("update", handleUpdate);
  sdk.on("error", handleError);
  sdk.on("disconnect", handleDisconnect);
  sdk.on("reconnect", handleReconnect);
  
  console.log("Retell SDK initialized with event listeners");
  
  // Cleanup function
  return () => {
    console.log("Cleaning up Retell SDK...");
    // The SDK might not have an 'off' method - check the documentation
    // If it doesn't, we can't remove listeners, but that's okay since
    // we're destroying the instance anyway
    if (sdk.stopCall) {
      sdk.stopCall();
    }
  };
}, []);

    // const onStarted = () => { console.log("SDK Event: call_started"); setStatus("active"); setMessages([]); addSystem("📞 Call connected. You can start speaking now."); };
    // const onEnded = () => { console.log("SDK Event: call_ended"); setStatus("ended"); addSystem("📞 Call disconnected."); setAgentTalking(false); };
    // const onStartTalking = () => setAgentTalking(true);
    // const onStopTalking = () => setAgentTalking(false);
    // const onError = (err) => { addSystem(`⚠️ Error: ${err?.message || "Unknown"}`); setStatus("idle"); setAgentTalking(false); };
    // const onDisconnect = () => setStatus("reconnecting");
    // const onReconnect = () => setStatus("active");

    // const onUpdate = (update) => {
    //   if (!update?.transcript || update.transcript.length === 0) return;
    //   const last = update.transcript[update.transcript.length - 1];
    //   setMessages((prev) => {
    //     const next = [...prev];
    //     const nowTs = Date.now();
    //     // If last message has same role, update content; else push new
    //     const tail = next[next.length - 1];
    //     if (tail && tail.role === last.role) {
    //       tail.content = last.content;
    //       tail.ts = nowTs;
    //     } else {
    //       next.push({ role: last.role, content: last.content, ts: nowTs });
    //     }
    //     return next;
    //   });
    // };

    // const onUpdate = (update) => {
    //   // update.transcript is an array of utterances (last few entries)
    //   if (!update?.transcript) return;
    //   const now = Date.now();
    //   // Simple + reliable: rebuild the message list from the array
    //   setMessages(
    //     update.transcript.map((u) => ({
    //       role: u.role,          // "agent" | "user"
    //       content: u.content,    // evolving content
    //       ts: now,               // you can also keep a per-item timestamp if SDK provides one
    //     }))
    //   );
    // };



  //   const onUpdate = (update) => {
  //     // Check if we have a valid transcript
  //     if (!update?.transcript || update.transcript.length === 0) return;
      
  //     // The transcript array contains the conversation so far with incremental updates
  //     // Simply rebuild our messages from this transcript
  //     const now = Date.now();
      
  //     setMessages(
  //       update.transcript.map((utterance, index) => ({
  //         role: utterance.role,          // "agent" or "user"
  //         content: utterance.content,    // The evolving content
  //         ts: now - (update.transcript.length - index) * 100, // Stagger timestamps for order
  //       }))
  //     );
  //   };

  //   sdk.on("call_started", onStarted);
  //   sdk.on("call_ended", onEnded);
  //   sdk.on("agent_start_talking", onStartTalking);
  //   sdk.on("agent_stop_talking", onStopTalking);
  //   sdk.on("update", onUpdate);
  //   sdk.on("error", onError);
  //   sdk.on("disconnect", onDisconnect);
  //   sdk.on("reconnect", onReconnect);

  //   return () => {
  //     sdk.off?.("call_started", onStarted);
  //     sdk.off?.("call_ended", onEnded);
  //     sdk.off?.("agent_start_talking", onStartTalking);
  //     sdk.off?.("agent_stop_talking", onStopTalking);
  //     sdk.off?.("update", onUpdate);
  //     sdk.off?.("error", onError);
  //     sdk.off?.("disconnect", onDisconnect);
  //     sdk.off?.("reconnect", onReconnect);
  //   };
  // }, [setMessages]);

  const addSystem = (text) => setMessages((prev) => [...prev, { role: "system", content: text, ts: Date.now() }]);

  const startCall = async () => {
    try {
      setStatus("connecting");
      setMessages([]); // Clear previous messages when starting new call
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const payload = Object.fromEntries(vars.filter(v => v.key).map(({key, value}) => [key, value]));
      const res = await fetch(`/api/create-web-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, metadata: { session_id: String(Date.now()) } })
      });
      if (!res.ok) throw new Error("Failed to create web call");
      const data = await res.json();
      setCallId(data.call_id);
      // setStatus("active");
      await retellRef.current.startCall({ accessToken: data.access_token, sampleRate: 24000, captureDeviceId: "default", playbackDeviceId: "default", emitRawAudioSamples: false });
      // Fallback in case 'call_started' event is delayed
      // setStatus((s) => (s === "connecting" ? "active" : s));
    } catch (e) {
      addSystem(`⚠️ ${e?.message || e}`);
      setStatus("idle");
      setAgentTalking(false);
    }
  };

  const endCall = () => {
    if (retellRef.current) {
      retellRef.current.stopCall();
    }
    setAgentTalking(false);
  };

  const fetchAnalysis = async () => {
    if (!callId) return;
    try {
      const res = await fetch(`/api/get-call-analysis/${callId}`);
      const json = await res.json();
      setAnalysis(json?.call_analysis || null);
      setAnalysisOpen(true);
    } catch {
      setAnalysis(null); setAnalysisOpen(true);
    }
  };

  const statusText = {
    idle: "Idle",
    connecting: "Connecting…",
    active: "In Call",
    reconnecting: "Reconnecting…",
    ended: "Call Ended",
  }[status];

  const canStart = status === "idle" || status === "ended";
  const canEnd = status === "active" || status === "reconnecting";
  const canAnalyze = status === "ended" && callId;

  // Then use these for disabled props
  // const startDisabled = !canStart;
  // const endDisabled = !canEnd;
  // const analysisDisabled = !canAnalyze;
  const startDisabled = status === "connecting" || status === "active" || status === "reconnecting";
  const endDisabled   = !(status === "active" || status === "reconnecting");
  const analysisDisabled = status !== "ended" || !callId;

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4 bg-[#FFF5F3] rounded-2xl border border-[#F7E9E6]">

      {/* Top bar with logo + heading */}
      {/* <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-600">LOGO</div>
        <div className="text-center text-lg font-semibold text-gray-900">Heading like Astra Voice AI</div>
        <div className="text-right text-xs text-gray-500"/>
      </div> */}

      <div className="flex items-center gap-3">
        <img
          src="/astra-logo-2.png"
          alt="Astra Global"
          className="h-20 rounded-md border"
        />
        <div className="flex-1">
          <div className="mx-auto inline-flex max-w-full items-center rounded-xl bg-[#335C78] px-6 py-3 text-white">
            <span className="font-extrabold italic text-xl md:text-2xl">ASTRA Voice AI</span>
            <span className="px-4 text-lg md:text-xl">×</span>
            <span className="font-extrabold italic text-xl md:text-2xl">LEND</span>
            <span className="ml-1 font-extrabold italic text-xl md:text-2xl text-[#64C038]">360</span>
          </div>
        </div>
      </div>


      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        <IconBtn label="Edit Variables" onClick={() => setVarsOpen(true)} disabled={false}>{"{}"}</IconBtn>

        <Pill>
          Call Status: {statusText}
        </Pill>

        <IconBtn label="Start Call" onClick={startCall} className="!bg-emerald-500 !border-emerald-500 text-white hover:!bg-emerald-700" disabled={startDisabled}>
          Start Call
        </IconBtn>

        <IconBtn label="End Call" onClick={endCall} className="!bg-rose-600 !border-rose-600 text-white hover:!bg-rose-700"disabled={endDisabled}>
          End Call
        </IconBtn>

        <IconBtn label="Post Call Analysis" onClick={fetchAnalysis} className="!bg-[#335C78] !border-[#335C78] text-white hover:opacity-90" disabled={analysisDisabled}>
          Post Call Analysis
        </IconBtn>
      </div>

      {/* Speaking indicator */}
      {agentTalking && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" /> Agent is speaking…
        </div>
      )}

      {/* Transcript */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-700"><b>Conversation Transcript</b></div>
        <Transcript messages={messages} />
      </div>

      {/* Modals */}
      <VariablesEditor open={varsOpen} onClose={() => setVarsOpen(false)} onSave={(rows) => { setVars(rows); setVarsOpen(false); }} initial={vars} />
      <AnalysisPanel open={analysisOpen} onClose={() => setAnalysisOpen(false)} analysis={analysis} />
    </div>
  );
}

// -----------------------------
// Split layout with draggable divider (desktop)
// -----------------------------
function SplitLayout() {
  const isSmall = useMediaQuery("(max-width: 1024px)");
  const [leftPct, setLeftPct] = useState(50);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const x = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const total = window.innerWidth;
      const pct = Math.min(80, Math.max(20, (x / total) * 100));
      setLeftPct(pct);
    };
    const stop = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  // Small screens → simple top nav
  const [tab, setTab] = useState("voice");
  if (isSmall) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="sticky top-0 z-10 flex w-full items-center gap-2 border-b bg-white p-2">
          {[
            { id: "voice", label: "Voicebot Interaction" },
            { id: "flow", label: "Call Progression Flow" },
            { id: "mermaid", label: "Call Flow Diagram" },
          ].map((t) => (
            <button key={t.id} className={`rounded-lg px-3 py-1 text-sm ${tab === t.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
          {tab === "voice" && <VoicebotInteraction />}
          {tab === "flow" && <CallProgressionFlow />}
          {tab === "mermaid" && <MermaidCanvas />}
        </div>
      </div>
    );
  }

  // Desktop split view
  return (
    <div className="flex h-full w-full flex-row overflow-hidden">
      <div style={{ width: `${leftPct}%` }} className="min-w-[360px] overflow-auto border-r bg-gray-50">
        <VoicebotInteraction />
      </div>
      <div
        onMouseDown={() => (dragging.current = true)}
        onTouchStart={() => (dragging.current = true)}
        className="group flex w-2 cursor-col-resize items-center justify-center bg-gray-100 hover:bg-gray-200"
        title="Drag to resize"
      >
        <div className="h-10 w-1 rounded bg-gray-300 group-hover:bg-gray-400" />
      </div>
      <div style={{ width: `${100 - leftPct}%` }} className="min-w-[360px] overflow-auto bg-gray-50">
        <div className="sticky top-0 z-10 border-b bg-white/80 p-2 backdrop-blur">
          <div className="flex gap-2">
            <Pill>Right Panel</Pill>
            <span className="text-sm text-gray-600">Toggle below</span>
          </div>
        </div>
        <div className="grid grid-rows-[auto_auto_1fr]">
          {/* Toggle buttons */}
          <div className="flex items-center gap-2 p-3">
            <RightPane />
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPane() {
  const [mode, setMode] = useState("flow");
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        <button className={`rounded-lg px-3 py-1 text-sm ${mode === "flow" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`} onClick={() => setMode("flow")}>Call Progression Flow</button>
        <button className={`rounded-lg px-3 py-1 text-sm ${mode === "mermaid" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`} onClick={() => setMode("mermaid")}>Call Flow Diagram</button>
      </div>
      <div className="min-h-[70vh] rounded-2xl border border-gray-200 bg-white">
        {mode === "flow" ? <CallProgressionFlow /> : <MermaidCanvas />}
      </div>
    </div>
  );
}

// -----------------------------
// App Root
// -----------------------------
export default function App() {
  return (
    <div className="h-screen w-full bg-white text-gray-900">
      <SplitLayout />
    </div>
  );
}
