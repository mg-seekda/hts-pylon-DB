# Product Requirements Document (PRD)

**HTS Dashboard – Pylon Integration**

---

## 1. Objective

The HTS (Hotel Technology Support) Dashboard will provide a unified view of support tickets and training tasks, enabling the team to manage workload, track KPIs, and plan trainings efficiently. The dashboard will replace the old Odoo-based dashboard and integrate directly with Pylon APIs, ensuring live data and consistency across systems.

---

## 2. Key Features

### 2.1 Global KPIs

* **Total Open Tickets** – All tickets with status ≠ *Closed*.
* **Tickets Created Today** – All tickets created on the current day.
* **On Hold Tickets** – All tickets currently in status *On Hold*.
* **Open >24h** – All tickets with status ≠ *Closed* and `created_at < now() - 24h`.

### 2.2 Ticket Assignment Table (per Agent)

* Rows = Agents (plus an **Unassigned** row).
* Columns = All current statuses in Pylon (discovered dynamically via API, excluding *Closed*).
* Additional column: **Closed (Today)** → tickets with `status=closed` and custom field `closed_at` = today.
* Clicking a number links directly to Pylon, showing the filtered ticket list.

### 2.3 Ticket Analyses (Global)

* **Daily Flow (Created vs Closed)** → Bar chart (last 14 days).
* **Oldest Open Tickets** → List of 10 oldest open tickets.
* **Average Resolution Time** → Average + median from `created_at` to `closed_at`.
* **Top Accounts with Open Tickets** → Ranking of top 5 hotels/accounts.

### 2.4 Training Tasks (Pylon Tasks)

* Represent trainings as **Tasks** linked to Accounts.
* **Open tasks** in status *Not Started* or *In Progress*.
* Grouped by **due date** and (if available) **Assignee**.
* Subsections:

  * **Today & Tomorrow**
  * **Future Tasks**
  * **Overdue Tasks**

---

## 3. Layout Structure

* **Header:** 4 KPI tiles (Total Open, Created Today, On Hold, Open >24h).
* **Main Area:**

  * Left: Ticket Assignment Table
  * Right: Analyses (Created vs Closed, Top Accounts, Oldest Tickets, Avg. Resolution)
* **Footer:** Training Section (Today/Tomorrow, Future, Overdue)

---

## 4. Tech Stack

* **Backend:** Node.js (Express), Axios, Day.js, optional Redis cache
* **Frontend:** React (TypeScript), TailwindCSS, Recharts, Framer Motion
* **Deployment:** Docker, Portainer, HTTPS via Let’s Encrypt
* **Auth:** Reverse Proxy with Apache + mod\_auth\_cas (CAS integration)

---

## 5. Authentication (Seekda SSO)

* Seekda uses **CAS (Central Authentication Service)**.
* Proxy validates tickets via:

  * `CASLoginURL: https://login.seekda.com/login`
  * `CASValidateURL: https://login.seekda.com/serviceValidate`
* Proxy injects `X-Remote-User` header; dashboard trusts it.
* For local development:

  * CAS demo server (Apereo CAS Docker)
  * or dev bypass mode (fixed username injection).

---

## 6. Design & UX

* **Theme:** Dark, modern design (dark mode as the default).
* **Visual Style:** Clean, minimalistic layout with high contrast, easy-to-read typography.
* **Animations:** Smooth micro-animations for state changes, hover effects, and transitions (implemented with Framer Motion).
* **Charts:** Minimalistic but elegant, using simple color palettes that fit dark mode.
* **Responsiveness:** Optimized for desktop use; should still be functional on tablets.
* **Consistency:** KPI cards, tables, and charts share a consistent design language.

---

## 7. Out of Scope

* SLA breach monitoring
* Category breakdown by custom fields
* Workload forecast

---

## 8. API References & Sample Responses

### 8.1 Issues – `GET /issues`

```json
{
  "data": [
    {
      "id": "iss_123",
      "title": "Example Ticket",
      "state": "on_hold",
      "assignee": { "id": "u_1", "email": "agent@example.com" },
      "account": { "id": "acc_1" },
      "created_at": "2025-09-01T09:30:00Z",
      "custom_fields": {
        "closed_at": { "slug": "closed_at", "value": "2025-09-02T14:15:00Z" }
      }
    }
  ]
}
```

### 8.2 Issues Search – `POST /issues/search`

```json
{
  "data": [
    {
      "id": "iss_124",
      "state": "closed",
      "assignee": { "id": "u_2", "email": "bob@example.com" },
      "created_at": "2025-09-01T08:00:00Z",
      "custom_fields": {
        "closed_at": { "slug": "closed_at", "value": "2025-09-02T12:00:00Z" }
      }
    }
  ]
}
```

### 8.3 Users – `GET /users`

```json
{
  "data": [
    {
      "id": "u_1",
      "name": "Alice Agent",
      "email": "alice@example.com",
      "status": "active"
    }
  ]
}
```

### 8.4 Tasks – `GET /tasks`

```json
{
  "data": {
    "id": "task_1",
    "title": "Training Session 10:00 - 12:00",
    "status": "not_started",
    "due_date": "2025-10-09",
    "account": { "id": "acc_99" },
    "assignee": { "user": { "id": "u_3", "email": "trainer@example.com" } }
  }
}
```

### 8.5 Issues Search Schema

**Request structure:**

```json
{
  "cursor": "text",
  "filter": {
    "field": "text",
    "operator": "equals",
    "subfilters": [],
    "value": "text",
    "values": ["text"]
  },
  "limit": 1
}
```

**Filterable fields:**

* `created_at` (RFC3339) → `time_is_after`, `time_is_before`, `time_range`
* `account_id` → `equals`, `in`, `not_in`
* `ticket_form_id` → `equals`, `in`, `not_in`
* `requester_id` → `equals`, `in`, `not_in`
* `follower_user_id` → `equals`, `in`, `not_in`
* `follower_contact_id` → `equals`, `in`, `not_in`
* `state` → `"new"`, `"waiting_on_you"`, `"waiting_on_customer"`, `"on_hold"`, `"closed"` or custom slug; operators: `equals`, `in`, `not_in`
* `custom fields` → by slug
* `tags` → `contains`, `does_not_contain`, `in`, `not_in`
* `title` → `string_contains`, `string_does_not_contain`
* `body_html` → `string_contains`, `string_does_not_contain`

---

## 9. Example Filters Used in Dashboard

### A) Closed (Today)

```json
{
  "limit": 200,
  "filter": {
    "operator": "and",
    "subfilters": [
      { "field": "state", "operator": "equals", "value": "closed" },
      {
        "field": "closed_at",
        "operator": "time_range",
        "values": ["2025-09-02T00:00:00+02:00", "2025-09-02T23:59:59+02:00"]
      }
    ]
  }
}
```

### B) Open Tickets (all statuses except closed)

```json
{
  "limit": 500,
  "filter": { "field": "state", "operator": "not_in", "values": ["closed"] }
}
```

### C) Tickets Created Today

```json
{
  "limit": 200,
  "filter": {
    "field": "created_at",
    "operator": "time_range",
    "values": ["2025-09-02T00:00:00+02:00", "2025-09-02T23:59:59+02:00"]
  }
}
```

### D) On Hold (total)

```json
{
  "limit": 200,
  "filter": { "field": "state", "operator": "equals", "value": "on_hold" }
}
```

### E) Open > 24h

```json
{
  "limit": 500,
  "filter": {
    "operator": "and",
    "subfilters": [
      { "field": "state", "operator": "not_in", "values": ["closed"] },
      {
        "field": "created_at",
        "operator": "time_is_before",
        "value": "2025-09-01T14:30:00+02:00"
      }
    ]
  }
}
```

### F) Narrow to an Account (optional)

```json
{
  "limit": 200,
  "filter": {
    "operator": "and",
    "subfilters": [
      { "field": "account_id", "operator": "equals", "value": "acc_123" },
      { "field": "state", "operator": "not_in", "values": ["closed"] }
    ]
  }
}
```

---

## 10. Next Steps

Set up local CAS proxy for dev testing.
