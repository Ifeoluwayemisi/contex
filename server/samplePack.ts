export interface SampleDocument {
  filename: string;
  fileType: 'markdown' | 'txt' | 'pdf';
  content: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    filename: "react-19-production-deployment-guide.md",
    fileType: "markdown",
    content: `# Deploying React 19 Single Page Applications with Docker and Nginx
Published: October 14, 2026
Author: Engineering Infrastructure Team

## Overview
This production guide covers containerizing and deploying React 19 web applications using modern tooling.
Instead of running a Node.js runtime in production for static assets, we build the bundle using Vite and serve the resulting \`dist/\` artifacts using an optimized Alpine Nginx image.

## Multi-Stage Dockerfile Strategy
Stage 1 compiles the application:
\`\`\`dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build
\`\`\`

Stage 2 serves static assets:
\`\`\`dockerfile
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
\`\`\`

## Nginx Single Page Routing Fallback
Because client-side routers (React Router, TanStack Router) manipulate browser history, refreshing deep paths like \`/library/collections/web-dev\` will result in an HTTP 404 unless fallback routing is configured:

\`\`\`nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Caching immutable assets
    location ~* \\.(?:js|css|woff2?|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
\`\`\`

## Environment Variables
Client-side environment variables must be baked into the build using the \`VITE_\` prefix. Never place backend secrets or private keys in Vite build variables.`
  },
  {
    filename: "machine-learning-model-evaluation-and-metrics.txt",
    fileType: "txt",
    content: `RESEARCH NOTES: STATISTICAL EVALUATION OF MACHINE LEARNING MODELS
Date: September 28, 2026
Lab: Intelligent Systems Research Group

1. Classification Metrics Under Class Imbalance
When evaluating classifiers on highly skewed datasets (e.g. anomaly detection, rare disease screening where positive instances represent <1% of samples), standard classification Accuracy is fundamentally deceptive. A naive predictor predicting only the majority class achieves 99% accuracy while having zero utility.

Key alternative metrics:
- Precision: TP / (TP + FP). Measures the fidelity of positive predictions.
- Recall (Sensitivity): TP / (TP + FN). Measures the capture rate of true positives.
- F1 Score: Harmonic mean of precision and recall. Best when both false positives and false negatives carry equal weight.
- PR-AUC (Precision-Recall Area Under Curve): Strongly preferred over ROC-AUC when class distributions are severely unbalanced, because ROC-AUC can remain artificially high even when the true positive rate is low.

2. K-Fold Cross Validation Protocol
Always utilize Stratified K-Fold cross-validation with K=5 or K=10 to preserve proportional label distributions across folds.
For hyperparameter optimization, nest the cross-validation loops (outer loop for generalization estimate, inner loop for tuning) to prevent data leakage between evaluation and training sets.`
  },
  {
    filename: "oauth2-and-jwt-api-authentication-patterns.md",
    fileType: "markdown",
    content: `# Modern API Authentication: OAuth2 Authorization Code Flow and JWT Best Practices
Revision Date: August 12, 2026
Security Architecture Review

## Token Lifecycle and Architecture
Stateless authentication using JSON Web Tokens (JWT) requires careful separation between short-lived Access Tokens and long-lived Refresh Tokens.

### Access Token Characteristics:
- Lifespan: 10 to 15 minutes.
- Format: Signed cryptographic JWT containing claims: subject (\`sub\`), issued-at (\`iat\`), expiration (\`exp\`), and user roles (\`roles\`).
- Transmission: Provided by the client in the HTTP \`Authorization\` header as \`Bearer <token>\`.
- Validation: Server verifies the RSA-256 or EdDSA digital signature against the public key without querying the session database.

### Refresh Token Security:
- Lifespan: 7 to 30 days.
- Storage: Stored exclusively inside an \`HttpOnly\`, \`Secure\`, \`SameSite=Strict\` cookie.
- Vulnerability Defense: Storing tokens in browser \`localStorage\` exposes them to Cross-Site Scripting (XSS). An HttpOnly cookie prevents JavaScript access entirely.
- Refresh Token Rotation (RTR): Every time a refresh token is exchanged for a new access token, the auth server invalidates the old refresh token and issues a fresh one. If an invalidated refresh token is reused, the auth server triggers an immediate automatic compromise lockout across all active sessions.`
  },
  {
    filename: "2026-q3-systems-engineering-career-portfolio.txt",
    fileType: "txt",
    content: `PROFESSIONAL DOSSIER & CAREER PORTFOLIO
Candidate: Senior Distributed Systems & Cloud Infrastructure Engineer
Target Roles: Principal Platform Engineer, Lead DevOps Architect
Updated: October 2026

Summary:
Over 8 years experience architecting fault-tolerant cloud platforms, orchestrating Kubernetes microservices, and optimizing PostgreSQL database clusters.

Key Project Achievements:
- Scaled database query latency down 65% for a high-traffic fintech application by introducing pgBouncer connection pooling and replica read distribution.
- Designed automated CI/CD deployment pipelines using GitHub Actions, reducing release cycle time from 3 hours to 11 minutes.
- Maintained 99.99% service availability across multi-region AWS and Google Cloud workloads.

Certifications & Continuing Education:
- Google Cloud Certified Professional Cloud Architect (Renewed 2026)
- Certified Kubernetes Administrator (CKA)
- Linux Foundation Open-Source Contributor Award 2025

Compensation Expectations:
Base Target: $185,000 - $210,000 USD
Location Preference: Remote (Americas / EMEA timezones)`
  },
  {
    filename: "postgresql-replication-and-cloud-sql-backup-plan.md",
    fileType: "markdown",
    content: `# PostgreSQL Streaming Replication & Disaster Recovery Runbook
Date: July 05, 2026
Status: Active Standard Operating Procedure

## Primary-Replica Topology
Context: Ensuring zero data loss and automated failover for transactional persistence.
We implement asynchronous streaming replication using PostgreSQL Write-Ahead Logging (WAL).

### Key Configuration Directives:
\`\`\`ini
# postgresql.conf
wal_level = replica
max_wal_senders = 10
wal_keep_size = 4096MB
hot_standby = on
archive_mode = on
archive_command = 'pgbackrest --stanza=db_cluster archive-push %p'
\`\`\`

## Disaster Recovery Objectives (RPO and RTO)
- Recovery Point Objective (RPO): < 1 minute. Achieved via continuous WAL segment shipping to Google Cloud Storage.
- Recovery Time Objective (RTO): < 5 minutes. Handled by Patroni consensus orchestrator with automated VIP reassignment.

## Point-In-Time Recovery (PITR) Procedure
In the event of accidental table drops or malicious corruption, execute:
1. Stop the active postgres service.
2. Restore base backup snapshot using \`pgbackrest --stanza=db_cluster restore\`.
3. Set recovery target time: \`recovery_target_time = '2026-07-05 14:30:00 UTC'\`.
4. Start database in recovery mode and verify consistency before switching to read-write.`
  }
];
