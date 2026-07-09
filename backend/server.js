/**
 * Khata backend — REST API for houses, tenants, rent payments and electricity bills.
 * Also serves the frontend so you can deploy one app to a server.
 *
 *   npm install
 *   npm start          ->  http://localhost:3000
 */
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "4mb" }));

const FRONTEND = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND));

const collections = ["houses", "tenants", "payments", "ebills"];

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v, n) { return String(v == null ? "" : v).slice(0, n); }

function cleanHouse(b) {
  return { name: str(b.name, 120), address: str(b.address, 220), note: str(b.note, 300) };
}
function cleanTenant(b) {
  return {
    houseId: str(b.houseId, 60),
    room: str(b.room, 120),
    name: str(b.name, 120),
    phone: str(b.phone, 40),
    rent: num(b.rent),
    deposit: num(b.deposit),
    moveIn: str(b.moveIn, 7),
    status: b.status === "vacant" ? "vacant" : "occupied",
    note: str(b.note, 300),
  };
}
function cleanPayment(b) {
  return {
    tenantId: str(b.tenantId, 60),
    amount: num(b.amount),
    date: str(b.date, 10),
    forMonth: str(b.forMonth, 7),
    mode: str(b.mode || "Cash", 30),
    note: str(b.note, 300),
  };
}
function cleanEbill(b) {
  return {
    tenantId: str(b.tenantId, 60),
    month: str(b.month, 7),
    prev: num(b.prev),
    curr: num(b.curr),
    units: num(b.units),
    rate: num(b.rate),
    amount: num(b.amount),
    paid: !!b.paid,
    paidDate: b.paid ? str(b.paidDate, 10) : "",
    note: str(b.note, 300),
  };
}
const cleaners = { houses: cleanHouse, tenants: cleanTenant, payments: cleanPayment, ebills: cleanEbill };

app.get("/api/state", (req, res) => res.json(db.read()));

function mount(name) {
  const clean = cleaners[name];

  app.post(`/api/${name}`, (req, res) => {
    const state = db.read();
    const rec = Object.assign({ id: db.uid() }, clean(req.body || {}));
    state[name].push(rec);
    db.write(state);
    res.status(201).json(rec);
  });

  app.put(`/api/${name}/:id`, (req, res) => {
    const state = db.read();
    const i = state[name].findIndex((x) => x.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "not found" });
    state[name][i] = Object.assign({ id: req.params.id }, clean(req.body || {}));
    db.write(state);
    res.json(state[name][i]);
  });

  app.delete(`/api/${name}/:id`, (req, res) => {
    const state = db.read();
    const id = req.params.id;
    const before = state[name].length;
    state[name] = state[name].filter((x) => x.id !== id);
    if (name === "houses") {
      const tids = state.tenants.filter((t) => t.houseId === id).map((t) => t.id);
      state.tenants = state.tenants.filter((t) => t.houseId !== id);
      state.payments = state.payments.filter((p) => !tids.includes(p.tenantId));
      state.ebills = state.ebills.filter((e) => !tids.includes(e.tenantId));
    }
    if (name === "tenants") {
      state.payments = state.payments.filter((p) => p.tenantId !== id);
      state.ebills = state.ebills.filter((e) => e.tenantId !== id);
    }
    db.write(state);
    res.json({ removed: before - state[name].length });
  });
}
collections.forEach(mount);

app.post("/api/import", (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.tenants) && !Array.isArray(b.houses))
    return res.status(400).json({ error: "bad backup file" });
  const withId = (arr, clean) => (arr || []).map((x) => Object.assign({ id: x.id || db.uid() }, clean(x)));
  db.write({
    houses: withId(b.houses, cleanHouse),
    tenants: withId(b.tenants, cleanTenant),
    payments: withId(b.payments, cleanPayment),
    ebills: withId(b.ebills, cleanEbill),
  });
  res.json(db.read());
});

app.post("/api/wipe", (req, res) => {
  db.write({ houses: [], tenants: [], payments: [], ebills: [] });
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(FRONTEND, "index.html")));

app.listen(PORT, () => {
  console.log(`\n  🏠  Khata backend running`);
  console.log(`  →  Open http://localhost:${PORT}\n`);
});
