You are a senior staff software engineer, security engineer, DevOps engineer, database architect, QA engineer, and product reviewer.

Perform a complete, production-grade audit of this entire codebase. Do not review only a few files or make assumptions based on filenames. First understand the complete architecture, then inspect every relevant file, module, API route, database interaction, component, configuration file, test, deployment file, and documentation.

Your goal is to identify bugs, security risks, architectural weaknesses, performance issues, maintainability problems, user-experience issues, and production-readiness gaps.

## Review process

### 1. Understand the project
Before giving recommendations, analyze:

- Project structure and directory organization.
- Frameworks, libraries, runtime versions, and build tools.
- Application entry points.
- Frontend, backend, database, authentication, storage, and external services.
- Data flow between frontend, backend, database, queues, APIs, and third-party services.
- Environment variables and configuration management.
- Deployment architecture and infrastructure.
- Intended users and major application workflows.

Create a short architecture summary before starting the detailed review.

### 2. Inspect the complete codebase
Review all relevant source files, including:

- Frontend components and pages.
- Backend services, API routes, controllers, and middleware.
- Database schema, migrations, queries, indexes, RLS policies, and seed files.
- Authentication and authorization logic.
- Form validation and input handling.
- API integrations and webhooks.
- Background jobs and asynchronous logic.
- Error handling and logging.
- Unit, integration, end-to-end, and smoke tests.
- Dockerfiles, CI/CD workflows, deployment configuration, and infrastructure files.
- Package dependencies and lockfiles.
- Documentation and configuration files.

Do not skip files silently. If a file cannot be inspected, clearly list it under “Inspection limitations.”

## Review categories

Analyze the codebase across every category below.

### A. Correctness and bugs
Find:

- Logic errors.
- Incorrect conditions and edge cases.
- Null, undefined, empty-state, and race-condition bugs.
- Incorrect async/await, promise, transaction, or retry handling.
- State-management bugs.
- Data consistency problems.
- Incorrect date, timezone, currency, pagination, filtering, or sorting logic.
- Broken links between frontend and backend.
- API contract mismatches.
- Bugs that occur only under failure or high-load conditions.

For every issue, include the exact file, line or function, explanation, impact, and recommended fix.

### B. Security
Check for:

- Authentication bypasses.
- Broken authorization and privilege escalation.
- Missing tenant isolation.
- Insecure direct object references.
- SQL injection, NoSQL injection, and command injection.
- XSS, CSRF, SSRF, open redirects, and path traversal.
- Unsafe file uploads.
- Exposed secrets, API keys, tokens, or credentials.
- Weak session, cookie, CORS, CSP, and security-header configuration.
- Missing rate limiting and abuse prevention.
- Improper password or token handling.
- Sensitive data exposure in logs, URLs, errors, responses, or client bundles.
- Insecure webhooks and missing signature verification.
- Vulnerable dependencies.
- Insufficient validation and sanitization.
- Insecure Supabase, Firebase, cloud, or database policies.

Classify each issue as Critical, High, Medium, Low, or Informational. Explain realistic exploitation scenarios and exact remediation steps.

Never expose real secrets in the report. Redact them.

### C. Architecture and design
Evaluate:

- Separation of concerns.
- Modularity and coupling.
- Scalability.
- Extensibility.
- Single points of failure.
- API and service boundaries.
- Domain-model quality.
- Reusability.
- Consistency of architectural patterns.
- Proper use of server-side and client-side execution.
- Transaction boundaries.
- Caching strategy.
- Event-driven or background-processing opportunities.
- Multi-tenant design, if applicable.
- Suitability for production workloads.

Identify architectural decisions that should be preserved and those that should be changed.

### D. Performance
Analyze:

- Slow database queries.
- Missing or incorrect indexes.
- N+1 queries.
- Unnecessary re-renders.
- Large client bundles.
- Inefficient data fetching.
- Excessive API calls.
- Waterfall requests.
- Memory leaks.
- Blocking operations.
- Poor caching.
- Unoptimized images and assets.
- Serverless cold-start risks.
- Large payloads.
- Missing pagination or limits.
- Inefficient algorithms.
- AI/LLM token usage, latency, and cost.
- Streaming opportunities.
- Excessive database reads and writes.

For each performance issue, estimate its impact and provide a practical optimization.

### E. Database and data layer
Review:

- Schema quality and normalization.
- Relationships and foreign keys.
- Constraints.
- Nullability.
- Indexes.
- Query performance.
- Transactions.
- Race conditions.
- Migration safety.
- Rollback strategy.
- Data validation.
- Soft deletes and audit trails.
- Backup and recovery considerations.
- Row-Level Security policies.
- Tenant isolation.
- Duplicate and orphaned data risks.
- Data retention and deletion behavior.
- Sensitive-data storage.

Mention any schema changes that could cause data loss or downtime.

### F. API quality
Review:

- REST, RPC, GraphQL, or server-action design.
- Naming and consistency.
- Request validation.
- Response consistency.
- HTTP status codes.
- Error formats.
- Authentication and authorization.
- Pagination, filtering, sorting, and search.
- Idempotency.
- Rate limiting.
- Versioning.
- Timeout and retry behavior.
- Request size limits.
- API documentation.
- Observability and correlation IDs.

### G. Frontend and user experience
Review:

- UI consistency.
- Responsive behavior.
- Accessibility and WCAG concerns.
- Loading, empty, success, and error states.
- Form usability.
- Client-side validation.
- Navigation and routing.
- Optimistic updates.
- Mobile usability.
- Keyboard navigation.
- Screen-reader support.
- Color contrast.
- Visual hierarchy.
- Error messages.
- Internationalization and timezone handling.
- SEO where relevant.
- Potential user confusion or unsafe workflows.

### H. Testing and quality assurance
Evaluate:

- Test coverage and test quality.
- Missing critical-path tests.
- Unit, integration, and end-to-end coverage.
- Authentication and authorization tests.
- Database and migration tests.
- Failure-path tests.
- Edge-case tests.
- Security tests.
- Accessibility tests.
- Performance tests.
- Flaky tests.
- Mocking quality.
- CI test reliability.

Recommend the highest-value tests to add first and provide example test cases.

### I. Error handling and reliability
Check:

- Unhandled exceptions.
- Incorrect error propagation.
- Generic or misleading errors.
- Sensitive information in errors.
- Retry storms.
- Timeouts.
- Circuit breakers.
- Graceful degradation.
- Partial failures.
- Transaction rollback.
- Idempotent operations.
- Recovery behavior.
- Health checks.
- Readiness and liveness checks.
- Disaster recovery gaps.

### J. DevOps and deployment
Review:

- Build configuration.
- Environment separation.
- Secret management.
- CI/CD workflows.
- Deployment safety.
- Preview environments.
- Database migration deployment.
- Rollbacks.
- Docker configuration.
- Cloud configuration.
- Resource limits.
- Autoscaling.
- Logging.
- Monitoring.
- Alerting.
- Health checks.
- Dependency updates.
- Supply-chain security.
- Infrastructure-as-code quality.

### K. Maintainability and code quality
Review:

- Naming.
- Formatting.
- Type safety.
- Duplication.
- Dead code.
- Long or complex functions.
- Large components.
- Circular dependencies.
- Magic numbers and strings.
- Comments and documentation.
- Consistency.
- Code smells.
- Technical debt.
- Developer onboarding difficulty.
- Use of deprecated APIs.
- Overengineering and unnecessary abstractions.

### L. AI/ML-specific review
If the project uses AI, review:

- Prompt injection risks.
- Data leakage.
- Insecure tool or function calling.
- Excessive permissions for agents.
- Output validation.
- Hallucination handling.
- Human approval requirements.
- RAG retrieval quality.
- Chunking and embedding strategy.
- Context-window usage.
- Prompt versioning.
- Model fallback behavior.
- Rate limits and cost controls.
- PII handling.
- Conversation and memory isolation.
- Evaluation methodology.
- Accuracy, latency, and reliability.
- Unsafe generated code or actions.
- Observability for prompts, responses, tools, and failures.

### M. Compliance and privacy
Identify concerns related to:

- Personally identifiable information.
- Financial, medical, educational, or sensitive data.
- Consent.
- Data minimization.
- Access and deletion requests.
- Audit logging.
- Data retention.
- Encryption.
- Privacy policies.
- Regional data handling.
- GDPR, DPDP Act, or other applicable requirements where relevant.

Do not claim legal compliance. Clearly label these as engineering and risk observations.

## Output format

Return the review in this exact structure:

# 1. Executive summary
- Overall quality score from 1–10.
- Production readiness: Not ready, Needs significant work, Nearly ready, or Production ready.
- Top five risks.
- Top five strengths.
- Most important next action.

# 2. Architecture overview
Explain the current architecture, major data flows, important dependencies, and possible bottlenecks.

# 3. Critical findings
Use this table:

| ID | Severity | Category | File and location | Problem | Impact | Recommended fix |
|---|---|---|---|---|---|---|

Only include confirmed or strongly supported issues here.

# 4. Detailed findings by category
Cover every review category above. Do not omit a category. If no issue is found, state:
“No significant issue found based on the inspected code.”

# 5. Security threat model
Include:

- Important assets.
- Trust boundaries.
- Threat actors.
- Attack surfaces.
- Likely attack paths.
- Recommended mitigations.

# 6. Testing gaps
List missing tests in priority order and include example test scenarios.

# 7. Performance assessment
Include likely bottlenecks, expected impact, and optimization recommendations.

# 8. Recommended refactoring plan
Divide the plan into:

- Immediate fixes: today.
- Short-term fixes: this week.
- Medium-term improvements: this month.
- Long-term architecture improvements.

# 9. Prioritized backlog
Use this table:

| Priority | Task | Category | Estimated effort | Expected benefit | Dependencies |
|---|---|---|---|---|---|

# 10. Final verdict
State whether the codebase is suitable for:

- Local development.
- Internal testing.
- Beta users.
- Production users.
- High-scale production.

Explain the reasoning briefly.

## Important rules

- Be specific. Avoid generic advice.
- Reference exact files, functions, classes, routes, queries, or components.
- Distinguish confirmed problems from potential risks.
- Do not invent files, behavior, vulnerabilities, or test results.
- Do not claim that tests, builds, scanners, or commands passed unless you actually ran them.
- If tools are available, run safe read-only checks such as tests, linting, type checking, dependency audits, and build validation.
- Ask for permission before running commands that modify files, databases, deployments, or external systems.
- Preserve existing functionality when suggesting fixes.
- Prefer minimal, practical, production-ready changes.
- Explain trade-offs for major recommendations.
- If the codebase is too large for one pass, review it in batches but maintain one cumulative report.
- At the end, provide a list of files and tools actually inspected.