# Enterprise Invoice Approval & Payment Tracking System

A production-ready Full-Stack application built to automate invoice processing workflows, enforce granular role-based access controls (RBAC), and secure sensitive vendor financial records using database-level field encryption.

---

## 🏗️ System Architecture & Workflow Engine

The platform implements an automated state machine that evaluates invoice metrics at the moment of ingestion to assign the appropriate compliance validation pipeline:

* **Standard Value Flow ($\le \$10,000$):** Automatically spins up exactly **one** approval node assigned to the target reviewer. Shifting to an `APPROVED` state requires a single confirmation signature.
* **High Value Flow ($> \$10,000$):** Dynamically enforces a strict, sequential **two-stage** signature chain requiring two distinct approvers. The invoice status remains pinned at `PENDING_APPROVAL` at Stage 1 and advances to `APPROVED` only when Stage 2 records a success token.

> ⚠️ **Global Workflow Override:** Any single absolute `REJECT` action recorded at any phase of the workflow instantly bypasses remaining nodes and short-circuits the target invoice status directly to `REJECTED`.

---

## 🔒 Security Architecture

### 1. Database-Level Cryptography (`vendors/models.py`)
Sensitive vendor financial records (`bank_account_details`) are protected using **symmetric key cryptography via Fernet (`cryptography.fernet.Fernet`)** before hitting the disk layer. 
* **Data Masking Pipeline:** Non-administrative data serialization pipelines dynamically intercept structural payloads to output masked credentials (e.g., `*********445`). Values are unmasked exclusively when the incoming token request is explicitly authorized under the `FINANCE_ADMIN` scope.

### 2. JWT Role-Based Access Control (RBAC)
Custom token claims are written into the token payload via `authentication/serializers.py` to embed structural application roles. Route access limits are guarded by explicit Django REST Framework permission classes:
* `IsSubmitter`: Authorized exclusively to generate new invoice records.
* `IsApprover`: Authorized exclusively to interact with pending workflow approval queues.
* `IsFinanceAdmin`: Authorized exclusively to access unmasked bank details and execute absolute `/pay/` endpoint commands.

---

## 🚀 Execution & Local Setup Guide

Because Docker composition constraints vary across host environments, this system features dedicated **Windows PowerShell** scripts to establish localized environments, resolve dependencies, and launch concurrent runtimes smoothly.

### Prerequisites
* Python 3.10+
* Node.js (v18+)

### 1. Spin Up the Backend API & DB
Open a PowerShell console and execute:
```powershell
.\run_backend.ps1