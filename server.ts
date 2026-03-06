import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("graph.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS graph_data (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/graph", (req, res) => {
    try {
      const row = db.prepare("SELECT data FROM graph_data WHERE id = 1").get() as { data: string } | undefined;
      if (row) {
        res.json(JSON.parse(row.data));
      } else {
        res.json({ nodes: [], links: [] });
      }
    } catch (error) {
      console.error("Error fetching graph:", error);
      res.status(500).json({ error: "Failed to fetch graph data" });
    }
  });

  app.post("/api/graph", (req, res) => {
    try {
      const data = JSON.stringify(req.body);
      db.prepare(`
        INSERT INTO graph_data (id, data, updated_at) 
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `).run(data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving graph:", error);
      res.status(500).json({ error: "Failed to save graph data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
