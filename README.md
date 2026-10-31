# System Administration and Maintenance - Learning Management & Assessment Portal
### Full-Stack Modular Course & Assessment System with Strict Progression Gating

A lightweight, self-contained educational web application for **System Administration and Maintenance**, with **Student ID-based authentication** and **dynamic topic management**.

---

## 🎯 Whiteboard Mapping & Feature Compliance

| Whiteboard Item | Specification | Implementation in System |
| :--- | :--- | :--- |
| **1. Login & Register** | • No username — uses **Student ID / Faculty ID**<br>• Sample format hint: `TUPT-23-1096`<br>• Password & Role selection (Student/Faculty)<br>• Data Privacy (R.A. 10173) consent | • Direct login via ID Number (`TUPT-23-1096` / `TUPT-FAC-001`) + Password.<br>• Subtle sample format indicator (`Format: TUPT-YY-XXXX`).<br>• R.A. 10173 Privacy consent modal and registration validation.<br>• 1-Click quick evaluation logins for the panel. |
| **2. Subject Name** | • **System Administration and Maintenance**<br>• Code, Term/Semester, Year Level | • Pre-configured as **System Administration and Maintenance** (`SYS-ADMIN`).<br>• Displays in top header and official grade reports.<br>• Editable by faculty via Settings. |
| **3. TOC (Table of Contents)** | • Dynamic list of topics: 1, 2, 3...<br>• Configurable by faculty | • Topic count and order are dynamic based on faculty uploads and deletions.<br>• Progression uses the admin-configured passing grade (default: 50%). |
| **4. Topic Module Content** | • Insert text (Lesson notes)<br>• Upload presentation (PDF/PPTX)<br>• Make your own inside (Slide deck)<br>• Summary | • 4 sub-views: Administration procedures, uploaded guides, interactive slide deck, and maintenance summary.<br>• In-browser editing tools for faculty. |
| **5. Quiz Engine** | • Configurable countdown timer and passing threshold<br>• **Strict rule:** students must pass before opening the next topic<br>• Upload or enter quiz questions | • Timer and passing grade are configurable by faculty; the default passing grade is 50%.<br>• Students who do not pass must retry before progression unlocks.<br>• Faculty can upload a quiz file or use questions generated from readable uploaded material. |
| **6. Topic Quiz Summary** | • Print / PDF / Spreadsheet (CSV)<br>• Sorted by surname<br>• Sorted by score | • Table with 1-click sorting toggles (**Surname A-Z** / **Score High-to-Low**).<br>• Formatted print view with university header & instructor signature blocks.<br>• CSV spreadsheet download. |
| **7. Repeat for Other Topics** | • Scalable multi-topic engine | • Faculty can add or delete topics such as operating systems, server management, network services, security, backup, and maintenance. |
| **8. Master Summary of ALL Quiz Scores** | • Consolidated score per student<br>• Print / PDF / Spreadsheet | • Cross-topic gradebook matrix displaying scores across all active topics, total earned, overall percentage, and academic standing.<br>• Export to Print, PDF, and Spreadsheet (CSV). |

---

## 🚀 How to Run

The server stores application data in a local PostgreSQL database. It can run without an internet connection once Node.js, the `pg` dependency, and PostgreSQL are installed on the computer.

```powershell
createdb itpe_portal
$env:DATABASE_URL = "postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/itpe_portal"
npm install
npm start
```

The first start creates the database table and imports existing `data/db.json` data into PostgreSQL. If no JSON data exists, demo data is created. Keep PostgreSQL running locally while using the app. Set `DATABASE_URL` to match the PostgreSQL username and password on your machine.

Open your browser at:
👉 **`http://localhost:3000`**

---

## 👥 Pre-configured Demo Accounts

| Role | ID Number (Login) | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Faculty (Teacher)** | `TUPT-FAC-001` | `faculty123` | Prof. Maria Santos. Can add, edit, or delete topics, upload slides, manage question banks, and export grade sheets. |
| **Student 1 (Passed)** | `TUPT-23-1096` | `student123` | Juan Dela Cruz. Passed Topics 1 & 2 (80% - 100%). Topic 3 is unlocked. |
| **Student 2 (Locked Demo)** | `TUPT-23-1098` | `student123` | Carlo Reyes. Scored 60% on Topic 1 (Failed, `< 75%`). Demonstrates progression lock — Topic 2 is locked until he reviews and passes Topic 1. |
| **Student 3 (Active)** | `TUPT-23-1097` | `student123` | Maria Carmela Alvarez. Active student progression. |
