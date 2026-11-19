import { ToolError, type ToolDefinition } from "../agent/types";
import { isStopword, stem, words } from "../rag/text";
import {
  AS_OF_DATE,
  PROJECTS,
  PROJECT_STATUSES,
  computeDelay,
  findProject,
  summarize,
  type DelayAnalysis,
  type Project,
  type ProjectSummary,
} from "./projectData";

export const STATE_NAMES: Record<string, string> = {
  CA: "california",
  WA: "washington",
  ID: "idaho",
  OH: "ohio",
  TX: "texas",
  CO: "colorado",
  AZ: "arizona",
  WI: "wisconsin",
  NC: "north carolina",
};

const PROJECT_ID_PATTERN = "^[Bb][Mm]-?\\d{3}$";
const GENERIC_QUERY_WORDS = new Set(["project", "projects", "job", "jobs", "site", "sites", "construction"]);

function haystack(p: Project): Set<string> {
  const text = [p.id, p.name, p.type, p.client, p.city, p.state, STATE_NAMES[p.state], p.description, p.projectManager, p.generalContractor].join(" ");
  return new Set(words(text).map(stem));
}

function matchesLocation(p: Project, location: string): boolean {
  const loc = location.trim().toLowerCase();
  return p.city.toLowerCase() === loc || p.state.toLowerCase() === loc || STATE_NAMES[p.state] === loc;
}

// ---------------------------------------------------------------- search_projects

export interface SearchProjectsResult {
  filters: Record<string, string | number>;
  total: number;
  projects: (ProjectSummary & { matchScore: number })[];
}

export const searchProjects: ToolDefinition<SearchProjectsResult> = {
  name: "search_projects",
  description:
    "Search the construction project portfolio by free-text query (name, client, description, people) and optional status, type and location filters.",
  category: "projects",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text keywords, e.g. 'hospital' or 'Granite Peak'", maxLength: 120 },
      status: { type: "string", description: "Filter by project status", enum: PROJECT_STATUSES },
      project_type: { type: "string", description: "Filter by project type, e.g. Healthcare, Infrastructure", maxLength: 40 },
      location: { type: "string", description: "City, state code or state name, e.g. 'Seattle', 'NC'", maxLength: 40 },
      limit: { type: "integer", description: "Maximum results", minimum: 1, maximum: 10, default: 10 },
    },
    required: [],
    additionalProperties: false,
  },
  execute(args) {
    const query = (args.query as string | undefined) ?? "";
    const terms = words(query)
      .filter((w) => !isStopword(w) && !GENERIC_QUERY_WORDS.has(w))
      .map(stem);
    const filters: Record<string, string | number> = {};
    for (const k of ["query", "status", "project_type", "location"]) if (args[k] !== undefined) filters[k] = args[k] as string;

    const results = PROJECTS.flatMap((p) => {
      if (args.status && p.status !== args.status) return [];
      if (args.project_type && !p.type.toLowerCase().includes((args.project_type as string).toLowerCase())) return [];
      if (args.location && !matchesLocation(p, args.location as string)) return [];
      let score = 1;
      if (terms.length) {
        const hay = haystack(p);
        const matched = terms.filter((t) => hay.has(t)).length;
        if (matched === 0) return [];
        score = Math.round((matched / terms.length) * 100) / 100;
      }
      return [{ ...summarize(p), matchScore: score }];
    }).sort((a, b) => b.matchScore - a.matchScore || a.id.localeCompare(b.id));

    return { filters, total: results.length, projects: results.slice(0, args.limit as number) };
  },
  summarize: (r) =>
    r.total === 0 ? "No projects matched." : `${r.total} project(s) matched: ${r.projects.map((p) => p.id).join(", ")}`,
};

// ---------------------------------------------------------------- get_project_details

export interface ProjectDetailsResult {
  project: Project;
  delay: Pick<DelayAnalysis, "delayDays" | "completionDate" | "completionBasis" | "timeElapsedPercent" | "progressGapPoints">;
  budgetUsedPercent: number;
}

function requireProject(id: string): Project {
  const p = findProject(id);
  if (!p) {
    throw new ToolError(`Project "${id}" was not found.`, `Valid ids are ${PROJECTS[0].id} to ${PROJECTS[PROJECTS.length - 1].id}.`);
  }
  return p;
}

export const getProjectDetails: ToolDefinition<ProjectDetailsResult> = {
  name: "get_project_details",
  description: "Return the full record for one project: schedule, budget, milestones, risks, team and contract terms.",
  category: "projects",
  parameters: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "Project id, e.g. BM-101", pattern: PROJECT_ID_PATTERN },
    },
    required: ["project_id"],
    additionalProperties: false,
  },
  execute(args) {
    const project = requireProject(args.project_id as string);
    const d = computeDelay(project);
    return {
      project,
      delay: {
        delayDays: d.delayDays,
        completionDate: d.completionDate,
        completionBasis: d.completionBasis,
        timeElapsedPercent: d.timeElapsedPercent,
        progressGapPoints: d.progressGapPoints,
      },
      budgetUsedPercent: Math.round((project.costToDate / project.contractValue) * 1000) / 10,
    };
  },
  summarize: (r) =>
    `${r.project.id} ${r.project.name}: ${r.project.status}, ${r.project.percentComplete}% complete, ${r.project.milestones.length} milestones, ${r.project.risks.length} risks`,
};

// ---------------------------------------------------------------- get_delayed_projects

export interface DelayedProjectsResult {
  asOfDate: string;
  minDelayDays: number;
  count: number;
  totalExposure: number;
  projects: {
    id: string;
    name: string;
    status: string;
    delayDays: number;
    plannedCompletion: string;
    forecastCompletion: string;
    liquidatedDamagesExposure: number;
    recoveryScheduleRequired: boolean;
  }[];
}

export const getDelayedProjects: ToolDefinition<DelayedProjectsResult> = {
  name: "get_delayed_projects",
  description:
    "List projects whose forecast (or actual) completion is later than the contractual completion date, most delayed first.",
  category: "projects",
  parameters: {
    type: "object",
    properties: {
      min_delay_days: { type: "integer", description: "Only include projects at least this many days late", minimum: 1, maximum: 1000, default: 1 },
      include_completed: { type: "boolean", description: "Include projects that already finished late", default: false },
      sort_by: { type: "string", description: "Sort order", enum: ["delay_days", "ld_exposure"], default: "delay_days" },
    },
    required: [],
    additionalProperties: false,
  },
  execute(args) {
    const min = args.min_delay_days as number;
    const rows = PROJECTS.filter((p) => args.include_completed || p.status !== "Completed")
      .map((p) => ({ p, d: computeDelay(p) }))
      .filter(({ d }) => d.delayDays >= min)
      .map(({ p, d }) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        delayDays: d.delayDays,
        plannedCompletion: d.plannedCompletion,
        forecastCompletion: d.completionDate,
        liquidatedDamagesExposure: d.liquidatedDamagesExposureCapped,
        recoveryScheduleRequired: d.recoveryScheduleRequired,
      }));
    const key = args.sort_by === "ld_exposure" ? "liquidatedDamagesExposure" : "delayDays";
    rows.sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id));
    return {
      asOfDate: AS_OF_DATE,
      minDelayDays: min,
      count: rows.length,
      totalExposure: rows.reduce((s, r) => s + r.liquidatedDamagesExposure, 0),
      projects: rows,
    };
  },
  summarize: (r) =>
    r.count === 0
      ? `No projects are ${r.minDelayDays}+ days late.`
      : `${r.count} delayed project(s); most delayed ${r.projects[0].id} (${r.projects[0].delayDays} days)`,
};

// ---------------------------------------------------------------- calculate_project_delay

export const calculateProjectDelay: ToolDefinition<DelayAnalysis> = {
  name: "calculate_project_delay",
  description:
    "Calculate schedule delay for a project: days late vs. contract date, milestone slippage, progress vs. time elapsed and liquidated-damages exposure (capped at 10% of contract value).",
  category: "projects",
  parameters: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "Project id, e.g. BM-107", pattern: PROJECT_ID_PATTERN },
      as_of_date: { type: "string", description: "Reporting date (YYYY-MM-DD)", pattern: "^\\d{4}-\\d{2}-\\d{2}$", default: AS_OF_DATE },
    },
    required: ["project_id"],
    additionalProperties: false,
  },
  execute(args) {
    const project = requireProject(args.project_id as string);
    try {
      return computeDelay(project, args.as_of_date as string);
    } catch (e) {
      throw new ToolError((e as Error).message);
    }
  },
  summarize: (d) =>
    d.delayDays > 0
      ? `${d.projectId} is ${d.delayDays} days late; LD exposure $${d.liquidatedDamagesExposureCapped.toLocaleString("en-US")}`
      : `${d.projectId} is ${d.delayDays === 0 ? "on schedule" : `${-d.delayDays} days ahead of schedule`}`,
};
