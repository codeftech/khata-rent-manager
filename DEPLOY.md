# 🚀 Khata ko Coolify par live karna — baby steps

Ye app ek hi container me chalta hai (backend hi frontend serve karta hai).
GitHub par code chala jayega, phir Coolify usse build karke live kar dega.

---

## Part 1 — GitHub (ye maine kar diya ✅)
Aapka code yahan hai:
**https://github.com/codeftech/khata-rent-manager**

Aage koi change karo to bas ye 3 command:
```
git add .
git commit -m "my change"
git push
```

---

## Part 2 — Coolify par deploy (ye aap karenge, main guide kar raha hoon)

### Step 1 — New Resource
1. Coolify dashboard kholo.
2. Apna **Project** kholo (ya **+ New Project** banao).
3. **+ New Resource** / **+ Add** dabao.
4. **Public Repository** (agar repo public hai) ya **Private Repository (GitHub App)** chuno.

### Step 2 — Repo daalo
1. Repository URL me daalo:
   ```
   https://github.com/codeftech/khata-rent-manager
   ```
2. Branch: **main**
3. Coolify khud **Dockerfile** dhoond lega. Agar "Build Pack" pooche to **Dockerfile** chuno.

### Step 3 — Port set karo (zaroori)
1. Settings me **Port** / **Ports Exposes** field dhoondo.
2. Wahan likho: **3000**

### Step 4 — Data ko permanent banao (BAHUT zaroori) 🔒
Bina iske, har redeploy par aapka data (tenants, rent, bijli) **ud jayega**.
1. Resource ki **Storages** / **Persistent Storage** section me jao.
2. **+ Add** dabao aur ye daalo:
   - **Name:** `khata-data`
   - **Mount Path / Destination Path:** `/app/backend/data`
3. Save.

### Step 5 — Deploy
1. Upar **Deploy** button dabao.
2. Logs me "Khata backend running" aaye to samajh jao ho gaya ✅
3. Coolify ek **URL / Domain** dega — usse app khul jayegi.

### Step 6 — Domain (optional)
1. **Domains** me apna domain daal sakte ho (e.g. `khata.yoursite.com`).
2. Coolify khud HTTPS (SSL) laga dega.

---

## ⚠️ 2 important baatein
1. **Abhi login/password nahi hai** — jise bhi URL milega wo khol sakta hai.
   Public karne se pehle login lagwa lena (main laga dunga, bas bolna).
2. **Backup lete raho** — app ke andar ☁️ Backup tab se `.json` download karte raho.

---

## Baad me code badla to?
Apne PC par change karo, phir:
```
git add .
git commit -m "kya badla"
git push
```
Coolify me **Redeploy** dabao (ya auto-deploy on hai to khud ho jayega).
Data safe rahega kyunki humne persistent storage laga diya (Step 4).
