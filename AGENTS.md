# Workspace Audit and Engineering Standards

Apply these instructions to the entire repository, including the frontend, backend, worker, database migrations, deployment and build configuration, scripts, and documentation that describes application behavior. The goal is a strict, evidence-based audit suitable for preparing this application for production.

## Audit standard

- Review the implementation as a security-sensitive, production application. Do not assume that a feature is safe because it works in the UI, because a route is hidden, or because a comment or document says it is secure. Trace untrusted input through the frontend, API, authorization layer, database, worker, and output wherever relevant.
- Report only findings supported by concrete evidence in this repository. For each finding, identify the affected file and location, explain a realistic impact and conditions, assign a severity, and recommend a specific remediation. Distinguish confirmed vulnerabilities from risks, missing evidence, and optional improvements. Do not invent findings or claim the audit proves the absence of vulnerabilities.
- Prioritize exploitable security defects and data loss/corruption risks, then correctness and reliability defects, production-readiness gaps, and maintainability issues. Include lower-severity issues when they are actionable; do not hide a real issue merely because it is inconvenient to fix.
- Inspect the whole workspace, not only the files changed most recently. Follow routes, middleware, services, repositories, migrations, jobs, frontend callers, and configuration to understand actual behavior. Check that API documentation and user-facing behavior agree with the implementation.

## Security and privacy

- Verify authentication and authorization on every sensitive server-side operation. Check role enforcement, organization and booth scoping, object ownership, active assignments, revocation and expiry behavior, and protection against IDOR, privilege escalation, replay, and self-approval. UI route guards are not security boundaries.
- Check all inputs at trust boundaries, including request bodies, query parameters, path parameters, uploaded files, CSV contents, environment configuration, and data consumed by background jobs. Use parameterized database queries and safe output handling; check for injection, path traversal, unsafe redirects, mass assignment, and validation gaps.
- Review session and token handling, password storage and reset/change flows, cookie flags, CSRF protections, CORS, rate limits, error responses, and secret handling. Never expose credentials, tokens, sensitive personal data, stack traces, or internal infrastructure details in logs or responses.
- Treat household, voter, citizen, complaint, and attachment data as sensitive. Check data minimization, access boundaries, exports, retention/deletion behavior, masking, cache behavior, file access, and whether sensitive data can leak across users, booths, organizations, or logs.
- Review upload and import/export processing for content validation, size and resource limits, formula injection, duplicate handling, safe storage, authorization at processing time, and cleanup/expiry. Check worker retry, idempotency, locking, and failure behavior.
- Do not weaken authorization, validation, cryptography, security headers, or tests to make a check pass. Do not recommend client-side-only protection for server-side data.

## Production quality and maintainability

- Expect production-level error handling, transactional consistency, concurrency safety, bounded resource use, resilient background processing, secure defaults, operational visibility, and deployment configuration that fails safely. Identify assumptions that are undocumented or unsafe for production.
- Prefer clear, cohesive modules with responsibilities that fit the project. Identify both needless fragmentation and oversized/mixed-responsibility modules. Remove or flag duplicated logic, redundant state, unreachable branches, unused exports/dependencies, dead code, stale comments, and documentation that no longer matches behavior.
- Avoid lazy shortcuts, silent failure, placeholder behavior presented as completed functionality, broad exception swallowing, unsafe type coercion, arbitrary magic values, and duplicated authorization or validation rules. Recommend a focused abstraction only when it reduces real complexity or risk.
- Identify deprecated, obsolete, unsupported, or unsafe APIs and dependencies using repository evidence and authoritative package/runtime documentation where needed. Do not suggest upgrades blindly; consider compatibility, support status, security advisories, and migration impact.
- Check accessibility, responsive behavior, loading/error/empty states, and API error handling where they affect correctness or expose misleading behavior. Ensure role-specific screens call endpoints intended for that role.
- Keep fixes minimal, maintainable, and consistent with existing project conventions. Do not perform broad rewrites or change product behavior without a clear reason. Preserve backward compatibility where appropriate and document any necessary behavior change.

## Verification and reporting

- Inspect existing tests and run the relevant available checks for the areas reviewed when the environment permits. Prefer focused checks first, then the project build and relevant test suites. Do not point database-backed tests at production or real citizen data; use a dedicated synthetic test database only.
- Add or recommend regression coverage for confirmed defects, especially authorization boundaries, cross-booth access, role-specific routes, input validation, and data lifecycle behavior. Report checks that could not run and the exact blocker; never imply a check passed when it did not.
- For any proposed or applied fix, explain the root cause, affected behavior, and verification performed. Recheck related callers and permissions so that a local fix does not create a different vulnerability or role regression.
- Present audit results first, ordered by severity, with concise evidence and remediation. Then list material production-readiness gaps, verification performed, and any limits of the review. If no findings are confirmed, state that clearly while still listing meaningful coverage and limitations.

## Product and engineering requirements

These requirements apply across the entire application. Treat them as explicit product and production-readiness goals; verify them against the actual architecture and implementation rather than assuming they are already satisfied.

### Concurrent use and database correctness

- Design and verify the application to support at least 100 concurrent users actively interacting with the application and database under a documented, realistic workload.
- Do not treat “100 users” as proof of capacity by itself. Identify likely request patterns, expensive operations, data sizes, and bottlenecks; define measurable latency, throughput, error-rate, and resource-use targets appropriate to the application.
- Inspect database connection pooling and limits, query efficiency, indexes, transaction boundaries, isolation levels, locking, race conditions, deadlocks, and connection/resource cleanup.
- Protect writes and multi-step operations against lost updates, duplicate submissions, partial writes, inconsistent state, and concurrent requests that could bypass business rules. Use transactions, constraints, idempotency, optimistic/pessimistic locking, or queues where appropriate to the existing stack and operation.
- Check pagination and bounded result sizes for list/search endpoints. Avoid unbounded queries, N+1 access patterns, unnecessary repeated requests, blocking work on request paths, and expensive work on every render or click.
- Add or recommend repeatable load and concurrency tests using synthetic data and a non-production environment. Exercise concurrent reads and writes, authentication/authorization boundaries, failure/retry behavior, and data consistency. Report the tested workload, environment, metrics, failures, and limitations. Do not claim support for 100 concurrent users until appropriate tests provide evidence.
- Do not add caching, queues, indexes, connection pools, or other infrastructure blindly. Confirm the need, preserve correctness and authorization boundaries, and document operational trade-offs.

### Authentication, authorization, and navigation

- Aim for robust, defense-in-depth authentication and authorization across all supported roles and user journeys. Never describe security as “perfect” or guaranteed; demonstrate it with implementation evidence, negative tests, and clear limitations.
- Enforce permissions on the server for every protected operation. Validate identity, role, ownership, tenant/organization/booth scope, active assignment, and resource state as applicable. Treat client-side route guards and hidden controls as usability measures, not security controls.
- Verify login, logout, session expiry, token refresh/revocation, password recovery or other account-recovery flows, unauthorized access, forbidden access, and direct navigation to protected URLs. Ensure redirects do not create open redirects or loops.
- Ensure navigation is coherent and predictable: each visible navigation item leads to the correct destination for the current role; browser back/forward, refresh, deep links, expired sessions, empty states, and not-found routes behave correctly. Do not expose links or actions the user cannot use, and do not rely on hiding them to enforce permissions.
- Check for IDOR, privilege escalation, cross-user or cross-organization data exposure, insecure direct API calls, CSRF, unsafe CORS, brute-force/credential-stuffing exposure, and missing rate limits where relevant to the stack and threat model.
- Keep authorization checks consistent across frontend routes, API endpoints, background jobs, exports, file downloads, and database access. Re-check authorization when queued work executes, not only when it is submitted.
- Add positive and negative tests for each important role and permission boundary, including attempts to access another user's or organization's resources and attempts made with expired or revoked credentials.

### Performance and responsiveness

- Keep initial page load, route transitions, API requests, database operations, and button interactions responsive under normal and tested peak workloads. Establish measurable budgets where feasible and report the actual measurements rather than promising that the application will never lag.
- Trace slow interactions end to end across browser rendering, network calls, server processing, database queries, and worker tasks. Fix evidenced bottlenecks instead of applying speculative optimizations.
- Avoid duplicate API calls, unnecessary component renders, repeated expensive calculations, synchronous/blocking work on critical paths, oversized payloads, unbounded lists, and unnecessary assets or dependencies.
- Use pagination, filtering, lazy loading, batching, caching, background jobs, or debouncing only where appropriate and safe. Ensure caches are correctly scoped and cannot leak private or role-specific data; ensure asynchronous work has cancellation, timeout, retry, and error behavior appropriate to the operation.
- Provide immediate, accessible feedback for actions that take time: loading/pending states, disabled duplicate-submit controls where appropriate, success confirmation, actionable error messages, and empty states. Do not mask failures as success or leave controls appearing frozen.
- Measure performance before and after material changes where the environment allows. Include relevant browser/network traces, API timings, query plans, or load-test metrics when useful. Report checks that could not be run.

### Professional user interface and writing

- Use clear, professional, user-friendly language appropriate for an official production application. Ensure all visible strings have correct grammar, spelling, capitalization, punctuation, and consistent terminology.
- Review page titles, navigation labels, button text, form labels, helper text, validation messages, confirmation dialogs, notifications, empty states, loading states, errors, accessibility labels, and system-generated messages.
- Prefer concise, specific instructions that explain what happened and what the user can do next. Avoid vague messages such as “Something went wrong” when a safe, actionable explanation is available. Never expose stack traces, secrets, internal identifiers, or sensitive implementation details to users.
- Use consistent terminology for the same entity and action throughout the product. Make destructive, irreversible, or security-sensitive actions explicit and provide confirmation or recovery where appropriate.
- Ensure controls have clear names and states, forms are keyboard accessible, focus is managed sensibly after navigation and errors, color is not the only signal, and responsive layouts remain usable on supported screen sizes.
- Do not change legally or operationally significant wording, consent language, or policy text casually. Flag ambiguity for confirmation rather than inventing official policy.

## Codex implementation and Qodo independent-review workflow

### Responsibilities

- Codex is the primary implementation agent. It is responsible for planning, writing and modifying application code, debugging, running tests, and applying fixes explicitly approved by the user.
- Qodo is the independent code-quality and security reviewer. Use the installed Qodo Agentic Toolbox skills when available; do not treat a Codex-only analysis as a Qodo review.
- Use `qodo-codebase-wisdom` to understand relevant architecture, dependencies, repository context, and likely change impact before significant work. Use the installed Qodo standards/rules skill when applicable. Use `qodo-review` to review supported local changes after implementation and tests.
- `qodo-review` is change-focused. Do not claim it has audited every unchanged file or completed a repository-wide audit. For a full audit, inspect the repository in explicit batches and track coverage and findings across them.

### Required development loop

1. Understand the request, inspect the affected code and callers, identify security and data-integrity implications, and consult relevant Qodo codebase context and standards when available.
2. Plan a small, reviewable implementation. Preserve existing behavior and compatibility unless a justified change is required.
3. Implement the change and add/update focused tests. Do not weaken security controls or tests to make the implementation pass.
4. Run relevant tests and checks. Report exact commands and results; never claim success for checks that did not run.
5. Before presenting the work as complete or recommending it for merge/deployment, invoke Qodo's `qodo-review` on the supported local changes. Request findings for correctness, security, authorization, concurrency/data integrity, performance, requirement gaps, and standards violations.
6. Present Qodo findings with severity, file/line references, evidence, impact, and proposed remediation. Distinguish confirmed defects from potential risks and false positives.
7. Do not automatically run `qodo-review-resolver` or let Qodo modify code as part of the review-only workflow. The user decides which findings to fix. Codex applies only the fixes the user approves.
8. Re-run relevant tests and Qodo review after approved fixes. Review the final diff and report unresolved findings and limitations before calling the work complete.
9. If Qodo is unavailable, the skill is missing, authentication fails, or the review does not complete, state plainly that the Qodo review did not run and why. Do not silently substitute Codex's own analysis, claim independent review, or mark the review gate as passed.
10. Do not commit, push, merge, deploy, or perform destructive data operations without explicit user authorization.

### Qodo authentication and command execution

- Use the installed Qodo CLI and the exact commands specified by the installed Qodo skill. Do not invoke the discontinued `@qodo/command` package as a replacement for the current Agentic Toolbox.
- If a Qodo skill's read-only identity check returns `not_logged_in` while a normal terminal identity check succeeds, do not assume the user is logged out and do not immediately repeat browser login.
- When appropriate, retry the exact read-only identity command through the host's normal command-approval flow so it can access the user's existing credential store. Do not bypass sandboxing, disable security controls, broaden permissions unnecessarily, print secrets, or copy tokens into project files.
- Reuse a successful identity-check result only within the same executable, workspace, deployment, and execution context as permitted by Qodo's instructions. If the context changes or a later protected operation fails, perform the documented diagnostic again rather than claiming stale authentication is valid.
- Stop if the approved read-only check fails. Report the exact error and ask for the next diagnostic; do not run login, modify configuration, or perform a review without authorization and a clear reason.

### Mandatory Qodo Invocation — No Exceptions for Code Changes

- Qodo review is mandatory for every task that creates, modifies, refactors, or fixes application code, configuration, database migrations, tests, or security-sensitive behavior.
- After implementation, invoke the installed `qodo-review` skill to review the resulting changes before reporting the task as complete.
- When the user explicitly requests an audit, security review, quality check, or code review, invoke Qodo's review workflow even if no code changes are planned. Use the appropriate supported Qodo workflow for the requested scope.
- For existing-codebase audits, use Qodo's codebase intelligence and review capabilities in manageable batches. Do not treat a local-change review as a complete repository audit.
- Before significant implementation, use relevant Qodo codebase-context and standards skills when available.
- After applying approved review findings, rerun relevant tests and Qodo review.
- Do not silently skip Qodo because Codex believes its own review is sufficient.
- If Qodo cannot be invoked, authentication fails, the review returns an error, or the required review scope is unsupported, stop before declaring the work complete. Report exactly what succeeded, what failed, and what remains unreviewed.
- Never fabricate a Qodo invocation, findings, or successful review. Do not automatically accept or apply findings without the user's authorization.
- Treat successful authentication checks as valid only within the execution context permitted by Qodo's instructions. If the context changes, repeat the documented check when necessary.

## Audit coverage and completion criteria

- For repository-wide audits, maintain an explicit batch plan and record which folders/files were inspected, which checks ran, findings by severity, and areas not yet reviewed. Include frontend, backend, worker, database/schema/migrations, deployment/build configuration, scripts, tests, and behavior-related documentation as applicable.
- Do not treat a successful build, passing unit tests, a successful Qodo review, or a clean diff as proof of complete security or production readiness. Each validates only its documented scope.
- Treat the 100-concurrent-user requirement, robust authentication/authorization, reliable navigation, professional UI language, and responsive performance as goals to verify with concrete evidence. State remaining gaps and measured limitations honestly; never promise zero vulnerabilities, perfect security, or zero latency.
