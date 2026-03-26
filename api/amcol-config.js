module.exports = function handler(_req, res) {
    const config = {
        mapboxToken: process.env.MAPBOX_PUBLIC_TOKEN || "",
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || ""
    };

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(
        "window.AMCOL_CONFIG = Object.assign({}, window.AMCOL_CONFIG || {}, " +
        JSON.stringify(config) +
        ");"
    );
};
