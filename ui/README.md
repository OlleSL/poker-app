# 🃏 Olle's Poker App

This is a solo side project I'm building to explore poker theory, data analysis, and hand visualization — all with a practical focus on MTT (Multi-Table Tournament) poker.

The app is meant to help players replay hands, analyze preflop decisions, and (eventually) understand strategic deviations using solver-based logic.

---

## ✨ Goals

- Build a clean, fast React UI for replaying hands
- Connect to a backend that handles preflop GTO/ICM analysis
- Create tools that help serious MTT players study more efficiently
- Lay the foundation for potential AI-driven player profiling

---

## 🛠 Tech Stack

- **Frontend:** React + Vite
- **Backend:** Python (FastAPI planned)
- **Database:** PostgreSQL
- **Dev Environment:** Docker + Docker Compose

---

## 🚧 Current Status

- ✅ Dockerized environment running
- ✅ Vite + Node frontend boots up
- ⏳ Preflop hand replayer UI in progress
- ⏳ Backend API structure planned
- ⏳ Data model for hand histories being developed

---

## 🚀 Getting Started

```bash
git clone git@github.com:OlleSL/poker-app.git
cd poker-app
docker-compose up --build
