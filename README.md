# ContextKeeper

> **Your files remember, so you don't have to.**  
> *Find what you remember. Not just what you named.*

[![Live Demo](https://img.shields.io/badge/Demo-contextkeeper.ai.studio-amber?style=flat-square)](https://contextkeeper.ai.studio)
[![Runtime AI](https://img.shields.io/badge/Runtime%20Model-Google%20Gemma%204%2026B-blue?style=flat-square)](https://ai.google.dev/gemma)
[![License](https://img.shields.io/badge/License-Apache%202.0-stone?style=flat-square)](LICENSE)
[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest%202026-Open--Source%20AI%20Challenge-orange?style=flat-square)](https://hacktoberfest.com/)

ContextKeeper is an open-source, AI-powered personal knowledge library built for **Hacktoberfest 2026 (Open-Source AI Challenge, Week 3: Slow and Steady)**. It helps professionals, researchers, developers, and students retrieve documents from their personal collections using ordinary, natural-language recollections—even when they cannot remember the filename, exact folder, or precise wording.

**Published Application:** [https://contextkeeper.ai.studio](https://contextkeeper.ai.studio)

---

## Table of Contents

- [The Problem and the Solution](#the-problem-and-the-solution)
- [Key Features](#key-features)
  - [1. Document Ingestion & Local Folder Connection](#1-document-ingestion--local-folder-connection)
  - [2. Recall Mode & Deterministic Retrieval](#2-recall-mode--deterministic-retrieval)
  - [3. AI Document Understanding via Google Gemma](#3-ai-document-understanding-via-google-gemma)
  - [4. Evidence Verification & Source Attribution](#4-evidence-verification--source-attribution)
  - [5. Smart Collections & Library Management](#5-smart-collections--library-management)
  - [6. Genuine Authentication & User-Isolated History](#6-genuine-authentication--user-isolated-history)
- [System Architecture](#system-architecture)
- [Google Gemma Runtime Configuration](#google-gemma-runtime-configuration)
- [Privacy and Security Model](#privacy-and-security-model)
- [Technology Stack](#technology-stack)
- [Installation and Local Development](#installation-and-local-development)
- [Environment Variables](#environment-variables)
- [Automated Testing and Verification](#automated-testing-and-verification)
- [Current Limitations and Roadmap](#current-limitations-and-roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## The Problem and the Solution

### The Problem
Most personal document storage systems depend heavily on filenames, manual directory hierarchies, and rigid tag systems. However, human memory works associatively:
- People remember **what a document was about** ("that proposal discussing university ambassadors and acquisition budgets").
- People remember **distinct concepts, fragments, or timeframes** ("a runbook about replication lag from early 2026").
- People rarely remember opaque or generic filenames like `Acq_Final_v3_2026.pdf` or `notes-backup.md`.

When standard keyword search fails due to synonyms, grammatical differences, or partial memories, documents become functionally lost.

### The Solution
ContextKeeper bridges the gap between human recollection and document retrieval:
1. **Reads and extracts** text from local PDFs, Markdown notes, and TXT files.
2. **Generates deep metadata** using the open-weight **Google Gemma** model (concise summaries, topic tags, keywords, distinctive phrases, and date mentions).
3. **Decomposes natural-language recollections** in **Recall Mode**, separating confident search concepts from tentative, hedged memories ("possibly", "might have").
4. **Applies deterministic multi-tier ranking** across titles, summaries, keywords, phrases, and content without relying on opaque vector databases.
5. **Verifies evidence directly**, attributing snippets to exact PDF pages and validating quoted phrases against the source text.
6. **Protects source files**, keeping disk files strictly read-only and never modifying or deleting local user files.

---

## Key Features

### 1. Document Ingestion & Local Folder Connection
- **Supported File Formats:** Text-based PDF (`.pdf`), Markdown (`.md`, `.markdown`), and Plain Text (`.txt`).
- **Local Folder Connection:** Connect local directories directly using the browser's **File System Access API** (`window.showDirectoryPicker`), with an automated fallback to standard directory input pickers for unsupported browsers.
- **Batch Processing:** Upload multiple files at once (up to 50 files per batch, 15MB file size limit) via file picker or drag-and-drop.
- **Folder Rescan & Delta Detection:** An explicit **Rescan** action compares directory handles against stored records using content hashes (`SHA-256`) and modification timestamps:
  - Detects **new files** and indexes them.
  - Detects **modified files** and updates their summaries without creating duplicates.
  - Identifies **unchanged files** to bypass unnecessary re-indexing.
  - Flags **missing files** cleanly in the UI without deleting library history.
- **Zero-Modification Guarantee:** Source files on disk are strictly read-only. ContextKeeper never moves, renames, writes to, or deletes files on the host computer.

### 2. Recall Mode & Deterministic Retrieval
- **Natural-Language Recollections:** Users can describe what they remember in ordinary language (e.g., *"I remember a document about a business acquisition campaign that mentioned campus outreach and possibly had a budget section"*).
- **Intelligent Clue Extraction:** Breaks queries down into:
  - *Core Concepts:* High-confidence topics and entities.
  - *Uncertain Aspects:* Hedged recollections flagged as tentative.
  - *Possible Phrases:* Verbatim 2–4 word sequence probes.
  - *Time Clues:* Explicit years, quarters, and seasons.
  - *Document Type Hints:* Detected formats (e.g., proposal, runbook, tutorial).
- **Deterministic Multi-Tier Ranking:**
  - Evaluates candidate documents using transparent, deterministic scoring across title matches, distinctive phrases, topic overlap, summary alignment, and full-text keyword proximity.
  - No vector embeddings or opaque vector databases are required; retrieval logic is fully inspectable, deterministic, and predictable.
- **Honest Empty States:** If no document matches the recollection, ContextKeeper does not fabricate answers or invent matches. It presents an honest empty state with suggested alternative clues.

### 3. AI Document Understanding via Google Gemma
- **Runtime Model:** Google Gemma 4 26B instruction-tuned model (`gemma-4-26b-a4b-it`) hosted via the Google AI Studio REST API.
- **Structured Metadata Generation:**
  - **Summary:** A 2–3 sentence factual summary.
  - **Topics:** Overarching subject tags (e.g., `#DevOps`, `#PostgreSQL`, `#Recruitment`).
  - **Keywords:** 5–10 key entities, functions, and domain terms.
  - **Classification:** Document type (e.g., Tutorial, Runbook, Specification, Meeting Notes).
  - **Distinctive Phrases:** 3–5 memorable verbatim or near-verbatim phrases.
  - **Date Mentions:** Explicit dates found within the text.
  - **Suggested Collections:** Organizational grouping suggestions.
- **Zod Schema Validation:** All model outputs are strictly parsed and validated against Zod schemas. If the API returns invalid JSON or fails, the application automatically falls back to deterministic rule-based metadata extraction to ensure documents remain searchable.

### 4. Evidence Verification & Source Attribution
- **Verbatim Quote Verification:** When Gemma cites a direct quotation from a document, the server verifies whether the string exists verbatim in the extracted source text. Results are tagged with a `quoteVerified` flag and marked with visual badges.
- **Exact PDF Page Attribution:** For PDF documents, text is indexed with page boundary metadata, allowing search result excerpts to display the exact page number (`Page X`) where the text occurs.
- **Document Inspector:** A dedicated modal allows users to review the full extracted text with in-text search, inspect all AI metadata, and see contextual relationships with other documents in the library.

### 5. Smart Collections & Library Management
- **Automatic Smart Collections:** Automatically aggregates documents into suggested categories based on shared topics extracted by Gemma.
- **Custom Collections:** Users can create, rename, and manage custom collections.
- **In-App Delete Confirmation:** Replaces standard browser alerts with an accessible in-app confirmation modal (`DeleteConfirmationModal`). Removing an entry deletes the local IndexedDB record and search indices while leaving the original file on disk completely untouched.
- **Clean Library (Zero Demo Slop):** The application contains no seeded demo files or fake hardcoded search results. An automated startup migration (`cleanSeededDemoDocuments`) removes any legacy sample records, ensuring users only see their genuine documents.

### 6. Genuine Authentication & User-Isolated History
- **Self-Contained Authentication:**
  - Salted password hashing using Node.js native `crypto.scryptSync` with 16-byte cryptographically secure random salts.
  - Constant-time password verification using `crypto.timingSafeEqual` to eliminate timing attacks.
  - Cryptographically secure 256-bit session tokens (`crypto.randomBytes(32)`).
- **Strict User Isolation:**
  - Search history and saved search bookmarks are isolated by user account.
  - User A cannot view, retrieve, or delete User B's search history.
- **Protected Endpoints:** All history and saved search routes (`/api/history`, `/api/saved-searches`) are guarded with `requireAuth` middleware, returning HTTP 401 for unauthenticated requests.
- **Local vs. Account Boundary:** Document text and search indexes remain strictly local in the user's browser IndexedDB (`contextkeeper_db`), while search history and query bookmarks are securely tied to the user's account server-side (`server/data/auth_store.json`).

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT (Browser)                                │
│                                                                             │
│  React 19 SPA + Vite + Tailwind CSS v4                                      │
│  ├── File System Access API (Local Folder Connector & Delta Detector)       │
│  ├── Client-Side Text Extractor (PDF, Markdown, TXT)                       │
│  ├── Local Persistence Layer: IndexedDB (contextkeeper_db)                  │
│  │   ├── Documents Store (Extracted text, pages, Gemma metadata)           │
│  │   ├── Smart Collections Store                                            │
│  │   └── Sources Store (Directory handles, hashes, scan timestamps)         │
│  └── UI Views: Search, Recall Mode, Inspector, History, Collections        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON API (Bearer Auth Token)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Node.js / Express)                        │
│                                                                             │
│  ├── Middleware: Auth (Scrypt & Timing-Safe Token Auth), Multer (15MB Limit)│
│  ├── Endpoints:                                                             │
│  │   ├── POST /api/auth/signup & /api/auth/login                            │
│  │   ├── GET/POST/DELETE /api/history (User-Isolated History)               │
│  │   ├── GET/POST/DELETE /api/saved-searches (Bookmarked Queries)           │
│  │   ├── POST /api/upload-and-index (PDF parsing via pdf-parse)             │
│  │   ├── POST /api/index-document (Gemma metadata generation)                │
│  │   ├── POST /api/search (Recall Mode pipeline & ranking)                  │
│  │   ├── POST /api/related (Cross-document conceptual links)                │
│  │   └── GET /api/model-info (Runtime health & latency check)               │
│  ├── Data Storage: server/data/auth_store.json (Users, sessions, history)   │
│  └── Deterministic Fallback Engine (Rule-based clue extraction & scoring)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (Server-Side Only)
                                       │ GEMINI_API_KEY
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE AI STUDIO REST API                           │
│                                                                             │
│  Google Gemma 4 26B Instruction Tuned (gemma-4-26b-a4b-it)                 │
│  ├── Document understanding & summarization                                 │
│  ├── Recall Mode natural-language query interpretation                      │
│  └── Search candidate match explanations & relationship discovery           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Google Gemma Runtime Configuration

ContextKeeper strictly requires **Google Gemma** as its runtime language model. Gemini or other proprietary models are never substituted for core AI operations.

| Parameter | Current Value | Notes |
| :--- | :--- | :--- |
| **Primary Model ID** | `gemma-4-26b-a4b-it` | Gemma 4 26B instruction-tuned model. |
| **Fallback Candidate** | `gemma-4-31b-it` | Inspected during connectivity checks if primary is unavailable. |
| **Configurable Env Var** | `GEMMA_MODEL_ID` | Overrides the default model ID if configured in `.env`. |
| **Inference Provider** | Google AI Studio REST API | Initialized via `@google/genai` TypeScript SDK. |
| **Sampling Temperature** | `0.1` | Kept low for strict factual grounding and minimal hallucination. |
| **Context Window Cap** | `12,000` characters | Smart representative sampling (head/mid/tail) to prevent timeouts. |
| **Server-Side Isolation** | `server/gemma.ts` | The API key is never bundled into or transmitted to the client. |

### Hosted Inference & Data Transmission
ContextKeeper is a **hybrid local-first** application:
- **Local Storage:** Full document text, page breakdowns, and generated metadata are stored locally in the browser's IndexedDB.
- **Hosted Inference:** When a document is indexed or a search query is interpreted, extracted text samples (up to 12,000 characters) or query strings are sent over HTTPS to Google's hosted AI Studio inference endpoint. The application does not execute full model inference locally on consumer hardware.
- **Offline / Rate-Limit Resilience:** If Gemma inference is unreachable, times out, or encounters rate limits, ContextKeeper automatically falls back to deterministic rule-based algorithms for clue extraction, summarization, and ranking.

---

## Privacy and Security Model

- **Original Source Files Untouched:** Source files on the user's computer are read-only. Deleting a document or removing a folder from ContextKeeper only removes the database record from the browser; local files on disk are never altered, moved, or deleted.
- **Client-Side Persistence:** Document text and search indexes are persisted in the browser's IndexedDB (`contextkeeper_db`). Clearing browser data clears the local library.
- **Server-Side API Key Protection:** The Google AI Studio API key (`GEMINI_API_KEY`) is stored in server-side environment variables and is never exposed to the frontend.
- **Password Security:** Passwords are never stored in plaintext. They are salted with 16 bytes of random entropy and hashed using Node.js's native `crypto.scryptSync`. Comparisons are performed in constant time via `crypto.timingSafeEqual`.
- **Session Tokens:** Sessions use 256-bit cryptographic tokens passed via standard `Authorization: Bearer <token>` headers.
- **Zero Hallucination Retrieval:** Quotations suggested by the model are programmatically checked against the extracted document text before being marked as verified.

---

## Technology Stack

- **Frontend:**
  - React 19 (`react`, `react-dom`)
  - TypeScript
  - Vite 8
  - Tailwind CSS v4 (`@tailwindcss/vite`)
  - Lucide React (Icons)
  - Browser File System Access API & IndexedDB
- **Backend:**
  - Node.js (v20+ or v22+)
  - Express 4
  - Multer 2 (Batch multipart upload handling)
  - `pdf-parse` (PDF text extraction and page attribution)
  - Google GenAI SDK (`@google/genai`)
  - Zod 4 (Runtime schema validation)
  - Node.js `node:crypto` (Scrypt hashing and secure tokens)
- **Tooling & Testing:**
  - `tsx` (TypeScript Node execution)
  - Node.js native test assertions (`node:assert`)

---

## Installation and Local Development

### Prerequisites
- **Node.js:** `>= 20.0.0` (Node 22 recommended)
- **npm:** `>= 9.0.0`
- **Google AI Studio API Key:** A valid API key with access to Google Gemma models ([Get an API key](https://aistudio.google.com/)).

### 1. Clone the Repository
```bash
git clone <repository-url>
cd contextkeeper
```
*(Replace `<repository-url>` with your actual repository clone URL).*

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and provide your Google AI Studio API key:
```env
GEMINI_API_KEY="AIzaSy..."
```

### 4. Start the Development Server
```bash
npm run dev
```
The server will start on [http://localhost:3000](http://localhost:3000) using Express with Vite middlewares mounted.

### 5. Type-Check and Lint
```bash
npm run lint
```
*(Runs `tsc --noEmit` across the entire codebase).*

### 6. Run the Test Suite
```bash
npm test
```
*(Executes all unit and integration test suites).*

### 7. Production Build and Run
```bash
npm run build
npm start
```
`npm run build` compiles the React client into `dist/`. `npm start` launches the production Express server serving the static build and backend APIs on port 3000.

---

## Environment Variables

| Variable Name | Required? | Location | Description |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Server-only (`.env`) | Google AI Studio API key used to invoke Google Gemma models. |
| `APP_URL` | Optional | Server-only (`.env`) | Base URL for deployed environments (e.g. Cloud Run). |
| `GEMMA_MODEL_ID` | Optional | Server-only (`.env`) | Overrides the primary Gemma model ID (default: `gemma-4-26b-a4b-it`). |
| `PORT` | Optional | Server-only (`.env`) | HTTP server port (default: `3000`). |

> **Note:** Never commit `.env` to version control. `.gitignore` is preconfigured to exclude all `.env*` files except `.env.example`.

---

## Automated Testing and Verification

The project includes an automated test suite executed via `npm test`:

```bash
npm test
```

This runs three test files in sequence:

1. **Recall Mode & Ranking Tests (`tests/recall.test.ts`):**
   - *Test 1:* Vague query recollection clue extraction & scoring.
   - *Test 2:* Partial phrase queries matching indexed titles and phrases.
   - *Test 3:* Irrelevant queries returning honest empty states without manufactured matches.
   - *Test 4:* Evidence verification and exact PDF page attribution.
   - *Test 5:* Deterministic fallback behavior when AI inference is unavailable.
2. **Folder Connector & Rescan Tests (`tests/folder_connector.test.ts`):**
   - *Test 1:* Supported file extension filtering (`.pdf`, `.md`, `.txt`) and hidden file exclusion.
   - *Test 2:* Folder rescan delta detection (new, modified, unchanged, and missing files).
   - *Test 3:* Text extraction and clean metadata validation.
3. **Authentication & User Isolation Tests (`tests/auth_history.test.ts`):**
   - *Test 1:* User registration and scrypt password hashing.
   - *Test 2:* Duplicate email rejection.
   - *Test 3:* Credential verification and timing-safe password validation.
   - *Test 4:* Cryptographic session token generation, resolution, and revocation.
   - *Test 5:* Strict account search history isolation between multiple users.
   - *Test 6:* User history deletion boundary security.
   - *Test 7:* Saved searches bookmarking and account isolation.

---

## Current Limitations and Roadmap

### Current Limitations
- **Scanned PDFs (No OCR):** PDFs containing bitmap images without an embedded text layer cannot be read. OCR is not implemented in the current MVP.
- **Single-Host Account Store:** User accounts and search history are stored in `server/data/auth_store.json`. This is suitable for single-instance or personal hosting, but not distributed multi-region deployments.
- **Browser-Bound Library:** IndexedDB stores document text locally in the browser profile. Documents do not automatically sync across different physical devices unless imported on each device.

### Roadmap
- [ ] **Background Desktop Companion:** Native file system watcher daemon to monitor local folders in the background without keeping the browser tab open.
- [ ] **Client-Side WebAssembly OCR:** Local Tesseract.js / WebAssembly pipeline for extracting text from scanned documents.
- [ ] **Cloud Storage Connectors:** Authorized integrations with Google Drive, OneDrive, and Dropbox.
- [ ] **End-to-End Encrypted Cloud Sync:** Optional encrypted synchronization of IndexedDB libraries across personal devices.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork or clone the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Make your changes and verify with TypeScript check and tests:
   ```bash
   npm run lint
   npm test
   ```
4. Build the application to ensure clean compilation:
   ```bash
   npm run build
   ```
5. Commit your changes and submit a pull request describing your improvements.

---

## License

This project is licensed under the **Apache License 2.0**. See individual source file headers for license notices.

---

## Acknowledgements

- **Google Gemma:** Open-weight models providing fast, high-quality document intelligence and recollection interpretation.
- **Hacktoberfest 2026:** Open-Source AI Challenge (Week 3: Slow and Steady).
