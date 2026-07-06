# AMCOL Haulage SEO Implementation Notes

## Completed

- Updated page titles and meta descriptions to target AMCOL Haulage, heavy transport, heavy haulage, abnormal load transport, industrial logistics and Trinidad keywords.
- Added canonical URLs and `hreflang="en-TT"` links to public pages.
- Added robots directives for public pages and noindex directives for admin pages.
- Added Open Graph and Twitter card metadata, including a share image.
- Added JSON-LD Organization, LocalBusiness and WebSite schema to `index.html`.
- Added semantic local business details to the homepage for address, phone, services and location clarity.
- Added `robots.txt` and `sitemap.xml`.
- Added `llms.txt` for AI/GEO discovery.
- Added optional GA4 support through `GA4_MEASUREMENT_ID` in Vercel environment variables.
- Added `ga4MeasurementId` to `/api/amcol-config` output.
- Fixed Mapbox config loading in `coverage.html` to use `/api/amcol-config`.
- Optimized large PNG image assets into WebP and updated HTML/CSS references.
- Removed unused large PNG image files after confirming references were migrated to WebP.
- Fixed admin page asset paths so pages inside `/admin/` correctly reference `../assets/`.

## Recommended manual items

- Add the site to Google Search Console and submit `https://www.caribbeantransportservices.com/sitemap.xml`.
- Add `GA4_MEASUREMENT_ID` in Vercel if you want Google Analytics tracking.
- Create or connect Google Business Profile and link it to this website.
- Add real social profile URLs once Facebook, Instagram, LinkedIn or YouTube pages exist.
- Add SPF record with your domain/email provider if the domain sends email.
- Build backlinks from AMCOL Group pages, industry directories, Google Business Profile, and partner/vendor websites.
