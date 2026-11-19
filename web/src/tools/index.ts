import { ToolRegistry } from "../agent/registry";
import { searchKnowledgeBase } from "./knowledgeTool";
import { calculateProjectDelay, getDelayedProjects, getProjectDetails, searchProjects } from "./projectTools";

export function createDefaultRegistry(): ToolRegistry {
  return new ToolRegistry()
    .register(searchProjects)
    .register(getProjectDetails)
    .register(getDelayedProjects)
    .register(calculateProjectDelay)
    .register(searchKnowledgeBase);
}
