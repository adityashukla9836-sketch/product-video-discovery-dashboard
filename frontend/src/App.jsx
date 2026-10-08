import { useEffect, useMemo, useState } from "react";
import "./index.css";

const API_BASE = "http://localhost:3000";

function App() {
  const [searchType, setSearchType] = useState("url");
  const [input, setInput] = useState("");
  const [showPreviouslySeen, setShowPreviouslySeen] = useState(false);

  const [searchId, setSearchId] = useState(null);
  const [search, setSearch] = useState(null);

  const [activeTab, setActiveTab] = useState("instagram");
  const [sortBy, setSortBy] = useState("score");
  const [minScore, setMinScore] = useState(0);

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load history
  // --------------------------------------------------

  async function loadHistory() {
    try {
      const response = await fetch(`${API_BASE}/api/history`);

      if (!response.ok) {
        throw new Error("Failed to load history.");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("History error:", err);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // --------------------------------------------------
  // Poll search status
  // --------------------------------------------------

  useEffect(() => {
    if (!searchId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/search/${searchId}`
        );

        const data = await response.json();

        if (!cancelled) {
          setSearch(data.search);

          if (
            data.search.status === "completed" ||
            data.search.status === "failed"
          ) {
            setLoading(false);
            loadHistory();
            return;
          }
        }

        setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) {
          setError("Unable to read search status.");
          setLoading(false);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [searchId]);

  // --------------------------------------------------
  // Start search
  // --------------------------------------------------

  async function startSearch() {
    setError("");

    if (!input.trim()) {
      setError(
        searchType === "url"
          ? "Please enter a product URL."
          : "Please enter a product name."
      );
      return;
    }

    setLoading(true);
    setSearch(null);
    setSearchId(null);

    try {
      const body =
        searchType === "url"
          ? {
              productUrl: input.trim(),
              showPreviouslySeen
            }
          : {
              productName: input.trim(),
              showPreviouslySeen
            };

      const response = await fetch(
        `${API_BASE}/api/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to start search."
        );
      }

      setSearchId(data.searchId);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // Current results
  // --------------------------------------------------

  const videos = useMemo(() => {
  const result = search?.result;

  if (!result) {
    return [];
  }

  const list =
    activeTab === "instagram"
      ? result.instagram || []
      : result.meta || [];

  const filtered = list.filter(video => {
    // Name-only searches have no visual score.
    // Still show those videos when "All" is selected.
    if (video.matchScore === null || video.matchScore === undefined) {
      return minScore === 0;
    }

    return Number(video.matchScore) >= minScore;
  });

  return filtered.sort((a, b) => {
    if (sortBy === "score") {
      return (
        Number(b.matchScore ?? -1) -
        Number(a.matchScore ?? -1)
      );
    }

    if (sortBy === "newest") {
      return (
        new Date(b.startDate || 0) -
        new Date(a.startDate || 0)
      );
    }

    return 0;
  });
}, [search, activeTab, minScore, sortBy]);
  const instagramCount =
    search?.result?.counts?.instagram || 0;

  const metaCount =
    search?.result?.counts?.meta || 0;

  const progress =
    search?.progress || [];

  const lastProgress =
    progress[progress.length - 1];

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="app-shell">

      <header className="topbar">
        <div>
          <div className="brand">
            Product Video Discovery
          </div>

          <div className="subtitle">
            AI-powered product video research dashboard
          </div>
        </div>

        <div className="status-pill">
          {search?.status || "Ready"}
        </div>
      </header>

      <main className="main-content">

        {/* Search section */}

        <section className="search-panel">

          <div className="search-tabs">

            <button
              className={
                searchType === "url"
                  ? "search-tab active"
                  : "search-tab"
              }
              onClick={() =>
                setSearchType("url")
              }
            >
              Product URL
            </button>

            <button
              className={
                searchType === "name"
                  ? "search-tab active"
                  : "search-tab"
              }
              onClick={() =>
                setSearchType("name")
              }
            >
              Product Name
            </button>

          </div>

          <div className="search-row">

            <input
              value={input}
              onChange={e =>
                setInput(e.target.value)
              }
              onKeyDown={e => {
                if (e.key === "Enter") {
                  startSearch();
                }
              }}
              placeholder={
                searchType === "url"
                  ? "Paste a product URL..."
                  : "Enter product name..."
              }
            />

            <button
              className="search-button"
              onClick={startSearch}
              disabled={loading}
            >
              {loading
                ? "Searching..."
                : "Find Videos"}
            </button>

          </div>

          <label className="toggle-row">

            <input
              type="checkbox"
              checked={showPreviouslySeen}
              onChange={e =>
                setShowPreviouslySeen(
                  e.target.checked
                )
              }
            />

            Show previously seen videos

          </label>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

        </section>

        {/* Product panel */}

        {search?.result?.product && (
          <section className="product-panel">

            <img
              src={
                search.result.product.image
              }
              alt={
                search.result.product.title
              }
            />

            <div>
              <div className="section-label">
                Product
              </div>

              <h2>
                {search.result.product.title}
              </h2>

              <p>
                {search.result.product.description ||
                  "Product description unavailable."}
              </p>

              {/* Gemini-detected attributes (change #1) */}
              {search.result.analysis && (
                <div className="analysis-section">
                  <div className="section-label" style={{ marginTop: 14 }}>
                    AI-Detected Attributes
                  </div>

                  <div className="analysis-grid">

                    {search.result.analysis.productType && (
                      <div className="attr-row">
                        <span className="attr-label">Type</span>
                        <span className="attr-value">
                          {search.result.analysis.productType}
                        </span>
                      </div>
                    )}

                    {Array.isArray(search.result.analysis.colors) &&
                      search.result.analysis.colors.length > 0 && (
                      <div className="attr-row">
                        <span className="attr-label">Colors</span>
                        <div className="attr-chips">
                          {search.result.analysis.colors.map((c, i) => (
                            <span className="attr-chip" key={i}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(search.result.analysis.graphics) &&
                      search.result.analysis.graphics.length > 0 && (
                      <div className="attr-row">
                        <span className="attr-label">Graphics</span>
                        <div className="attr-chips">
                          {search.result.analysis.graphics.map((g, i) => (
                            <span className="attr-chip" key={i}>{g}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(search.result.analysis.logos) &&
                      search.result.analysis.logos.length > 0 && (
                      <div className="attr-row">
                        <span className="attr-label">Logos</span>
                        <div className="attr-chips">
                          {search.result.analysis.logos.map((l, i) => (
                            <span className="attr-chip" key={i}>{l}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(search.result.analysis.text) &&
                      search.result.analysis.text.length > 0 && (
                      <div className="attr-row">
                        <span className="attr-label">Visible Text</span>
                        <div className="attr-chips">
                          {search.result.analysis.text.map((t, i) => (
                            <span className="attr-chip" key={i}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {search.result.analysis.material && (
                      <div className="attr-row">
                        <span className="attr-label">Material</span>
                        <span className="attr-value">
                          {search.result.analysis.material}
                        </span>
                      </div>
                    )}

                    {search.result.analysis.shape && (
                      <div className="attr-row">
                        <span className="attr-label">Shape / Fit</span>
                        <span className="attr-value">
                          {search.result.analysis.shape}
                        </span>
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>

          </section>
        )}

        {/* Progress */}

        {(loading || progress.length > 0) && (
          <section className="progress-panel">

            <div className="progress-header">
              <strong>
                Search Progress
              </strong>

              <span>
                {search?.status || "running"}
              </span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width:
                    search?.status ===
                    "completed"
                      ? "100%"
                      : "55%"
                }}
              />
            </div>

            <div className="progress-message">
              {lastProgress?.message ||
                "Starting search..."}
            </div>

            <div className="progress-steps">

              {progress.map(
                (step, index) => (
                  <div
                    className="progress-step"
                    key={`${step.step}-${index}`}
                  >
                    <span className="step-dot">
                      ✓
                    </span>

                    <span>
                      {step.message}
                    </span>
                  </div>
                )
              )}

            </div>

          </section>
        )}

        {/* Results */}

        {search?.status === "completed" && (
          <>

            <section className="results-summary">

              <div>
                <span className="summary-label">
                  Instagram
                </span>

                <strong>
                  {instagramCount}
                </strong>
              </div>

              <div>
                <span className="summary-label">
                  Meta
                </span>

                <strong>
                  {metaCount}
                </strong>
              </div>

              <div>
                <span className="summary-label">
                  Total
                </span>

                <strong>
                  {instagramCount +
                    metaCount}
                </strong>
              </div>

            </section>

            <section className="results-panel">

              <div className="results-toolbar">

                <div className="platform-tabs">

                  <button
                    className={
                      activeTab ===
                      "instagram"
                        ? "platform-tab active"
                        : "platform-tab"
                    }
                    onClick={() =>
                      setActiveTab(
                        "instagram"
                      )
                    }
                  >
                    Instagram
                  </button>

                  <button
                    className={
                      activeTab === "meta"
                        ? "platform-tab active"
                        : "platform-tab"
                    }
                    onClick={() =>
                      setActiveTab("meta")
                    }
                  >
                    Meta Ads
                  </button>

                </div>

                <div className="filters">

                  <label>
                    Minimum score

                    <select
                      value={minScore}
                      onChange={e =>
                        setMinScore(
                          Number(
                            e.target.value
                          )
                        )
                      }
                    >
                      <option value={0}>
                        All
                      </option>
                      <option value={50}>
                        50+
                      </option>
                      <option value={60}>
                        60+
                      </option>
                      <option value={75}>
                        75+
                      </option>
                    </select>
                  </label>

                  <label>
                    Sort

                    <select
                      value={sortBy}
                      onChange={e =>
                        setSortBy(
                          e.target.value
                        )
                      }
                    >
                      <option value="score">
                        Match score
                      </option>

                      <option value="newest">
                        Newest
                      </option>
                    </select>
                  </label>

                </div>

              </div>

              {videos.length === 0 ? (
                <div className="empty-state">
                  No videos match the current filter.
                </div>
              ) : (
                <div className="video-grid">

                  {videos.map(
                    (video, index) => (
                      <article
                        className="video-card"
                        key={
                          video.videoId ||
                          `${video.platform}-${index}`
                        }
                      >

                        <div className="thumbnail-wrap">

                          {video.thumbnail ? (
                            <img
                              src={
                                video.thumbnail
                              }
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <div className="no-image">
                              No thumbnail
                            </div>
                          )}

                          {typeof video.matchScore ===
                            "number" && (
                            <div className="score-badge">
                              {video.matchScore}
                            </div>
                          )}

                        </div>

                        <div className="card-body">

                          <div className="card-topline">

                            <span className="platform-label">
                              {video.platform ===
                              "instagram"
                                ? "Instagram"
                                : "Meta Ads"}
                            </span>

                            {video.previouslySeen && (
                              <span className="seen-label">
                                Previously seen
                              </span>
                            )}

                          </div>

                          <div className="card-caption">
                            {video.caption ||
                              "No caption available."}
                          </div>

                          {video.matchReason && (
                            <div className="match-reason">
                              {video.matchReason}
                            </div>
                          )}

                          <a
                            href={
                              video.platform ===
                              "meta"
                                ? video.adLibraryUrl ||
                                  video.videoUrl
                                : video.videoUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="view-button"
                          >
                            Open Video
                          </a>

                        </div>

                      </article>
                    )
                  )}

                </div>
              )}

            </section>

          </>
        )}

        {/* Error result */}

        {search?.status === "failed" && (
          <section className="error-box large">
            {search.error?.message ||
              "Search failed."}
          </section>
        )}

        {/* History */}

        <section className="history-panel">

          <div className="section-heading">
            Search History
          </div>

          {history.length === 0 ? (
            <div className="history-empty">
              No searches yet.
            </div>
          ) : (
            <div className="history-list">

              {history.slice(0, 10).map(
                item => (
                  <button
                    className="history-item"
                    key={item.id}
                    onClick={() => {
                      setSearchId(item.id);
                    }}
                  >

                    <div>
                      <strong>
                        {item.input.productName ||
                          item.input.productUrl ||
                          "Search"}
                      </strong>

                      <span>
                        {new Date(
                          item.createdAt
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="history-count">
                      {item.counts.instagram} IG
                      {" · "}
                      {item.counts.meta} Meta
                    </div>

                  </button>
                )
              )}

            </div>
          )}

        </section>

      </main>

    </div>
  );
}

export default App;