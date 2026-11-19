import { useEffect, useState } from "react";

export type Route =
  | { page: "dashboard" }
  | { page: "assistant"; ask?: string }
  | { page: "knowledge" }
  | { page: "projects"; id?: string }
  | { page: "trace"; id?: string }
  | { page: "architecture" };

/** Hash routing keeps the app fully static (works on Vercel and GitHub Pages without rewrites). */
export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [page, id] = path.split("/");
  const params = new URLSearchParams(query);
  switch (page) {
    case "assistant":
      return { page, ask: params.get("ask") ?? undefined };
    case "knowledge":
    case "architecture":
      return { page };
    case "projects":
      return { page, id: id ? decodeURIComponent(id) : undefined };
    case "trace":
      return { page, id: id ? decodeURIComponent(id) : undefined };
    default:
      return { page: "dashboard" };
  }
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith("#") ? path : `#/${path.replace(/^\//, "")}`;
}

export function askHref(question: string): string {
  return `#/assistant?ask=${encodeURIComponent(question)}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
