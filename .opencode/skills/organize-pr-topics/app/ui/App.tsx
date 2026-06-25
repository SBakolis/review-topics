import { useCallback, useEffect, useState } from "react";
import type { ReviewSession, ReviewTopic } from "../shared/schema";
import { TopicSidebar } from "./components/TopicSidebar";
import { DiffReview } from "./components/DiffReview";
import { HandoffPanel } from "./components/HandoffPanel";
import { type Theme, getInitialTheme, writeStoredTheme } from "./theme";

export function App() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [topic, setTopic] = useState<ReviewTopic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  const loadSession = useCallback(() => {
    fetch("/api/session")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load session (HTTP ${response.status}).`);
        }
        return response.json();
      })
      .then((nextSession: ReviewSession) => {
        setSession(nextSession);
        setTopic((current) =>
          current
            ? (nextSession.topics.find((next) => next.id === current.id) ??
              nextSession.topics[0] ??
              null)
            : (nextSession.topics[0] ?? null),
        );
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      writeStoredTheme(next);
      return next;
    });
  }

  if (error) {
    return <main className="loading">Failed to load session: {error}</main>;
  }

  if (!session || !topic) {
    return <main className="loading">Loading PR review session...</main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>{session.pr.title}</h1>
          <a href={session.pr.url} target="_blank" rel="noreferrer">
            #{session.pr.number} on GitHub
          </a>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} type="button">
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </header>
      <div className="review-layout">
        <TopicSidebar
          topics={session.topics}
          selectedTopicId={topic.id}
          comments={session.comments}
          onSelect={setTopic}
        />
        <section className="review-main">
          <h2>{topic.title}</h2>
          <p className="topic-summary">{topic.summary}</p>
          <DiffReview session={session} theme={theme} topic={topic} onCommentSaved={loadSession} />
          <HandoffPanel />
        </section>
      </div>
    </main>
  );
}
