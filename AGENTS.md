# Workspace Audit and Engineering Standards

Apply these instructions to the entire repository, including the
frontend, backend, worker, database migrations, deployment and build
configuration, scripts, tests, and documentation that describes
application behavior. The goal is a strict, evidence-based audit
suitable for preparing this application for production.

## Audit standard

-   Review the implementation as a security-sensitive, production
    application. Do not assume that a feature is safe because it works
    in the UI, because a route is hidden, or because a comment or
    document says it is secure. Trace untrusted input through the
    frontend, API, authorization layer, database, worker, and output
    wherever relevant.
-   Report only findings supported by concrete evidence in this
    repository. For each finding, identify the affected file and
    location, explain a realistic impact and conditions, assign a
    severity, and recommend a specific remediation. Distinguish
    confirmed vulnerabilities from risks, missing evidence, and optional
    improvements. Do not invent findings or claim the audit proves the
    absence of vulnerabilities.
-   Prioritize exploitable security defects and data loss/corruption
    risks, then correctness and reliability defects,
    production-readiness gaps, and maintainability issues. Include
    lower-severity issues when they are actionable; do not hide a real
    issue merely because it is inconvenient to fix.
-   Inspect the whole workspace, not only files changed most recently.
    Follow routes, middleware, services, repositories, migrations, jobs,
    frontend callers, and configuration to understand actual behavior.
    Check that API documentation and user-facing behavior agree with the
    implementation.
-   Use explicit repository-wide audit batches and a coverage ledger. A
    change-focused review, a successful build, a clean diff, or a
    static-analysis scan is not by itself a full repository audit.

## Security and privacy

-   Verify authentication and authorization on every sensitive
    server-side operation. Check role enforcement, organization and
    booth scoping, object ownership, active assignments, revocation and
    expiry behavior, and protection against IDOR, privilege escalation,
    replay, and self-approval. UI route guards are not security
    boundaries.
-   Check all inputs at trust boundaries, including request bodies,
    query parameters, path parameters, uploaded files, CSV contents,
    environment configuration, and data consumed by background jobs. Use
    parameterized database queries and safe output handling; check for
    injection, path traversal, unsafe redirects, mass assignment, and
    validation gaps.
-   Review session and token handling, password storage and reset/change
    flows, cookie flags, CSRF protections, CORS, rate limits, error
    responses, and secret handling. Never expose credentials, tokens,
    sensitive personal data, stack traces, or internal infrastructure
    details in logs or responses.
-   Treat household, voter, citizen, complaint, and attachment data as
    sensitive. Check data minimization, access boundaries, exports,
    retention/deletion behavior, masking, cache behavior, file access,
    and whether sensitive data can leak across users, booths,
    organizations, or logs.
-   Review upload and import/export processing for content validation,
    size and resource limits, formula injection, duplicate handling,
    safe storage, authorization at processing time, and cleanup/expiry.
    Check worker retry, idempotency, locking, and failure behavior.
-   Do not weaken authorization, validation, cryptography, security
    headers, or tests to make a check pass. Do not recommend
    client-side-only protection for server-side data.

## Production quality and maintainability

-   Expect production-level error handling, transactional consistency,
    concurrency safety, bounded resource use, resilient background
    processing, secure defaults, operational visibility, and deployment
    configuration that fails safely. Identify assumptions that are
    undocumented or unsafe for production.
-   Prefer clear, cohesive modules with responsibilities that fit the
    project. Identify both needless fragmentation and
    oversized/mixed-responsibility modules. Remove or flag duplicated
    logic, redundant state, unreachable branches, unused
    exports/dependencies, dead code, stale comments, and documentation
    that no longer matches behavior.
-   Avoid lazy shortcuts, silent failure, placeholder behavior presented
    as completed functionality, broad exception swallowing, unsafe type
    coercion, arbitrary magic values, and duplicated authorization or
    validation rules. Recommend a focused abstraction only when it
    reduces real complexity or risk.
-   Identify deprecated, obsolete, unsupported, or unsafe APIs and
    dependencies using repository evidence and authoritative
    package/runtime documentation where needed. Do not suggest upgrades
    blindly; consider compatibility, support status, security
    advisories, and migration impact.
-   Check accessibility, responsive behavior, loading/error/empty
    states, and API error handling where they affect correctness or
    expose misleading behavior. Ensure role-specific screens call
    endpoints intended for that role.
-   Keep fixes minimal, maintainable, and consistent with existing
    project conventions. Do not perform broad rewrites or change product
    behavior without a clear reason. Preserve backward compatibility
    where appropriate and document any necessary behavior change.

## Verification and reporting

-   Inspect existing tests and run relevant available checks for the
    areas reviewed when the environment permits. Prefer focused checks
    first, then the project build and relevant test suites. Do not point
    database-backed tests at production or real citizen data; use a
    dedicated synthetic test database only.
-   Add or recommend regression coverage for confirmed defects,
    especially authorization boundaries, cross-booth access,
    role-specific routes, input validation, and data lifecycle behavior.
    Report checks that could not run and the exact blocker; never imply
    a check passed when it did not.
-   For any proposed or applied fix, explain the root cause, affected
    behavior, and verification performed. Recheck related callers and
    permissions so that a local fix does not create a different
    vulnerability or role regression.
-   Present audit results first, ordered by severity, with concise
    evidence and remediation. Then list material production-readiness
    gaps, verification performed, and any limits of the review. If no
    findings are confirmed, state that clearly while still listing
    meaningful coverage and limitations.
-   Keep a record of commands actually run, their exit codes/results,
    environment constraints, test data used, and any checks not run.
    Separate tool output from Codex's interpretation and from manually
    verified findings.

## Product and engineering requirements

These requirements apply across the entire application. Treat them as
explicit product and production-readiness goals; verify them against the
actual architecture and implementation rather than assuming they are
already satisfied.

### Concurrent use and database correctness

-   Design and verify the application to support at least 100 concurrent
    users actively interacting with the application and database under a
    documented, realistic workload.
-   Do not treat "100 users" as proof of capacity by itself. Identify
    likely request patterns, expensive operations, data sizes, and
    bottlenecks; define measurable latency, throughput, error-rate, and
    resource-use targets appropriate to the application.
-   Inspect database connection pooling and limits, query efficiency,
    indexes, transaction boundaries, isolation levels, locking, race
    conditions, deadlocks, and connection/resource cleanup.
-   Protect writes and multi-step operations against lost updates,
    duplicate submissions, partial writes, inconsistent state, and
    concurrent requests that could bypass business rules. Use
    transactions, constraints, idempotency, optimistic/pessimistic
    locking, or queues where appropriate to the existing stack and
    operation.
-   Check pagination and bounded result sizes for list/search endpoints.
    Avoid unbounded queries, N+1 access patterns, unnecessary repeated
    requests, blocking work on request paths, and expensive work on
    every render or click.
-   Add or recommend repeatable load and concurrency tests using
    synthetic data and a non-production environment. Exercise concurrent
    reads and writes, authentication/authorization boundaries,
    failure/retry behavior, and data consistency. Report the tested
    workload, environment, metrics, failures, and limitations. Do not
    claim support for 100 concurrent users until appropriate tests
    provide evidence.
-   Do not add caching, queues, indexes, connection pools, or other
    infrastructure blindly. Confirm the need, preserve correctness and
    authorization boundaries, and document operational trade-offs.

### Authentication, authorization, and navigation

-   Aim for robust, defense-in-depth authentication and authorization
    across all supported roles and user journeys. Never describe
    security as "perfect" or guaranteed; demonstrate it with
    implementation evidence, negative tests, and clear limitations.
-   Enforce permissions on the server for every protected operation.
    Validate identity, role, ownership, tenant/organization/booth scope,
    active assignment, and resource state as applicable. Treat
    client-side route guards and hidden controls as usability measures,
    not security controls.
-   Verify login, logout, session expiry, token refresh/revocation,
    password recovery or other account-recovery flows, unauthorized
    access, forbidden access, and direct navigation to protected URLs.
    Ensure redirects do not create open redirects or loops.
-   Ensure navigation is coherent and predictable: each visible
    navigation item leads to the correct destination for the current
    role; browser back/forward, refresh, deep links, expired sessions,
    empty states, and not-found routes behave correctly. Do not expose
    links or actions the user cannot use, and do not rely on hiding them
    to enforce permissions.
-   Check for IDOR, privilege escalation, cross-user or
    cross-organization data exposure, insecure direct API calls, CSRF,
    unsafe CORS, brute-force/credential-stuffing exposure, and missing
    rate limits where relevant to the stack and threat model.
-   Keep authorization checks consistent across frontend routes, API
    endpoints, background jobs, exports, file downloads, and database
    access. Re-check authorization when queued work executes, not only
    when it is submitted.
-   Add positive and negative tests for each important role and
    permission boundary, including attempts to access another user's or
    organization's resources and attempts made with expired or revoked
    credentials.

### Performance and responsiveness

-   Keep initial page load, route transitions, API requests, database
    operations, and button interactions responsive under normal and
    tested peak workloads. Establish measurable budgets where feasible
    and report the actual measurements rather than promising that the
    application will never lag.
-   Trace slow interactions end to end across browser rendering, network
    calls, server processing, database queries, and worker tasks. Fix
    evidenced bottlenecks instead of applying speculative optimizations.
-   Avoid duplicate API calls, unnecessary component renders, repeated
    expensive calculations, synchronous/blocking work on critical paths,
    oversized payloads, unbounded lists, and unnecessary assets or
    dependencies.
-   Use pagination, filtering, lazy loading, batching, caching,
    background jobs, or debouncing only where appropriate and safe.
    Ensure caches are correctly scoped and cannot leak private or
    role-specific data; ensure asynchronous work has cancellation,
    timeout, retry, and error behavior appropriate to the operation.
-   Provide immediate, accessible feedback for actions that take time:
    loading/pending states, disabled duplicate-submit controls where
    appropriate, success confirmation, actionable error messages, and
    empty states. Do not mask failures as success or leave controls
    appearing frozen.
-   Measure performance before and after material changes where the
    environment allows. Include relevant browser/network traces, API
    timings, query plans, or load-test metrics when useful. Report
    checks that could not be run.

### Professional user interface and writing

-   Use clear, professional, user-friendly language appropriate for an
    official production application. Ensure all visible strings have
    correct grammar, spelling, capitalization, punctuation, and
    consistent terminology.
-   Review page titles, navigation labels, button text, form labels,
    helper text, validation messages, confirmation dialogs,
    notifications, empty states, loading states, errors, accessibility
    labels, and system-generated messages.
-   Prefer concise, specific instructions that explain what happened and
    what the user can do next. Avoid vague messages such as "Something
    went wrong" when a safe, actionable explanation is available. Never
    expose stack traces, secrets, internal identifiers, or sensitive
    implementation details to users.
-   Use consistent terminology for the same entity and action throughout
    the product. Make destructive, irreversible, or security-sensitive
    actions explicit and provide confirmation or recovery where
    appropriate.
-   Ensure controls have clear names and states, forms are keyboard
    accessible, focus is managed sensibly after navigation and errors,
    color is not the only signal, and responsive layouts remain usable
    on supported screen sizes.
-   Do not change legally or operationally significant wording, consent
    language, or policy text casually. Flag ambiguity for confirmation
    rather than inventing official policy.

## Codex implementation and independent-review workflow

### Responsibilities

-   Codex is the primary implementation and audit agent. It is
    responsible for understanding the repository, planning work,
    inspecting code, writing and modifying code, debugging, running
    checks, and applying fixes within the user's authorization.
-   SonarQube Community Build is the configured static-analysis source
    for this workspace. Use the exported SonarQube issue report (PDF),
    complete JSON response, and CSV register as inputs when supplied.
    The JSON is the authoritative source for the exact exported
    findings; do not rely on the PDF alone when structured details are
    needed.
-   Complement SonarQube with existing project checks and carefully
    selected tools for dependency vulnerabilities, secret detection,
    linting, type checking, tests, builds, and configuration checks.
    Inspect what is already installed before adding tools. Prefer a
    small, locally workable toolset compatible with Windows and the
    existing project. Avoid reintroducing the discarded reviewer
    integration or unrelated paid services. Do not require Docker unless
    the user explicitly approves it and it is necessary for a specific
    check.
-   Treat each tool as a source of evidence with a defined scope, not as
    an infallible reviewer. A clean scan does not prove the absence of
    defects. Do not claim an independent review was performed unless a
    genuinely separate tool or reviewer was run.
-   Codex must still reason across the codebase and business
    requirements. Static-analysis tools cannot replace tracing
    authorization, data flow, concurrency behavior, product
    requirements, or actual user journeys.

### Required audit and development loop

1.  Read this file first and inspect the repository structure, project
    instructions, scripts, dependency manifests/lockfiles, tests,
    configuration, and relevant documentation before making changes.
2.  Build a repository-wide batch plan covering at minimum the frontend,
    backend/API, worker/background processing,
    database/schema/migrations, authentication and authorization,
    import/export and file handling, deployment/build configuration,
    scripts, tests, and behavior-related documentation. Adjust batches
    to the actual repository structure and track each batch's coverage.
3.  Review the supplied SonarQube findings. Map each finding to the
    actual source code, verify its context and whether it is a real
    issue, and track it as confirmed, false positive/not applicable with
    evidence, already fixed, or unresolved. Do not blindly apply
    automated suggestions. Preserve issue keys/rule IDs and file/line
    references in the tracking notes.
4.  Inspect each batch, including unchanged files. Trace callers and
    dependencies across batch boundaries; do not treat each file as
    isolated. Review security, correctness, data integrity, performance,
    usability/accessibility, maintainability, and compliance with the
    product requirements above.
5.  Inventory existing local checks before installing anything. Run the
    relevant available lint, test, type-check, build, dependency-audit,
    secret-scan, and configuration checks. If a recommended check is
    missing, explain its benefit, footprint, installation requirements,
    and alternatives before adding it unless the user has already
    authorized the tool.
6.  Prioritize findings by severity and evidence. Fix exploitable
    security defects and data-loss/corruption risks first, followed by
    correctness/reliability, production-readiness gaps, and
    maintainability. For each finding, state evidence, affected file and
    line, realistic impact, severity, and a focused remediation.
7.  Before changing code, identify root cause, related callers, expected
    behavior, compatibility risks, and the tests needed. Make minimal,
    focused changes consistent with the existing architecture. Do not
    perform broad rewrites or alter product behavior without a clear
    reason.
8.  Add or update regression tests for confirmed defects, especially
    authorization boundaries, cross-booth access, role-specific routes,
    input validation, imports/exports, and data lifecycle behavior.
    Never weaken controls or tests to make checks pass.
9.  Run relevant focused checks after each meaningful fix, then the
    broader applicable test suite and production builds. Record exact
    commands and actual results. If a check cannot run, state the exact
    blocker; do not infer success.
10. Reinspect the final diff and related callers. Look for regressions,
    accidental behavior changes, generated artifacts, secrets, and
    incomplete changes. Do not commit, push, merge, deploy, or perform
    destructive data operations without explicit user authorization.
11. Once the batch audit and fixes are complete, run SonarQube analysis
    again if the local server/scanner are available. Compare the new
    results with the baseline export. Verify which findings were
    resolved, remain, or were newly introduced. A zero-issue dashboard
    is not proof of complete security or correctness.
12. Produce a final report ordered by severity, followed by
    production-readiness gaps, batch coverage, tools and exact commands
    run, test/build results, performance/load-test evidence, unresolved
    items, and review limitations. State clearly what was not tested and
    what remains uncertain. Do not claim "perfect security," "zero
    vulnerabilities," or guaranteed performance.

### Tool use and safe operation

-   Prefer tools already installed and configured. Do not install
    redundant tools just because they are available. Before installing a
    new tool, explain why the existing stack does not cover the need and
    whether it is optional or required.
-   Keep tool execution local where practical and avoid unnecessary
    cloud uploads of source code, secrets, or sensitive data. Never put
    tokens, passwords, private keys, or production credentials into
    prompts, reports, source files, or command history intentionally.
    Redact secrets in output.
-   Never run destructive database migrations, delete user data, disable
    security controls, bypass sandboxing, or broaden permissions
    unnecessarily. Use synthetic data and a dedicated non-production
    database for tests.
-   Do not treat Docker as a default prerequisite. If a check requires
    Docker, first explain why and obtain the user's approval before
    making Docker part of the workflow.
-   Do not mark a tool or review gate as passed unless it actually ran
    and its result was inspected. Distinguish static analysis, tests,
    manual code review, and load testing in the report.
-   The user authorizes focused audit and code fixes in accordance with
    these instructions, but this does not authorize committing, pushing,
    merging, deploying, destructive data operations, or material
    product-policy changes.

## Audit coverage and completion criteria

-   For repository-wide audits, maintain an explicit batch plan and
    record which folders/files were inspected, which checks ran,
    findings by severity, and areas not yet reviewed. Include frontend,
    backend, worker, database/schema/migrations, deployment/build
    configuration, scripts, tests, and behavior-related documentation as
    applicable.
-   Do not treat a successful build, passing unit tests, a successful
    static-analysis scan, or a clean diff as proof of complete security
    or production readiness. Each validates only its documented scope.
-   Treat the 100-concurrent-user requirement, robust
    authentication/authorization, reliable navigation, professional UI
    language, and responsive performance as goals to verify with
    concrete evidence. State remaining gaps and measured limitations
    honestly; never promise zero vulnerabilities, perfect security, or
    zero latency.

## Audit Execution Rules and Safety Boundaries

These rules apply to every phase of the repository audit. Follow them in addition to all existing security, quality, testing, and production-readiness requirements in this file.

### 1. Read-Only Baseline Before Execution

- Begin with repository inventory, source inspection, configuration review, and analysis of the supplied reports.
- Do not modify, create, delete, rename, or reformat repository files during the initial baseline phase.
- Do not install or update tools or dependencies, run tests or builds, execute scans, or run database operations during the initial baseline phase.
- Record the existing Git status and preserve all pre-existing user changes. Never discard, overwrite, or revert unrelated work.
- Identify what has been inspected, what remains unreviewed, and what could not be verified.

### 2. Evidence-Based Findings

- Every finding must include its location, relevant code evidence, realistic impact, severity or priority, confidence, and recommended remediation.
- Distinguish confirmed defects, potential risks, false positives, and items requiring further investigation.
- Verify scanner findings against the actual source code and execution context wherever possible.
- Do not invent vulnerabilities, exaggerate impacts, or claim that a vulnerability is exploitable without sufficient evidence.
- Treat the supplied SonarQube JSON as the authoritative source for the supplied findings. Use accompanying PDF and CSV reports as supporting views.

### 3. Coverage Ledger and Audit Tracking

Maintain a coverage ledger throughout the audit. Track:

- Files, directories, components, and workflows reviewed.
- Files and components not yet reviewed, excluded, or blocked, including the reason.
- Findings discovered, validated, fixed, rejected, or awaiting investigation.
- Commands and checks attempted, their exact outcomes, and relevant failure reasons.
- Tests added, tests executed, and outstanding validation requirements.

Do not declare the audit complete merely because all currently known findings have been addressed. Clearly identify unreviewed areas and remaining limitations.

### 4. Existing Tools First

- Inspect existing manifests, lockfiles, scripts, tests, configuration, and available local tools before recommending installations.
- Prefer existing repository scripts and locally available tools.
- Introduce a new tool only when it addresses a specific, meaningful gap that existing tools do not adequately cover.
- Explain the purpose, setup requirements, limitations, and expected benefit before adding a new dependency or tool.
- Do not introduce Docker as a requirement when an equivalent safe local workflow is practical.
- Do not install, remove, update, or upgrade dependencies without authorization.

### 5. Safe Command Execution

- During the initial baseline phase, remain strictly read-only and do not execute tests, builds, scans, migrations, seeds, or application-changing commands.
- After the baseline is reviewed and execution is authorized, run checks in small, logical stages and record their results.
- Before any command that changes data, modifies the environment, installs packages, or affects external services, establish its purpose, scope, and safety.
- Never run migrations, seed scripts, destructive operations, or database-backed tests against production resources.
- Do not guess database connection strings, credentials, environment variables, or service configuration.
- If a prerequisite is missing or a command may cause unintended changes, stop and explain the issue instead of improvising.
- Use synthetic test data. Never expose real citizen data, passwords, access tokens, API keys, or other secrets in logs or reports.

### 6. Baseline Before Fixes

- Complete and document the initial read-only baseline before modifying application code.
- Establish existing test, build, dependency, and static-analysis results before treating later failures as regressions.
- Prioritize findings according to verified risk, exploitability, impact, and dependencies rather than scanner severity alone.
- Fix related issues in small, traceable batches. Avoid broad rewrites, unrelated refactoring, and unnecessary changes.
- Do not silently change business rules, authorization policies, database schemas, or externally visible behavior.

### 7. Verification After Every Fix Batch

- Run the relevant regression tests and other appropriate checks after each authorized fix batch.
- Run the production build, dependency checks, and applicable security scans at the appropriate stages.
- Repeat SonarQube analysis using consistent project scope and configuration, then compare the results with the baseline.
- Inspect the final Git diff for unintended modifications, exposed secrets, accidental deletions, and unrelated changes.
- A successful command does not establish that the application is secure; validate the affected behavior and security boundaries.
- Do not claim a fix is verified unless the required validation has actually been performed.

### 8. Honest Reporting

For every check, report one of the following outcomes as appropriate:

- **Passed:** executed successfully and met the stated expectation.
- **Failed:** executed and did not meet the expectation.
- **Blocked:** could not execute because a prerequisite or permission was missing.
- **Skipped:** intentionally not executed, with a reason.
- **Not run:** no execution has been attempted.

Never describe a proposed check as completed, a blocked check as passed, or an unreviewed component as safe.

### 9. Authorization Between Audit Phases

- Complete each audit phase and summarize its findings before proceeding to a phase involving additional execution, installation, or code modification.
- Request authorization when the next phase introduces material risk, requires a new tool, changes data, or modifies application code.
- Do not interpret permission to inspect the repository as permission to modify it.
- Preserve a clear record of decisions, assumptions, unresolved questions, and remaining work.

The goal is a reproducible, evidence-based audit with verified fixes and explicitly documented limitations—not merely a clean scanner dashboard or a large number of completed commands.