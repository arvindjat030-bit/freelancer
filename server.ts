import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = "ion-defense-secret-key-2026";

app.use(cors());
app.use(express.json());

// Mock User Database
const users = [
  {
    id: "1",
    username: "admin",
    password: bcrypt.hashSync("admin123", 10),
    role: "commander"
  }
];

// System State
let systemState = {
  gates: {
    main_gate: "CLOSED",
    sector_7: "CLOSED"
  },
  sensors: [
    { id: 'sns-01', name: 'Lobby Motion', location: 'Entrance', triggered: false, imageUrl: 'https://picsum.photos/seed/laser1/800/600' },
    { id: 'sns-02', name: 'Vault Laser', location: 'Secure Area', triggered: true, imageUrl: 'https://picsum.photos/seed/radar2/800/600' },
    { id: 'sns-03', name: 'Window Sensor', location: 'Office 4', triggered: false, imageUrl: 'https://picsum.photos/seed/sensor3/800/600' },
    { id: 'sns-04', name: 'Thermal Grid', location: 'Server Room', triggered: false, imageUrl: 'https://picsum.photos/seed/thermal4/800/600' },
  ],
  cameras: [
    { id: 'cam-01', name: 'Main Entrance', location: 'Exterior North', status: 'online', imageUrl: 'https://picsum.photos/seed/security1/800/600' },
    { id: 'cam-02', name: 'Perimeter West', location: 'Fence Line', status: 'online', imageUrl: 'https://picsum.photos/seed/surveillance2/800/600' },
    { id: 'cam-03', name: 'Server Room', location: 'Interior B1', status: 'alert', imageUrl: 'https://picsum.photos/seed/cctv3/800/600' },
    { id: 'cam-04', name: 'Hangar Bay', location: 'Interior A2', status: 'online', imageUrl: 'https://picsum.photos/seed/nightvision4/800/600' },
  ],
  weapons: [
    { id: 'wpn-01', name: 'Sentry Alpha', type: 'Auto-Turret', status: 'armed', ammo: 500, imageUrl: 'https://picsum.photos/seed/turret1/800/600' },
    { id: 'wpn-02', name: 'Sentry Beta', type: 'Railgun', status: 'idle', ammo: 24, imageUrl: 'https://picsum.photos/seed/cannon2/800/600' },
  ],
  doors: [
    { id: 'door-01', name: 'Main Gate', status: 'locked', imageUrl: 'https://picsum.photos/seed/gate1/800/600' },
    { id: 'door-02', name: 'Vault Door', status: 'locked', imageUrl: 'https://picsum.photos/seed/vault2/800/600' },
  ],
  lastAlert: "System initialized. No threats detected.",
  level: 'low',
  lockdown: false
};

// Knowledge Base for RAG
const knowledgeBase = [
  "Ion Defense System is a next-generation automated security platform.",
  "The system uses AI-driven CCTV monitoring and automated weaponry.",
  "Main Gate is the primary entry point for authorized personnel.",
  "Sector 7 is a high-security area requiring Level 5 clearance.",
  "Lockdown Protocol secures all doors and activates automated sentries.",
  "The system is equipped with EMP arrays and interceptor drones.",
  "Standard operating temperature for sensors is 20-25 degrees Celsius.",
  "Intrusion alerts are triggered by unauthorized motion in restricted zones."
];

// --- Auth Routes ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token, user: { username: user.username, role: user.role } });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// --- System Routes ---
app.get("/api/system/status", (req, res) => {
  res.json(systemState);
});

app.get("/api/system/cameras", (req, res) => res.json(systemState.cameras));
app.get("/api/system/weapons", (req, res) => res.json(systemState.weapons));
app.get("/api/system/doors", (req, res) => res.json(systemState.doors));
app.get("/api/system/sensors", (req, res) => res.json(systemState.sensors));

app.post("/api/system/lockdown", (req, res) => {
  systemState.lockdown = !systemState.lockdown;
  systemState.level = systemState.lockdown ? 'critical' : 'low';
  if (systemState.lockdown) {
    systemState.doors.forEach(d => d.status = 'locked');
    systemState.gates.main_gate = 'CLOSED';
    systemState.gates.sector_7 = 'CLOSED';
  }
  res.json({ success: true, lockdown: systemState.lockdown, level: systemState.level });
});

app.post("/api/system/weapon/toggle", (req, res) => {
  const { id } = req.body;
  const wpn = systemState.weapons.find(w => w.id === id);
  if (wpn) {
    wpn.status = wpn.status === 'idle' ? 'armed' : 'idle';
    return res.json({ success: true, status: wpn.status });
  }
  res.status(404).json({ error: "Weapon not found" });
});

app.post("/api/system/gate", (req, res) => {
  const { gateId, action } = req.body;
  if (systemState.gates[gateId as keyof typeof systemState.gates]) {
    systemState.gates[gateId as keyof typeof systemState.gates] = action === "OPEN" ? "OPEN" : "CLOSED";
    
    // Auto-close logic
    if (action === "OPEN") {
      setTimeout(() => {
        systemState.gates[gateId as keyof typeof systemState.gates] = "CLOSED";
        console.log(`Gate ${gateId} auto-closed.`);
      }, 10000); // 10 seconds auto-close
    }
    
    return res.json({ success: true, status: systemState.gates[gateId as keyof typeof systemState.gates] });
  }
  res.status(404).json({ error: "Gate not found" });
});

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { DynamicTool } from "@langchain/core/tools";

// --- AI Tools ---
const systemStatusTool = new DynamicTool({
  name: "get_system_status",
  description: "Get the current status of gates, sensors, and alerts.",
  func: async () => {
    return `Current System Status: 
    Gates: ${JSON.stringify(systemState.gates)}
    Sensors: ${JSON.stringify(systemState.sensors)}
    Last Alert: ${systemState.lastAlert}`;
  },
});

const timeTool = new DynamicTool({
  name: "get_current_time",
  description: "Get the current system time and date.",
  func: async () => {
    return new Date().toLocaleString();
  },
});

const calculatorTool = new DynamicTool({
  name: "calculator",
  description: "Perform mathematical calculations. Input should be a math expression.",
  func: async (expression: string) => {
    try {
      // Basic math evaluation
      const result = eval(expression.replace(/[^-()\d/*+.]/g, ''));
      return `The result is ${result}`;
    } catch (e) {
      return "Error in calculation. Please provide a valid math expression.";
    }
  },
});

const tools = [systemStatusTool, timeTool, calculatorTool];

// --- AI Digital Twin (LangChain) ---
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  apiKey: process.env.GEMINI_API_KEY!,
  maxOutputTokens: 2048,
}).bindTools(tools);

app.post("/api/ai/chat", async (req, res) => {
  const { message } = req.body;

  try {
    // RAG: Retrieve relevant context from knowledge base
    const context = knowledgeBase.filter(info => 
      message.toLowerCase().split(' ').some((word: string) => info.toLowerCase().includes(word))
    ).join("\n");

    const prompt = PromptTemplate.fromTemplate(`
      You are the ION Defense System Digital Twin.
      Context: {context}
      System Status: {status}
      User Question: {question}
      
      Answer the question based on the context and system status. 
      If you don't know, say you don't know. 
      Be professional and security-focused.
      If the user asks for a calculation, time, or system status, use your tools.
    `);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const response = await chain.invoke({
      context: context || "No specific context found.",
      status: JSON.stringify(systemState),
      question: message
    });

    res.json({ text: response });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ION Defense Server running at http://localhost:${PORT}`);
  });
}

startServer();
