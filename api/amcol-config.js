function getAmcolConfig() {
    const env = typeof process !== "undefined" && process.env ? process.env : {};

    return {
        mapboxToken: env.MAPBOX_PUBLIC_TOKEN || "",
        supabaseUrl: env.SUPABASE_URL || "",
        supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY || ""
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = function handler(_req, res) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.status(200).send(
            "window.AMCOL_CONFIG = Object.assign({}, window.AMCOL_CONFIG || {}, " +
            JSON.stringify(getAmcolConfig()) +
            ");"
        );
    };
} else if (typeof window !== "undefined") {
    window.AMCOL_CONFIG = Object.assign({}, window.AMCOL_CONFIG || {}, getAmcolConfig());
}
