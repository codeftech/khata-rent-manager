/**
 * Tiny JSON-file database. No native modules — works everywhere, easy to deploy.
 * Data lives in ./data/db.json. Writes are atomic (temp file + rename).
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const TMP_FILE = path.join(DATA_DIR, "db.tmp.json");

const EMPTY = { houses: [], tenants: [], payments: [], ebills: [], motorbills: [] };

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
}

let cache = null;

function read() {
  if (cache) return cache;
  ensure();
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    cache = {
      houses: Array.isArray(data.houses) ? data.houses : [],
      tenants: Array.isArray(data.tenants) ? data.tenants : [],
      payments: Array.isArray(data.payments) ? data.payments : [],
      ebills: Array.isArray(data.ebills) ? data.ebills : [],
      motorbills: Array.isArray(data.motorbills) ? data.motorbills : [],
    };
  } catch (e) {
    console.error("DB read failed, starting empty:", e.message);
    cache = { houses: [], tenants: [], payments: [], ebills: [], motorbills: [] };
  }
  return cache;
}

function write(state) {
  ensure();
  cache = {
    houses: state.houses || [],
    tenants: state.tenants || [],
    payments: state.payments || [],
    ebills: state.ebills || [],
    motorbills: state.motorbills || [],
  };
  fs.writeFileSync(TMP_FILE, JSON.stringify(cache, null, 2));
  fs.renameSync(TMP_FILE, DB_FILE); // atomic swap
  return cache;
}

function uid() {
  return require("crypto").randomUUID();
}

module.exports = { read, write, uid };
