export type ToolCategory = "scanners" | "ai-tools" | "learning" | "research";

export interface ToolDefinition {
  id: string;
  category: ToolCategory;
  href: string;
  title: string;
  description: string;
  detail: string;
  icon: "shield" | "scan" | "book";
}

export const toolCategories = [
  { id: "all", label: "All tools" },
  { id: "scanners", label: "Scanners" },
  { id: "ai-tools", label: "AI Tools" },
  { id: "learning", label: "Learning" },
  { id: "research", label: "Research" },
] as const;

export const tools: readonly ToolDefinition[] = [
  {
    id: "email-analyzer",
    category: "ai-tools",
    href: "/tools/email-analyzer",
    title: "AI Email Analyzer",
    description: "Inspect suspicious emails for phishing signals.",
    detail:
      "Paste an email to examine its language, links, and other signs of a potential threat.",
    icon: "shield",
  },
  {
    id: "headers-scanner",
    category: "scanners",
    href: "/tools/headers-scanner",
    title: "Security Headers Scanner",
    description: "Check a website’s HTTP security headers.",
    detail:
      "Enter a URL to review its response headers, identify missing protections, and find practical fixes.",
    icon: "scan",
  },
  {
    id: "owasp-llm-top-10",
    category: "learning",
    href: "/tools/owasp-llm-top-10",
    title: "OWASP LLM Top 10",
    description: "Explore the most common risks in LLM applications.",
    detail:
      "Work through ten AI security risks with examples, attack scenarios, and mitigation guidance.",
    icon: "book",
  },
  {
    id: "research-workbench",
    category: "research",
    href: "/tools/research-workbench",
    title: "Research Workbench",
    description: "Turn a test attempt into a private reproduction record.",
    detail:
      "Record scope, exact input, observations, and repeat attempts in this session. Export a private Markdown or JSON file; no account or model API is required.",
    icon: "book",
  },
];
