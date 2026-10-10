"use client";

import { useState } from "react";
import Link from "next/link";
import { ToolCard } from "@/components/ui/ToolCard";
import { ShieldIcon, ScanIcon, BookIcon } from "@/components/ui/icons";
import { tools, toolCategories, type ToolCategory } from "@/data/tools";
import styles from "./ToolsCatalog.module.css";

const icons = {
  shield: <ShieldIcon />,
  scan: <ScanIcon />,
  book: <BookIcon />,
};

export default function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const searchedTools = tools.filter((tool) => {
    const category = toolCategories.find(
      (item) => item.id === tool.category,
    )?.label;
    return [tool.title, tool.description, tool.detail, category]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const filteredTools = searchedTools.filter(
    (tool) => activeCategory === "all" || tool.category === activeCategory,
  );
  const hasFilters = query !== "" || activeCategory !== "all";

  function resetFilters() {
    setQuery("");
    setActiveCategory("all");
  }

  return (
    <div className={`site-container ${styles.page}`}>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Tools</span>
      </nav>

      <header className={styles.intro}>
        <div>
          <p className="eyebrow">The open toolkit</p>
          <h1 className="page-title">The security toolkit.</h1>
          <p className="page-description">
            Practical tools for checking web security, inspecting suspicious
            email, understanding risks in AI systems, and documenting research. Free to use, whenever
            you need them.
          </p>
        </div>
        <p className={styles.toolCount}>
          <span>{String(tools.length).padStart(2, "0")}</span>
          <span>tools available</span>
        </p>
      </header>

      <section className={styles.catalog} aria-label="Browse security tools">
        <div className={styles.controls}>
          <div
            className={styles.categories}
            role="group"
            aria-label="Filter tools by category"
          >
            {toolCategories.map((category) => {
              const count = searchedTools.filter(
                (tool) =>
                  category.id === "all" || tool.category === category.id,
              ).length;

              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={styles.category}
                >
                  {category.label}
                  <span
                    aria-label={`${count} ${count === 1 ? "tool" : "tools"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.search}>
            <label htmlFor="tool-search">Find a tool</label>
            <div className={styles.searchField}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                id="tool-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or task"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className={styles.resultBar}>
          <p role="status" aria-live="polite" aria-atomic="true">
            {filteredTools.length}{" "}
            {filteredTools.length === 1 ? "tool" : "tools"}
            {normalizedQuery && <> matching “{query.trim()}”</>}
          </p>
          {hasFilters && (
            <button type="button" onClick={resetFilters}>
              Clear filters <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>

        {filteredTools.length > 0 ? (
          <ol className={styles.toolList}>
            {filteredTools.map((tool) => (
              <li key={tool.id}>
                <ToolCard
                  icon={icons[tool.icon]}
                  number={tools.indexOf(tool) + 1}
                  category={
                    toolCategories.find((item) => item.id === tool.category)
                      ?.label
                  }
                  title={tool.title}
                  description={tool.description}
                  detail={tool.detail}
                  href={tool.href}
                  status="live"
                  headingLevel={2}
                />
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.emptyState}>
            <p className="eyebrow">No matches</p>
            <h2>No tools match these filters.</h2>
            <p>
              Try a broader search, or clear the filters to see the full
              toolkit.
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={resetFilters}
            >
              View all tools
            </button>
          </div>
        )}

        <div className={styles.catalogNote}>
          <span className="eyebrow">Built in the open</span>
          <p>Small, focused utilities. Real tasks. No subscription required.</p>
        </div>
      </section>
    </div>
  );
}
