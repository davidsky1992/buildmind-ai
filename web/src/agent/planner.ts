import { PROJECTS, findProject, normalizeProjectId, type ProjectStatus } from "../tools/projectData";
import { STATE_NAMES } from "../tools/projectTools";
import type { DelayedProjectsResult, SearchProjectsResult } from "../tools/projectTools";
import type { KnowledgeSearchResult } from "../tools/knowledgeTool";
import type { ExecutionContext } from "./context";
import type { MemoryState } from "./memory";
import type { ToolArgs, ToolCallRecord } from "./types";

export type Intent =
  | "greeting"
  | "delayed_projects"
  | "project_details"
  | "delay_calculation"
  | "project_search"
  | "knowledge";

export interface Entities {
  projectIds: string[];
  projectSource: "explicit_id" | "project_name" | "memory" | null;
  status?: ProjectStatus;
  projectType?: string;
  location?: string;
  searchText?: string;
  minDelayDays?: number;
  sortBy?: "delay_days" | "ld_exposure";
  superlative: boolean;
}

export interface IntentAnalysis {
  request: string;
  intents: Intent[];
  entities: Entities;
  /** Human-readable reasons for each decision (shown in the trace). */
  signals: string[];
}

export interface PlanStep {
  id: string;
  tool: string;
  goal: string;
  status: "pending" | "done" | "failed" | "skipped";
  note?: string;
  callId?: string;
  origin: "initial" | "replan";
}

export type Resolution = { args: ToolArgs; rationale: string } | { skip: string };

/** A plan step plus the function that computes its arguments from earlier observations. */
export interface Goal {
  step: PlanStep;
  resolve(ctx: ExecutionContext): Resolution;
}

export type NextAction =
  | { type: "tool"; goal: Goal; tool: string; args: ToolArgs; rationale: string }
  | { type: "finish"; reason: string };

// ------------------------------------------------------------------ lexicon

const TYPE_SYNONYMS: [RegExp, string][] = [
  [/\b(hospital|healthcare|medical center|clinic)s?\b/, "Healthcare"],
  [/\b(bridge|highway|roadway|infrastructure)s?\b/, "Infrastructure"],
  [/\b(school|education|campus school|university)s?\b/, "Education"],
  [/\b(apartment|residential|housing|multifamily)s?\b/, "Residential"],
  [/\b(transit|rail|light[- ]rail|station)s?\b/, "Transit"],
  [/\b(warehouse|distribution center|logistics|industrial)s?\b/, "Industrial"],
  [/\b(water|wastewater|treatment plant|utility|utilities)\b/, "Water & Utilities"],
  [/\b(office|commercial|corporate)s?\b/, "Commercial Office"],
  [/\b(senior living|assisted living|senior)\b/, "Senior Living"],
  [/\b(mixed[- ]use|tower|high[- ]rise)s?\b/, "Mixed-Use"],
];

const STATUS_PATTERNS: [RegExp, ProjectStatus][] = [
  [/\bon[- ]track\b/, "On Track"],
  [/\bat[- ]risk\b/, "At Risk"],
  [/\b(completed|finished|closed out)\b/, "Completed"],
  [/\b(on hold|paused|suspended)\b/, "On Hold"],
];

const KNOWLEDGE_RE =
  /\b(contract|clause|article|paragraph|section|spec|specification|policy|procedure|manual|requirements?|required|require[sd]?|rules?|safety|osha|ppe|fall protection|harness|excavation|trench|crane|hot work|incident|concrete|curing|cure|cylinders?|slump|psi|cold[- ]weather|hot[- ]weather|liquidated damages|penalt(y|ies)|notice|claims?|extension|excusable|concurrent|retainage|warranty|punch[- ]list|closeout|commissioning|rfis?|change orders?|markups?|approv(e|al|es)|permits?|turbidity|in[- ]water|recovery schedule|recovery plan|document|documents|uploaded|according to|report says|what does .* say|mock-?ups?|non[- ]conformance|inspection|o&m|toolbox|how soon|how long|deadline|definition|define|substantial completion|why|causes?|caused|reasons?)\b/;

const DELAY_WORD_RE = /\b(delay|delays|delayed|late|behind[- ]schedule|behind|overdue|slipp(ing|ed)|slip)\b/;
const LIST_CUE_RE = /\b(projects|which|list|show|any|how many|all|portfolio|top|rank)\b/;
const SUPERLATIVE_RE = /\b(most|worst|biggest|largest|longest|highest|furthest|greatest)\b/;
const HYPOTHETICAL_RE = /\b(if|when|whenever|once)\s+(a|the|any|our)\s+(project|contractor|job|work)\b/;
const DELAY_CALC_RE =
  /\b(how (many days|late|far behind|much (delay|behind))|calculat\w*|delay\w*|days late|late|behind|slip\w*|exposure|liquidated damages|ld\b|ahead of schedule|on schedule|schedule variance|variance)\b/;
const DETAIL_RE =
  /\b(details?|status|progress|budget|cost|spent|spend|manager|pm|contractor|client|owner|milestones?|risks?|overview|summary|summari[sz]e|about|info|information|percent|complete|who|team|value)\b/;
const SEARCH_CUE_RE = /\b(find|search|list|show|which|how many|all|any|what)\b[^?]*\bprojects?\b|\bprojects?\s+(in|for|located)\b/;
const GREETING_RE = /^\s*(hi|hello|hey|help|what can you do|who are you|how does this work)\b/;
const PLURAL_REF_RE = /\b(them|those|these|those projects|these projects|each of them)\b/;
const SINGULAR_REF_RE = /\b(it|its|it's|this project|that project|the project|same project|this one|that one)\b/;

const NAME_KEYS: { key: RegExp; id: string }[] = PROJECTS.map((p) => ({
  key: new RegExp(`\\b${p.name.split(" ")[0].toLowerCase()}\\b`),
  id: p.id,
})).concat([{ key: /\bline 3\b/, id: "BM-107" }]);

const CITIES = PROJECTS.map((p) => p.city);

// ------------------------------------------------------------------ planner

export class AgentPlanner {
  /** Step 2: analyse intent and extract entities with deterministic rules. */
  analyze(request: string, memory: Readonly<MemoryState>): IntentAnalysis {
    const text = request.toLowerCase().replace(/[’']/g, "'");
    const signals: string[] = [];
    const e: Entities = { projectIds: [], projectSource: null, superlative: SUPERLATIVE_RE.test(text) };

    // --- project references
    const ids = [...text.matchAll(/\bbm[-\s]?(\d{3})\b/g)].map((m) => normalizeProjectId(`BM-${m[1]}`));
    if (ids.length) {
      e.projectIds = [...new Set(ids)];
      e.projectSource = "explicit_id";
      signals.push(`Project id(s) in request: ${e.projectIds.join(", ")}`);
    } else {
      const named = [...new Set(NAME_KEYS.filter((n) => n.key.test(text)).map((n) => n.id))];
      if (named.length) {
        e.projectIds = named;
        e.projectSource = "project_name";
        signals.push(`Project name matched: ${named.map((id) => `${id} (${findProject(id)?.name})`).join(", ")}`);
      } else if (
        memory.lastProjectIds.length &&
        (PLURAL_REF_RE.test(text) || SINGULAR_REF_RE.test(text)) &&
        // "which project is most delayed and what is its …" → "its" refers to the answer, not to memory
        !(e.superlative && DELAY_WORD_RE.test(text))
      ) {
        e.projectIds = PLURAL_REF_RE.test(text) ? memory.lastProjectIds.slice(0, 4) : [memory.lastProjectIds[0]];
        e.projectSource = "memory";
        signals.push(`Pronoun resolved from memory → ${e.projectIds.join(", ")}`);
      }
    }
    const hasProject = e.projectIds.length > 0;

    // --- filters
    for (const [re, type] of TYPE_SYNONYMS) if (re.test(text)) { e.projectType = type; break; }
    for (const [re, status] of STATUS_PATTERNS) if (re.test(text)) { e.status = status; break; }
    const city = CITIES.find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(text));
    const stateName = Object.entries(STATE_NAMES).find(([, n]) => new RegExp(`\\b${n}\\b`).test(text));
    const stateCode = /\b(CA|WA|OH|TX|CO|AZ|WI|NC)\b/.exec(request)?.[1];
    e.location = city ?? stateName?.[1] ?? stateCode;
    const minMatch =
      /\b(?:more than|over|greater than|exceeding|beyond|>)\s*(\d{1,4})\s*(?:calendar\s+)?days?/.exec(text) ??
      /\b(?:at least|minimum of|>=)\s*(\d{1,4})\s*(?:calendar\s+)?days?/.exec(text) ??
      /\b(\d{1,4})\+\s*days?/.exec(text);
    if (minMatch) {
      const n = Number(minMatch[1]);
      e.minDelayDays = /more than|over|greater|exceeding|beyond|>(?!=)/.test(minMatch[0]) ? n + 1 : n;
    }
    if (/\b(liquidated|ld|exposure|financial|cost of delay|penalt)/.test(text)) e.sortBy = "ld_exposure";

    // --- intents
    const intents = new Set<Intent>();
    const knowledge = KNOWLEDGE_RE.test(text);
    const hypothetical = HYPOTHETICAL_RE.test(text);

    if (!hasProject && !hypothetical && DELAY_WORD_RE.test(text) && (LIST_CUE_RE.test(text) || e.superlative)) {
      intents.add("delayed_projects");
      signals.push("Asks which projects are delayed → portfolio delay query");
    }
    if (hasProject && DELAY_CALC_RE.test(text)) {
      intents.add("delay_calculation");
      signals.push("Asks how late a specific project is → delay calculation");
    }
    if (intents.has("delayed_projects") && e.superlative && (DELAY_CALC_RE.test(text) || DETAIL_RE.test(text))) {
      intents.add("delay_calculation");
      signals.push("Superlative ('most …') → analyse the top-ranked project in depth");
    }
    if (hasProject && (DETAIL_RE.test(text) || (!intents.has("delay_calculation") && !knowledge))) {
      intents.add("project_details");
      signals.push("Asks about a specific project → project details");
    }
    const hasFilter = Boolean(e.projectType || e.location || e.status);
    const searchCue = SEARCH_CUE_RE.test(text) && (hasFilter || !knowledge);
    if (!hasProject && !hypothetical && !intents.has("delayed_projects") && (searchCue || (hasFilter && /\bprojects?\b/.test(text)))) {
      intents.add("project_search");
      signals.push(
        `Portfolio search with filters: ${[e.status && `status=${e.status}`, e.projectType && `type=${e.projectType}`, e.location && `location=${e.location}`].filter(Boolean).join(", ") || "none"}`,
      );
      if (/\b(the|this|that)\s+\w+(\s+\w+)?\s+project\b/.test(text) && !/\bprojects\b/.test(text)) {
        intents.add("project_details");
        signals.push("Singular reference ('the … project') → fetch details if exactly one match");
      }
    }
    if (knowledge) {
      intents.add("knowledge");
      signals.push("Mentions contract / spec / procedure terms → needs document knowledge (RAG)");
    }
    if (!intents.size) {
      if (GREETING_RE.test(text) && text.split(/\s+/).length <= 6) {
        intents.add("greeting");
        signals.push("Greeting / help request → no tools needed");
      } else {
        intents.add("knowledge");
        signals.push("No project signal detected → fall back to searching the knowledge base");
      }
    }

    return { request, intents: [...intents], entities: e, signals };
  }

  /** Steps 3-4: turn the analysis into an ordered list of goals with argument resolvers. */
  createPlan(a: IntentAnalysis): Goal[] {
    const goals: Goal[] = [];
    const has = (i: Intent) => a.intents.includes(i);
    const e = a.entities;
    let n = 0;
    const add = (tool: string, goal: string, resolve: Goal["resolve"]) =>
      goals.push({ step: { id: `s${++n}`, tool, goal, status: "pending", origin: "initial" }, resolve });

    if (has("delayed_projects")) {
      add("get_delayed_projects", "Rank projects by schedule delay", () => ({
        args: { min_delay_days: e.minDelayDays, sort_by: e.superlative ? "delay_days" : e.sortBy },
        rationale: `Portfolio-level delay question${e.minDelayDays ? ` (≥ ${e.minDelayDays} days)` : ""}; this tool computes delay for every project.`,
      }));
      if (has("delay_calculation")) {
        add("calculate_project_delay", "Analyse the most delayed project", (ctx) => {
          const top = ctx.latest<DelayedProjectsResult>("get_delayed_projects")?.projects[0];
          return top
            ? { args: { project_id: top.id }, rationale: `Observation: ${top.id} ranks first (${top.delayDays} days). Computing its full delay breakdown.` }
            : { skip: "No delayed project was returned, nothing to analyse." };
        });
      }
    }

    if (e.projectIds.length) {
      const ids = e.projectIds;
      for (const id of ids) {
        const src = e.projectSource === "memory" ? " (resolved from conversation memory)" : "";
        if (has("project_details") || !has("delay_calculation")) {
          add("get_project_details", `Load the record for ${id}`, () => ({
            args: { project_id: id },
            rationale: `The request refers to ${id}${src}; details provide status, budget, milestones and risks.`,
          }));
        }
        if (has("delay_calculation")) {
          add("calculate_project_delay", `Calculate schedule delay for ${id}`, () => ({
            args: { project_id: id },
            rationale: `The request asks how late ${id} is${src}; computing days late and LD exposure.`,
          }));
        }
      }
    }

    if (has("project_search")) {
      add("search_projects", "Search the portfolio", () => ({
        args: {
          status: e.status,
          project_type: e.projectType,
          location: e.location,
          query: e.projectType || e.location || e.status ? undefined : searchKeywords(a.request),
        },
        rationale: "No single project is identified, so search the portfolio with the extracted filters.",
      }));
    }

    if (has("knowledge")) {
      add("search_knowledge_base", "Retrieve supporting document passages", (ctx) => {
        const project = ctx.focusProject();
        const mentioned = project && a.request.toLowerCase().includes(project.name.split(" ")[0].toLowerCase());
        const query = project && !mentioned ? `${a.request} ${project.id} ${project.name}` : a.request;
        return {
          args: { query, top_k: 4 },
          rationale: project && !mentioned
            ? `Document question in the context of ${project.id}; adding the project name to the BM25 query.`
            : "The answer depends on document content, so run BM25 retrieval over the knowledge base.",
        };
      });
    }
    return goals;
  }

  /** Step 8: decide the next action from the remaining goals and the observations so far. */
  nextAction(ctx: ExecutionContext): NextAction {
    for (const goal of ctx.goals) {
      if (goal.step.status !== "pending") continue;
      const r = goal.resolve(ctx);
      if ("skip" in r) {
        goal.step.status = "skipped";
        goal.step.note = r.skip;
        ctx.trace.add("replan", `Skipped: ${goal.step.goal}`, r.skip);
        continue;
      }
      return { type: "tool", goal, tool: goal.step.tool, args: stripUndefined(r.args), rationale: r.rationale };
    }
    return { type: "finish", reason: "All planned goals are complete." };
  }

  /** Step 7: read a tool result and add goals when the observation calls for it. */
  observe(ctx: ExecutionContext, call: ToolCallRecord): void {
    const has = (i: Intent) => ctx.analysis.intents.includes(i);
    if (call.status !== "success") return;

    if (call.tool === "search_projects") {
      const r = call.result as SearchProjectsResult;
      if (r.total === 1 && (has("project_details") || has("delay_calculation"))) {
        const id = r.projects[0].id;
        const insertAt = ctx.goals.findIndex((g) => g.step.status === "pending");
        const newGoals: Goal[] = [];
        if (has("project_details"))
          newGoals.push(this.replanGoal(ctx, "get_project_details", `Load the record for ${id}`, { project_id: id },
            `Observation: exactly one project matched (${id}), so load its details.`));
        if (has("delay_calculation"))
          newGoals.push(this.replanGoal(ctx, "calculate_project_delay", `Calculate schedule delay for ${id}`, { project_id: id },
            `Observation: exactly one project matched (${id}); compute its delay.`));
        ctx.goals.splice(insertAt === -1 ? ctx.goals.length : insertAt, 0, ...newGoals);
        ctx.trace.add("replan", "Plan extended", `Single match ${id} → added ${newGoals.map((g) => g.step.tool).join(", ")}`);
      }
    }

    if (call.tool === "search_knowledge_base") {
      const r = call.result as KnowledgeSearchResult;
      const retried = ctx.calls.filter((c) => c.tool === "search_knowledge_base").length > 1;
      const base = ctx.analysis.request;
      if (r.hits.length === 0 && !retried && r.query !== base) {
        ctx.goals.push(this.replanGoal(ctx, "search_knowledge_base", "Retry retrieval without project context",
          { query: base, top_k: 4 }, "Observation: the project-scoped query returned no chunks; retrying with the original wording."));
        ctx.trace.add("replan", "Plan extended", "No chunks for the enriched query → retry with the original question");
      }
    }
  }

  private replanGoal(ctx: ExecutionContext, tool: string, goal: string, args: ToolArgs, rationale: string): Goal {
    return {
      step: { id: `r${ctx.goals.length + 1}`, tool, goal, status: "pending", origin: "replan" },
      resolve: () => ({ args, rationale }),
    };
  }
}

function stripUndefined(args: ToolArgs): ToolArgs {
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
}

/** Keywords for free-text project search (drops question words and filler). */
export function searchKeywords(request: string): string | undefined {
  const cleaned = request
    .toLowerCase()
    .replace(/\b(find|search|list|show|which|what|are|is|the|all|any|how many|projects?|me|for|with|in|of|a|an|there|do|we|have|our|tell|about|details?)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : undefined;
}
