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
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "16mb" })); // room for KYC/flat photos (base64)

// 🔒 Optional password protection (HTTP Basic Auth), OFF by default.
// Source of truth: AUTH_USER/AUTH_PASS env (Coolify) OR data/auth.json set from the app.
// Env, when present, wins and locks the in-app setter.
const AUTH_FILE = path.join(__dirname, "data", "auth.json");
function envLocked() { return !!(process.env.AUTH_USER && process.env.AUTH_PASS); }
function getAuth() {
  if (envLocked()) return { user: process.env.AUTH_USER, pass: process.env.AUTH_PASS };
  try { const a = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")); if (a && a.user && a.pass) return a; } catch (e) {}
  return null;
}
app.use((req, res, next) => {
  const auth = getAuth();
  if (!auth) return next();                       // no protection configured
  if (req.path === "/api/auth-status") return next(); // UI probe stays open
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (decoded.slice(0, i) === auth.user && decoded.slice(i + 1) === auth.pass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Khata"');
  return res.status(401).send("Khata: login required.");
});

// auth management — reachable only when currently unlocked (or after logging in)
app.get("/api/auth-status", (req, res) => res.json({ enabled: !!getAuth(), envLocked: envLocked() }));
app.post("/api/auth", (req, res) => {
  if (envLocked()) return res.status(400).json({ error: "Server env par password set hai — yahan se change nahi hoga." });
  const b = req.body || {};
  if (b.disable) { try { fs.unlinkSync(AUTH_FILE); } catch (e) {} return res.json({ enabled: false }); }
  const user = str(b.user, 60), pass = String(b.pass || "");
  if (!user || pass.length < 4) return res.status(400).json({ error: "Username + kam se kam 4 character ka password daalein." });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ user, pass }));
  res.json({ enabled: true });
});

const FRONTEND = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND));

const collections = ["houses", "tenants", "payments", "ebills", "motorbills"];

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v, n) { return String(v == null ? "" : v).slice(0, n); }
// data-URL image passthrough; drop anything oversized or non-image
function img(v) { v = String(v == null ? "" : v); return (v.startsWith("data:image/") && v.length <= 3500000) ? v : ""; }

function day1to31(v, def) { const n = Math.round(num(v)) || def; return Math.min(31, Math.max(1, n)); }
function cleanRentHist(a) { return Array.isArray(a) ? a.slice(-50).map((x) => ({ date: str(x.date, 10), from: num(x.from), to: num(x.to) })) : []; }
function cleanHouse(b) {
  return { name: str(b.name, 120), address: str(b.address, 220), note: str(b.note, 300),
    motorDueDay: day1to31(b.motorDueDay, 15) };
}
function cleanTenant(b) {
  // advance & security are tracked separately: agreed (kitna tay hua) vs paid (kitna mila)
  const securityAgreed = num(b.securityAgreed != null ? b.securityAgreed : b.deposit);
  return {
    houseId: str(b.houseId, 60),
    room: str(b.room, 120),
    name: str(b.name, 120),
    phone: str(b.phone, 40),
    fatherName: str(b.fatherName, 120),
    aadhaar: str(b.aadhaar, 20),
    permAddress: str(b.permAddress, 300),
    photo: img(b.photo),               // tenant/flat photo (data URL)
    aadhaarPhoto: img(b.aadhaarPhoto), // Aadhaar card scan (data URL)
    rent: num(b.rent),
    advanceAgreed: num(b.advanceAgreed),
    advancePaid: num(b.advancePaid),
    securityAgreed,
    securityPaid: num(b.securityPaid),
    deposit: num(b.deposit), // legacy — kept for old backups
    rentDueDay: day1to31(b.rentDueDay, 5),
    rentHistory: cleanRentHist(b.rentHistory),
    moveIn: str(b.moveIn, 7),
    status: b.status === "vacant" ? "vacant" : "occupied",
    note: str(b.note, 300),
  };
}
function cleanMotor(b) {
  // Common water-motor meter for a whole property. Consumption splits equally across flats.
  const prev = num(b.prev), curr = num(b.curr), rate = num(b.rate);
  const units = Math.max(0, curr - prev);
  const splitCount = Math.max(1, Math.round(num(b.splitCount)) || 1);
  const shareUnits = Math.round((units / splitCount) * 100) / 100;
  const shareAmount = Math.round(shareUnits * rate);
  const paid = {}, paidDate = {};
  if (b.paid && typeof b.paid === "object") {
    for (const k of Object.keys(b.paid)) {
      paid[str(k, 60)] = !!b.paid[k];
      if (b.paidDate && b.paidDate[k]) paidDate[str(k, 60)] = str(b.paidDate[k], 10);
    }
  }
  return {
    houseId: str(b.houseId, 60),
    month: str(b.month, 7),
    prev, curr, units, rate, splitCount, shareUnits, shareAmount,
    note: str(b.note, 300),
    paid, paidDate,
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
const cleaners = { houses: cleanHouse, tenants: cleanTenant, payments: cleanPayment, ebills: cleanEbill, motorbills: cleanMotor };

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
      state.motorbills = state.motorbills.filter((m) => m.houseId !== id);
    }
    if (name === "tenants") {
      state.payments = state.payments.filter((p) => p.tenantId !== id);
      state.ebills = state.ebills.filter((e) => e.tenantId !== id);
      // drop this tenant from any motor split paid-maps
      state.motorbills.forEach((m) => { if (m.paid) delete m.paid[id]; if (m.paidDate) delete m.paidDate[id]; });
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
    motorbills: withId(b.motorbills, cleanMotor),
  });
  res.json(db.read());
});

app.post("/api/wipe", (req, res) => {
  db.write({ houses: [], tenants: [], payments: [], ebills: [], motorbills: [] });
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(FRONTEND, "index.html")));

app.listen(PORT, () => {
  console.log(`\n  🏠  Khata backend running`);
  console.log(`  →  Open http://localhost:${PORT}\n`);
});
