# 🏠 Khata — Rent & Bijli Manager

Ek pyaara full-stack app: kiraayedaar (tenants), rent payments, aur bijli (electricity)
bills ka poora hisaab. **Backend + Frontend alag** hain, local par chalta hai, aur
server par deploy ho sakta hai.

```
RentManager/
├── backend/        Node + Express API + JSON database
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── data/db.json   (apne aap banega — yahan data save hota hai)
└── frontend/       Glassmorphism dashboard (HTML/CSS/JS)
    ├── index.html
    ├── style.css
    └── app.js
```

## ▶️ Local par kaise chalayein

1. Terminal / PowerShell kholein aur backend folder me jaayein:
   ```
   cd Desktop\RentManager\backend
   ```
2. Ek baar packages install karein:
   ```
   npm install
   ```
3. Server chalu karein:
   ```
   npm start
   ```
4. Browser me kholein 👉 **http://localhost:3000**

Bas! Backend hi frontend ko serve karta hai, isliye ek hi link par sab kuch chalega.
Data `backend/data/db.json` me save hota hai — server band karo tab bhi data safe rehta hai.

## ☁️ Server par live kaise karein (deploy)

Ye app kahin bhi chal jayega jahan Node.js ho (VPS, Render, Railway, etc.):

- Poora `RentManager` folder server par daalein.
- `cd backend && npm install && npm start`
- Host ka port env se aata hai: `PORT=8080 npm start` (ya host khud set karta hai).
- `backend/data/db.json` ko persistent rakhein taaki data na ude.

Agar frontend alag host par chahiye, to `frontend/app.js` me sabse upar
`const API = ""` ko apne backend URL se badal dein, e.g.
`const API = "https://your-backend.com"`.

## ✨ Features
- **Dashboard** — total rent, collected, baaki, bijli baaki, grand total, deposits
- **Rooms / Tenants** — add/edit/delete, rent + deposit + move-in
- **Rent payments** — history, filter, per-tenant ledger
- **⚡ Bijli** — meter reading se units + amount auto, paid/unpaid
- **Backup** — JSON backup/restore + rent & bijli CSV (Excel) export

## 🔒 Note
Abhi login/password nahi hai (personal use ke liye). Agar public server par
daal rahe hain aur security chahiye, to bata dena — login add kar denge.
