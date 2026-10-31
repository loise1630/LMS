# Numerical Methods - Learning Management & Assessment Portal
### Full-Stack Modular Course & Assessment System with Strict Progression Gating

A lightweight, self-contained educational web application implementing the whiteboard architecture specifically adapted for **Numerical Methods** with **Student ID-based authentication (`TUPT-23-1096`)** and **dynamic topic management**.

---

## 🎯 Whiteboard Mapping & Feature Compliance

| Whiteboard Item | Specification | Implementation in System |
| :--- | :--- | :--- |
| **1. Login & Register** | • No username — uses **Student ID / Faculty ID**<br>• Sample format hint: `TUPT-23-1096`<br>• Password & Role selection (Student/Faculty)<br>• Data Privacy (R.A. 10173) consent | • Direct login via ID Number (`TUPT-23-1096` / `TUPT-FAC-001`) + Password.<br>• Subtle sample format indicator (`Format: TUPT-YY-XXXX`).<br>• R.A. 10173 Privacy consent modal and registration validation.<br>• 1-Click quick evaluation logins for the panel. |
| **2. Subject Name** | • **Numerical Methods**<br>• Code, Term/Semester, Year Level | • Pre-configured as **Numerical Methods** (`MATH 313 / NUM-MET`).<br>• Displays in top header and official grade reports.<br>• Editable by faculty via "Subject Info". |
| **3. TOC (Table of Contents)** | • Dynamic list of topics: 1, 2, 3...<br>• Configurable by professor | • Topics count and order are **100% dynamic** based on what the professor adds or removes.<br>• Real-time progression locking: `Passed (≥75%)`, `Unlocked`, `Locked`, and `Failed`. |
| **4. Topic Module Content** | • Insert text (Lesson notes)<br>• Upload presentation (PDF/PPTX)<br>• Make your own inside (Slide deck)<br>• Summary | • 4 sub-views: Lecture Notes, Uploaded Deck (.pdf/.pptx), Built-in interactive slide deck with presentation controls, and Key Formulas/Summary.<br>• In-browser editing tools for faculty. |
| **5. Quiz Engine** | • 10-minute countdown timer<br>• 75% passing threshold<br>• **Strict rule:** *can't proceed to next topic if FAILED QUIZ - repeat topic*<br>• Insert text / Upload own / Make inside | • Live 10:00 timer with auto-submit.<br>• Gating logic: `< 75%` blocks access to next topic and instructs student to repeat the module; `≥ 75%` unlocks subsequent module.<br>• 3 creation modes: manual question input, bulk format parser, and question builder. |
| **6. Topic Quiz Summary** | • Print / PDF / Spreadsheet (CSV)<br>• Sorted by surname<br>• Sorted by score | • Table with 1-click sorting toggles (**Surname A-Z** / **Score High-to-Low**).<br>• Formatted print view with university header & instructor signature blocks.<br>• CSV spreadsheet download. |
| **7. Repeat for Other Topics** | • Scalable multi-topic engine | • Professor can add new Numerical Methods topics (e.g. Interpolation, Numerical Integration, Runge-Kutta) or delete topics dynamically. |
| **8. Master Summary of ALL Quiz Scores** | • Consolidated score per student<br>• Print / PDF / Spreadsheet | • Cross-topic gradebook matrix displaying scores across all active topics, total earned, overall percentage, and academic standing.<br>• Export to Print, PDF, and Spreadsheet (CSV). |

---

## 🚀 How to Run

Zero extra installation required (uses built-in Node.js runtime):

```powershell
npm start
# OR
node server.js
```

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
