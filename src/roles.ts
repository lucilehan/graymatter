import { BrainRegion } from './types';

export interface RegionOverride {
  label: string;
  description: string;
  examples: string;
}

export interface RoleConfig {
  id: string;
  label: string;
  emoji: string;
  categorizationHint: string;
  suggestions: string[];
  regions: Record<BrainRegion, RegionOverride>;
}

export const ROLES: RoleConfig[] = [
  {
    id: 'frontend',
    label: 'Frontend Engineer',
    emoji: '🎨',
    categorizationHint: 'User is a frontend engineer. Focus on UI components, design systems, state management, performance, and browser APIs.',
    suggestions: [
      'We use [framework] for…',
      'Always use [pattern] when building…',
      'Design token rule:',
      'Prefer [library] over [other] because…',
      'Performance rule:',
      'This component pattern works well for…',
    ],
    regions: {
      frontal:    { label: 'Decisions & Architecture',  description: 'Tech choices, library decisions, architecture patterns',         examples: '"Migrating to React Server Components", "Dropping Redux for Zustand"' },
      temporal:   { label: 'Events & History',          description: 'Past releases, incidents, design reviews, team decisions',        examples: '"Rebrand shipped March 2025", "Accessibility audit findings"' },
      parietal:   { label: 'Components & Patterns',     description: 'Reusable component patterns, hooks, API integration approaches',  examples: '"Use compound components for modals", "SWR for data fetching"' },
      occipital:  { label: 'Design System & UI',        description: 'Tokens, spacing, typography, color rules, visual conventions',    examples: '"8px base grid", "Inter typeface", "rounded-lg = 8px"' },
      cerebellum: { label: 'DX & Workflows',            description: 'Dev tooling, build setup, code review conventions, CI habits',    examples: '"Run Storybook before PR", "Biome for linting"' },
      limbic:     { label: 'Preferences & Style',       description: 'Personal coding style, opinions, pet peeves',                    examples: '"Prefer CSS modules over Tailwind", "No barrel files"' },
    }
  },
  {
    id: 'backend',
    label: 'Backend / Fullstack',
    emoji: '⚙️',
    categorizationHint: 'User is a backend or fullstack engineer. Focus on APIs, databases, services, infrastructure, and system design.',
    suggestions: [
      'API rule:',
      'Always deploy to…',
      'Database convention:',
      'Auth pattern:',
      'We decided to use [X] instead of [Y] because…',
      'Rate limit for this service is…',
    ],
    regions: {
      frontal:    { label: 'Decisions & Architecture',  description: 'System design choices, API contracts, service boundaries',        examples: '"Moving to event-driven", "GraphQL over REST for this service"' },
      temporal:   { label: 'Events & History',          description: 'Incidents, deploys, migrations, team decisions over time',        examples: '"DB migration ran 2025-03-10", "Outage root cause: N+1 query"' },
      parietal:   { label: 'APIs & Services',           description: 'Endpoints, service dependencies, auth patterns, error handling',  examples: '"Rate limit: 100 req/min", "JWT expiry = 15min"' },
      occipital:  { label: 'Data & Storage',            description: 'Schema details, query patterns, caching strategy, storage rules', examples: '"RLS enabled on users table", "Redis TTL = 5min for sessions"' },
      cerebellum: { label: 'DevOps & Workflows',        description: 'Deploy process, CI/CD, branching strategy, runbooks',            examples: '"Always deploy to staging first", "Two approvals for prod"' },
      limbic:     { label: 'Preferences & Style',       description: 'Code style, library preferences, opinions on patterns',          examples: '"Prefer explicit error returns", "No ORMs on hot paths"' },
    }
  },
  {
    id: 'data',
    label: 'Data Engineer',
    emoji: '📊',
    categorizationHint: 'User is a data engineer. Focus on pipelines, data models, warehouses, orchestration, and data quality.',
    suggestions: [
      'Pipeline rule:',
      '[table] depends on…',
      'Always validate…',
      'SLA for [dataset] is…',
      '[team] owns…',
      'Warehouse quirk:',
    ],
    regions: {
      frontal:    { label: 'Decisions & Strategy',      description: 'Architecture choices, tooling decisions, modelling strategy',     examples: '"Adopting medallion architecture", "Moving off Spark to dbt"' },
      temporal:   { label: 'Incidents & History',       description: 'Pipeline failures, data incidents, migrations, past decisions',   examples: '"Backfill ran 2025-02-14", "SLA breach in orders pipeline"' },
      parietal:   { label: 'Pipelines & Models',        description: 'DAG structure, model dependencies, transformation logic',        examples: '"orders_daily depends on raw_events", "dbt incremental on event_date"' },
      occipital:  { label: 'Schemas & Warehouses',      description: 'Table structures, partitioning, warehouse-specific quirks',      examples: '"BigQuery partition by ingestion_date", "Snowflake cluster key = user_id"' },
      cerebellum: { label: 'Processes & Workflows',     description: 'On-call rotations, deploy steps, testing habits, data contracts',examples: '"Always validate row counts post-load", "Run great_expectations on staging"' },
      limbic:     { label: 'Team & Ownership',          description: 'Who owns what, team conventions, stakeholder context',           examples: '"Finance owns revenue models", "Marketing SLA = T+2"' },
    }
  },
  {
    id: 'ml',
    label: 'ML Engineer',
    emoji: '🧠',
    categorizationHint: 'User is an ML engineer or AI researcher. Focus on model architecture, experiments, datasets, training infrastructure, and evaluation.',
    suggestions: [
      'Run [N] showed…',
      'Base model:',
      'Dataset preprocessing rule:',
      'Best hyperparams so far:',
      'Hypothesis:',
      'Eval metric to watch:',
    ],
    regions: {
      frontal:    { label: 'Decisions & Hypotheses',    description: 'Architectural choices, research directions, experiment goals',   examples: '"Testing LoRA vs full fine-tune", "Switching to contrastive loss"' },
      temporal:   { label: 'Experiments & History',     description: 'Run results, ablations, model versions, training history',       examples: '"Run 47: val loss 0.23 with dropout 0.3", "v2 model released 2025-03"' },
      parietal:   { label: 'Models & Architecture',     description: 'Model design, layer configs, hyperparameters, inference setup',  examples: '"Base: Llama-3 8B", "Context window 32k", "batch size 16 on A100"' },
      occipital:  { label: 'Datasets & Features',       description: 'Data sources, preprocessing steps, feature engineering notes',  examples: '"Filter <50 token sequences", "Normalize embeddings to unit sphere"' },
      cerebellum: { label: 'Training & Workflows',      description: 'Training scripts, eval pipelines, deployment process, tooling', examples: '"Use wandb sweep for HPO", "Always eval on held-out test split"' },
      limbic:     { label: 'Preferences & Style',       description: 'Framework preferences, opinions, research philosophy',          examples: '"Prefer PyTorch over JAX", "Distrust leaderboard results without error bars"' },
    }
  },
  {
    id: 'devops',
    label: 'DevOps / Platform',
    emoji: '🔧',
    categorizationHint: 'User is a DevOps or platform engineer. Focus on infrastructure, CI/CD, observability, reliability, and cloud services.',
    suggestions: [
      'To rollback [service]:',
      'Cost constraint:',
      'Never do [X] in prod because…',
      'Alert fires when…',
      'Config for [service] lives in…',
      'On-call first step:',
    ],
    regions: {
      frontal:    { label: 'Decisions & Architecture',  description: 'Infrastructure choices, platform strategy, tooling decisions',   examples: '"Moving to Pulumi from Terraform", "Standardizing on EKS"' },
      temporal:   { label: 'Incidents & History',       description: 'Outages, postmortems, runbook updates, past migrations',         examples: '"P0 on 2025-03-02: cert expiry", "K8s upgrade completed 2025-01"' },
      parietal:   { label: 'Infrastructure & Services', description: 'Cluster config, service mesh, networking, cloud resources',      examples: '"3 AZs in us-east-1", "Istio for service mesh", "RDS Multi-AZ"' },
      occipital:  { label: 'Config & Secrets',          description: 'Env vars, secrets management, config patterns, permissions',    examples: '"Secrets in Vault, not env vars", "IAM roles via IRSA"' },
      cerebellum: { label: 'Runbooks & Processes',      description: 'On-call steps, deploy procedures, rollback playbooks',          examples: '"Rollback: helm rollback <release> 1", "Check Grafana before paging"' },
      limbic:     { label: 'Cost & Constraints',        description: 'Budget limits, quota constraints, team policies',               examples: '"Spot instances for non-prod", "Hard limit: $50k/month AWS"' },
    }
  },
  {
    id: 'security',
    label: 'Security Engineer',
    emoji: '🔒',
    categorizationHint: 'User is a security engineer. Focus on threat models, vulnerabilities, policies, compliance, and security controls.',
    suggestions: [
      'Policy rule:',
      'CVE [ID] affects…',
      'Attack surface note:',
      'Always require [control] for…',
      'Third-party risk:',
      'Compliance requirement:',
    ],
    regions: {
      frontal:    { label: 'Decisions & Policies',      description: 'Security architecture decisions, policy choices, standards',     examples: '"Zero-trust network model adopted", "mTLS between all services"' },
      temporal:   { label: 'Incidents & Findings',      description: 'Security incidents, pen test findings, audit results',           examples: '"CVE-2025-1234 patched 2025-03", "SAST audit found 3 high findings"' },
      parietal:   { label: 'Technical Controls',        description: 'Security tooling, WAF rules, auth config, encryption setup',    examples: '"SAST: Semgrep + Snyk", "Secrets scanning in CI", "AES-256-GCM"' },
      occipital:  { label: 'Attack Surface',            description: 'Exposed endpoints, third-party risks, data flows, assets',      examples: '"Admin panel exposed on /admin — restrict to VPN", "Payment via Stripe"' },
      cerebellum: { label: 'Checklists & Workflows',    description: 'Security review steps, code review checklists, on-call process',examples: '"Threat model every new service", "OWASP top 10 in PR checklist"' },
      limbic:     { label: 'Preferences & Style',       description: 'Security philosophy, preferred tools, risk tolerance',          examples: '"Deny by default", "Prefer OSS tools for transparency"' },
    }
  },
  {
    id: 'gamedev',
    label: 'Game Developer',
    emoji: '🎮',
    categorizationHint: 'User is a game developer. Focus on game systems, mechanics, performance, assets, and player experience.',
    suggestions: [
      'Game feel rule:',
      'Performance budget for…',
      'Playtest finding:',
      'Art pipeline step:',
      'Mechanic decision:',
      'We removed [feature] because…',
    ],
    regions: {
      frontal:    { label: 'Design & Decisions',        description: 'Game design choices, architecture, feature decisions',           examples: '"Switching to ECS for performance", "Drop procedural gen for handcrafted levels"' },
      temporal:   { label: 'Playtests & History',       description: 'Playtest results, build milestones, past design changes',       examples: '"Alpha playtest 2025-02: pacing too slow in Act 2"' },
      parietal:   { label: 'Systems & Mechanics',       description: 'Game loop, physics setup, core systems, engine patterns',       examples: '"Combat: hitbox 16ms window", "Unity DOTS for crowd sim"' },
      occipital:  { label: 'Assets & Visual',           description: 'Art pipeline, visual style, shader notes, asset conventions',  examples: '"Max 2k textures for mobile", "Stylized lighting — no PBR"' },
      cerebellum: { label: 'Build & Workflows',         description: 'Build pipeline, version control conventions, QA process',      examples: '"Always profile on target hardware", "LFS for assets >10MB"' },
      limbic:     { label: 'Preferences & Style',       description: 'Design philosophy, engine preferences, aesthetic opinions',    examples: '"Juice over realism", "Prefer Godot for 2D projects"' },
    }
  },
  {
    id: 'qa',
    label: 'QA / Test Automation',
    emoji: '🧪',
    categorizationHint: 'User is a QA or test automation engineer. Focus on test strategy, coverage, flaky tests, CI integration, and quality processes.',
    suggestions: [
      '[test] is flaky because…',
      'Always test [scenario] before…',
      'Selector strategy:',
      'CI gate rule:',
      'Known regression:',
      'Coverage gap in…',
    ],
    regions: {
      frontal:    { label: 'Test Strategy & Decisions', description: 'Coverage goals, framework choices, testing philosophy',          examples: '"Shifting to contract testing", "E2E only for critical paths"' },
      temporal:   { label: 'Bug History',               description: 'Past bugs, regressions, incident patterns, test failures',      examples: '"Checkout flaky since deploy 2025-03-01", "Regression in auth every release"' },
      parietal:   { label: 'Test Patterns',             description: 'Test helpers, fixture patterns, mocking strategies, assertions',examples: '"Use builder pattern for test data", "Mock at HTTP boundary not service"' },
      occipital:  { label: 'UI & Visual Testing',       description: 'Selector strategies, visual regression setup, accessibility',  examples: '"Prefer data-testid selectors", "Percy for visual diff"' },
      cerebellum: { label: 'Test Workflows',            description: 'CI/CD gates, test run order, retry strategy, reporting',       examples: '"E2E blocks merge on main", "Retry flaky tests 2x before failing"' },
      limbic:     { label: 'Preferences & Style',       description: 'Testing opinions, framework preferences, quality philosophy',  examples: '"Prefer Playwright over Cypress", "Test behaviour not implementation"' },
    }
  },
  {
    id: 'techlead',
    label: 'Technical Lead',
    emoji: '🧭',
    categorizationHint: 'User is a technical lead or staff engineer. Focus on architecture, team decisions, technical strategy, and cross-team coordination.',
    suggestions: [
      'We decided [X] because…',
      '[team] owns…',
      'RFC required for…',
      'Technical debt note:',
      'Cross-team dependency:',
      'Non-negotiable standard:',
    ],
    regions: {
      frontal:    { label: 'Decisions & Strategy',      description: 'Architecture decisions, technical roadmap, tradeoffs',          examples: '"Standardizing on gRPC across teams", "Deprecating legacy auth by Q3"' },
      temporal:   { label: 'Events & History',          description: 'Team milestones, past decisions, retros, cross-team context',   examples: '"Mono-repo migration completed Q1", "Team A owns payments service"' },
      parietal:   { label: 'Technical Knowledge',       description: 'Stack details, system topology, key abstractions, constraints', examples: '"API gateway handles auth", "Max payload 5MB enforced at edge"' },
      occipital:  { label: 'Visual & Design',           description: 'Design system ownership, UX guidelines, visual standards',     examples: '"Design tokens owned by platform team", "All dashboards use Recharts"' },
      cerebellum: { label: 'Team Processes',            description: 'PR process, on-call rotations, meeting cadences, conventions', examples: '"RFCs required for cross-team changes", "Retro every 2 weeks"' },
      limbic:     { label: 'Preferences & Style',       description: 'Engineering culture values, leadership style, team norms',     examples: '"Blameless postmortems", "Over-communicate in async first culture"' },
    }
  },
  {
    id: 'vibe',
    label: 'Vibe Coder',
    emoji: '✨',
    categorizationHint: 'User is a vibe coder who builds with AI assistance. Focus on what they are building, what prompts and tools work, and what they want their project to feel like.',
    suggestions: [
      "I'm building…",
      'The vibe I want is…',
      'My stack is…',
      'This prompt works really well:',
      "[tool] is great for…",
      "Don't use [X] because…",
    ],
    regions: {
      frontal:    { label: "What I'm Building",         description: 'Current projects, goals, features in progress',                 examples: '"Building a mood-based playlist generator", "Side project: AI journaling app"' },
      temporal:   { label: 'What Worked / What Didn\'t',description: 'Wins, failures, things to try again or avoid',                  examples: '"Tailwind + shadcn = instant good UI", "Don\'t use X library — too buggy"' },
      parietal:   { label: 'Stack & Tools',             description: 'Frameworks, services, APIs being used',                        examples: '"Next.js + Supabase + Vercel", "Replicate for image gen"' },
      occipital:  { label: 'UI & Vibes',                description: 'Aesthetic direction, design inspiration, visual goals',        examples: '"Dark glassmorphism feel", "Inspired by Linear\'s design"' },
      cerebellum: { label: 'Shortcuts & Tricks',        description: 'Useful prompts, AI workflows, quick wins discovered',          examples: '"Ask Claude to write the types first", "v0 for initial layout then customise"' },
      limbic:     { label: 'Preferences & Style',       description: 'Personal taste, things that feel right, aesthetic values',     examples: '"Minimalist > feature-rich", "Prefer building in public"' },
    }
  }
];

export const DEFAULT_ROLE_ID = 'backend';

export function getRoleById(id: string): RoleConfig | undefined {
  return ROLES.find(r => r.id === id);
}
