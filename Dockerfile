# Khata — Rent & Bijli manager
# Single container: backend (Express) serves the API + the frontend.
FROM node:20-alpine

WORKDIR /app

# install backend deps first (better layer caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# copy the rest of the app
COPY backend ./backend
COPY frontend ./frontend

ENV PORT=3000
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
