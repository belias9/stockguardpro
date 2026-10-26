
---

## 📄 FILE 5: `docs/00-system-overview.md`

```markdown
# StockGuardPro — System Overview

## Purpose

Multi-branch stock control + workforce management for companies that move physical goods across locations.

## Three Dimensions

| Dimension | Description |
|---|---|
| **Company** | Multi-tenant. Isolated data per company. |
| **Branch** | Physical location. Store, warehouse, office, or mixed. |
| **Role + Function** | Employer, employee, and employee sub-functions. |

## Core Principles

- **Accountability first** — every action logged
- **Branch isolation** — each branch sees own data
- **Per-warehouse inventory** — every warehouse holds its own stock counts
- **Offline-first** — branches keep running without internet
- **Chain of approvals** — no single point of failure
- **Real-time** — Socket.IO pushes updates instantly

## Branches & Warehouses

**One branch can have many warehouses.**

Each warehouse tracks its own inventory independently:
- Same item code can exist in multiple warehouses with different quantities, prices, min levels
- Movements are per-warehouse
- Low stock alerts per-warehouse

## Receipt Flow

All items from all warehouses appear in one master receipt form with **location clearly marked per row**.

Seller picks items from any warehouse. System auto-generates withdrawals when items come from a different warehouse than the store.

## Stockhouse Transfers

- **Inter-warehouse transfer** — Manager approves only
- **Inter-branch transfer** — Manager approves only
- Stock personnel confirm dispatch and receipt but do NOT approve

## Roles

See `01-roles-and-permissions.md`.

## Workflows

See `02-workflows.md`.

## Segment Roadmap

See `03-segment-roadmap.md`.