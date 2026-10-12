const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Base de datos ──────────────────────────────────────────────
const db = new Database('locations.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT NOT NULL,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    accuracy    REAL,
    battery     REAL,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );
`);

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas API ──────────────────────────────────────────────────

// POST /api/location — la app Android envía su posición
// Body: { device_id, device_name, lat, lng, accuracy, battery }
app.post('/api/location', (req, res) => {
  const { device_id, device_name, lat, lng, accuracy, battery } = req.body;

  if (!device_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'Faltan campos requeridos: device_id, lat, lng' });
  }

  // Registrar dispositivo si no existe
  const upsertDevice = db.prepare(`
    INSERT INTO devices (id, name) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);
  upsertDevice.run(device_id, device_name || device_id);

  // Guardar ubicación
  const insertLocation = db.prepare(`
    INSERT INTO locations (device_id, lat, lng, accuracy, battery)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertLocation.run(device_id, lat, lng, accuracy ?? null, battery ?? null);

  res.json({ ok: true });
});

// GET /api/devices — lista todos los dispositivos
app.get('/api/devices', (req, res) => {
  const devices = db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all();
  res.json(devices);
});

// GET /api/locations/latest — última posición de cada dispositivo
app.get('/api/locations/latest', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, d.name as device_name
    FROM locations l
    JOIN devices d ON d.id = l.device_id
    WHERE l.id IN (
      SELECT MAX(id) FROM locations GROUP BY device_id
    )
    ORDER BY l.timestamp DESC
  `).all();
  res.json(rows);
});

// GET /api/locations/history/:device_id — historial de un dispositivo
// Query params: limit (default 100), hours (default 24)
app.get('/api/locations/history/:device_id', (req, res) => {
  const { device_id } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const hours = parseInt(req.query.hours) || 24;

  const rows = db.prepare(`
    SELECT * FROM locations
    WHERE device_id = ?
      AND timestamp >= datetime('now', ? || ' hours')
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(device_id, `-${hours}`, limit);

  res.json(rows);
});

// ── Arranque ───────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor corriendo en http://127.0.0.1:${PORT}`);
});
