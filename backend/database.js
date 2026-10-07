const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync("./product-video-dashboard.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS searches (
        id TEXT PRIMARY KEY,
        product_url TEXT,
        product_name TEXT,
        status TEXT NOT NULL,
        progress TEXT NOT NULL DEFAULT '[]',
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS videos (
        video_key TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        video_id TEXT,
        video_url TEXT NOT NULL,
        thumbnail TEXT,
        caption TEXT,
        match_score REAL,
        match_reason TEXT,
        search_id TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_videos_platform
    ON videos(platform);

    CREATE INDEX IF NOT EXISTS idx_videos_search
    ON videos(search_id);
`);

function saveSearch(search) {
    const statement = db.prepare(`
        INSERT OR REPLACE INTO searches (
            id,
            product_url,
            product_name,
            status,
            progress,
            result,
            error,
            created_at,
            started_at,
            completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
        search.id,
        search.input?.productUrl || null,
        search.input?.productName || null,
        search.status,
        JSON.stringify(search.progress || []),
        search.result
            ? JSON.stringify(search.result)
            : null,
        search.error
            ? JSON.stringify(search.error)
            : null,
        search.createdAt,
        search.startedAt || null,
        search.completedAt || null
    );
}

function getSearch(id) {
    const statement = db.prepare(`
        SELECT *
        FROM searches
        WHERE id = ?
    `);

    const row = statement.get(id);

    if (!row) {
        return null;
    }

    return {
        id: row.id,

        input: {
            productUrl: row.product_url,
            productName: row.product_name
        },

        status: row.status,

        progress: JSON.parse(row.progress || "[]"),

        result: row.result
            ? JSON.parse(row.result)
            : null,

        error: row.error
            ? JSON.parse(row.error)
            : null,

        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at
    };
}

function getSearchHistory() {
    const statement = db.prepare(`
        SELECT
            id,
            product_url,
            product_name,
            status,
            created_at,
            completed_at,
            result
        FROM searches
        ORDER BY created_at DESC
    `);

    return statement.all().map(row => {
        const result = row.result
            ? JSON.parse(row.result)
            : null;

        return {
            id: row.id,

            input: {
                productUrl: row.product_url,
                productName: row.product_name
            },

            status: row.status,

            createdAt: row.created_at,

            completedAt: row.completed_at,

            counts: result?.counts || {
                instagram: 0,
                meta: 0
            }
        };
    });
}

function videoAlreadySeen(videoKey) {
    const statement = db.prepare(`
        SELECT video_key
        FROM videos
        WHERE video_key = ?
    `);

    return Boolean(statement.get(videoKey));
}

function saveVideo(video, searchId) {
    const videoKey =
        video.videoId
            ? `${video.platform}:${video.videoId}`
            : `${video.platform}:${video.videoUrl}`;

    const now = new Date().toISOString();

    const statement = db.prepare(`
        INSERT INTO videos (
            video_key,
            platform,
            video_id,
            video_url,
            thumbnail,
            caption,
            match_score,
            match_reason,
            search_id,
            first_seen_at,
            last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(video_key)
        DO UPDATE SET
            last_seen_at = excluded.last_seen_at,
            match_score = excluded.match_score,
            match_reason = excluded.match_reason
    `);

    statement.run(
        videoKey,
        video.platform,
        video.videoId || null,
        video.videoUrl,
        video.thumbnail || null,
        video.caption || "",
        typeof video.matchScore === "number"
            ? video.matchScore
            : null,
        video.matchReason || null,
        searchId || null,
        now,
        now
    );

    return videoKey;
}

module.exports = {
    db,
    saveSearch,
    getSearch,
    getSearchHistory,
    videoAlreadySeen,
    saveVideo
};