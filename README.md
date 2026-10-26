# StockGuardPro

Multi-branch stock control and workforce management system for ambitious companies.

## What It Is

A complete platform for businesses that:
- Move physical goods across multiple branches and warehouses
- Need per-location inventory tracking
- Need accountability on money, stock, and attendance
- Need AI-driven insights and automated WhatsApp notifications

## System Purpose

- **Stock control** — what you have, where it is, who moved it, who approved it
- **Workforce management** — attendance, salary, communication
- **Branch accountability** — every stockhouse has its own inventory record
- **Offline-first** — branches keep running when internet drops

## Roles

- **Employer** — full company access (max 5 per company)
- **Manager** — branch authority (approvals, salaries, inventory mode)
- **Cashier** — money confirmation per branch
- **Stock** — inventory control per warehouse
- **Sales** — receipt creation
- **Shop Buyer** — external purchasing with pre-record workflow
- **None** — basic employee (attendance, salary, messages only)

Each role has its own pages. Each page lives in its own folder for easy maintenance.

## Tech Stack

**Backend**
- Node.js 18+
- Express
- MongoDB + Mongoose
- Socket.IO (real-time)
- OpenAI (AI features)
- Meta WhatsApp Cloud API
- JWT authentication

**Frontend**
- Vanilla JS (no framework)
- Modular CSS
- HTML partials
- Role-based routing
- Offline-first with sync

**Infrastructure**
- Docker + Nginx
- MongoDB Atlas (cloud) or local MongoDB (branch LAN)
- Local LAN server per branch for offline operation

## Project Structure

See `docs/00-system-overview.md` for the full architecture.

- `backend/` — Express API + services + models
- `frontend/` — Vanilla JS SPA with role-based pages
- `docs/` — Planning, workflows, decision log
- `scripts/` — Seed, backup, install helpers

## Development Setup

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local) or MongoDB Atlas (cloud)
- Git
- VS Code with Live Server extension

### Install

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values