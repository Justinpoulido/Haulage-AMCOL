const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            success: false,
            error: "Method not allowed."
        });
    }

    try {
        const payload =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;

        if (!payload || typeof payload !== "object") {
            return res.status(400).json({
                success: false,
                error: "Invalid request data."
            });
        }

        const requiredFields = [
            "company_name",
            "contact_name",
            "email",
            "phone",
            "pickup_location",
            "delivery_point"
        ];

        const missingFields = requiredFields.filter((field) => {
            return !String(payload[field] || "").trim();
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(", ")}`
            });
        }

        /*
         * Only accept fields expected by the service_requests table.
         * This prevents arbitrary browser data from being inserted.
         */
        const requestRecord = {
            company_name: cleanText(payload.company_name),
            contact_name: cleanText(payload.contact_name),
            email: cleanText(payload.email),
            phone: cleanText(payload.phone),
            service: cleanText(payload.service || "Standby Unit"),
            status: "New",
            pickup_location: cleanText(payload.pickup_location),
            delivery_point: cleanText(payload.delivery_point),

            requested_dispatch_time:
                payload.requested_dispatch_time || null,

            site_restrictions:
                cleanText(payload.site_restrictions || "None"),

            cargo_type: cleanText(payload.cargo_type),

            estimated_weight_kg:
                typeof payload.estimated_weight_kg === "number" &&
                Number.isFinite(payload.estimated_weight_kg)
                    ? payload.estimated_weight_kg
                    : null,

            asset_preference:
                cleanText(payload.asset_preference || "Dry Van"),

            cargo_priority:
                cleanText(payload.cargo_priority || "Standard"),

            special_handling_notes:
                cleanOptionalText(payload.special_handling_notes),

            billing_contact_email:
                cleanText(payload.billing_contact_email || payload.email),

            dispatch_eta_recipient:
                cleanText(payload.dispatch_eta_recipient),

            on_site_coordinator:
                cleanText(payload.on_site_coordinator),

            direct_phone:
                cleanText(payload.direct_phone || payload.phone),

            message:
                cleanOptionalText(payload.message),

            request_status: "submitted",
            submission_page: "request.html",

            client_reference:
                cleanText(payload.client_reference),

            metadata: {
                source: "website-request-form",
                path: cleanText(payload.metadata?.path || "/request.html"),
                user_agent: cleanText(
                    payload.metadata?.user_agent ||
                    req.headers["user-agent"] ||
                    ""
                )
            }
        };

        /*
         * Save to Supabase first.
         * The database remains the primary record.
         */
        const { data: savedRequest, error: databaseError } = await supabase
            .from("service_requests")
            .insert(requestRecord)
            .select()
            .single();

        if (databaseError) {
            console.error("Supabase insert error:", databaseError);

            return res.status(500).json({
                success: false,
                error: "The request could not be saved."
            });
        }

        let emailSent = false;
        let emailErrorMessage = null;

        try {
            const notificationEmail =
                process.env.HAULAGE_NOTIFICATION_EMAIL;

            if (!notificationEmail) {
                throw new Error(
                    "HAULAGE_NOTIFICATION_EMAIL is not configured."
                );
            }

            const emailResult = await resend.emails.send({
                from:
                    process.env.HAULAGE_FROM_EMAIL ||
                    "AMCOL Haulage <onboarding@resend.dev>",

                to: [notificationEmail],

                replyTo: requestRecord.email,

                subject:
                    `New Haulage Request - ` +
                    `${requestRecord.company_name || requestRecord.contact_name}`,

                html: buildNotificationEmail(
                    requestRecord,
                    savedRequest
                )
            });

            if (emailResult.error) {
                throw new Error(
                    emailResult.error.message ||
                    "Resend rejected the email."
                );
            }

            emailSent = true;
        } catch (emailError) {
            emailErrorMessage =
                emailError instanceof Error
                    ? emailError.message
                    : "Unknown email error";

            /*
             * The request remains successfully saved even if the
             * notification email temporarily fails.
             */
            console.error(
                "Haulage notification email failed:",
                emailError
            );
        }

        return res.status(201).json({
            success: true,
            requestId:
                savedRequest?.id ||
                requestRecord.client_reference ||
                null,
            emailSent,
            emailError: emailErrorMessage,
            message: emailSent
                ? "Request submitted and the operations team was notified."
                : "Request submitted successfully, but the email notification could not be sent."
        });
    } catch (error) {
        console.error("Submit request API error:", error);

        return res.status(500).json({
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "An unexpected error occurred."
        });
    }
};

function cleanText(value) {
    return String(value || "").trim().slice(0, 5000);
}

function cleanOptionalText(value) {
    const cleaned = cleanText(value);
    return cleaned || null;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function displayValue(value, fallback = "Not provided") {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }

    return escapeHtml(value);
}

function formatDispatchTime(value) {
    if (!value) {
        return "Not provided";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return escapeHtml(
        date.toLocaleString("en-TT", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "America/Port_of_Spain"
        })
    );
}

function buildNotificationEmail(request, savedRequest) {
    const reference =
        savedRequest?.id ||
        request.client_reference ||
        "Not available";

    return `
        <!doctype html>
        <html>
            <body style="
                margin:0;
                padding:24px;
                background:#f4f5f7;
                font-family:Arial, Helvetica, sans-serif;
                color:#1f2937;
            ">
                <div style="
                    max-width:700px;
                    margin:0 auto;
                    background:#ffffff;
                    border-radius:12px;
                    overflow:hidden;
                    border:1px solid #e5e7eb;
                ">
                    <div style="
                        padding:24px;
                        background:#111827;
                        color:#ffffff;
                    ">
                        <h1 style="
                            margin:0;
                            font-size:24px;
                        ">
                            New Haulage Request
                        </h1>

                        <p style="
                            margin:8px 0 0;
                            color:#d1d5db;
                        ">
                            A new request was submitted through the website.
                        </p>
                    </div>

                    <div style="padding:24px;">
                        <h2 style="
                            margin:0 0 14px;
                            font-size:18px;
                        ">
                            Customer details
                        </h2>

                        ${emailRow(
                            "Company",
                            displayValue(request.company_name)
                        )}

                        ${emailRow(
                            "Contact person",
                            displayValue(request.contact_name)
                        )}

                        ${emailRow(
                            "Email",
                            displayValue(request.email)
                        )}

                        ${emailRow(
                            "Direct phone",
                            displayValue(request.direct_phone)
                        )}

                        ${emailRow(
                            "Billing email",
                            displayValue(request.billing_contact_email)
                        )}

                        <h2 style="
                            margin:28px 0 14px;
                            font-size:18px;
                        ">
                            Transport details
                        </h2>

                        ${emailRow(
                            "Service",
                            displayValue(request.service)
                        )}

                        ${emailRow(
                            "Asset preference",
                            displayValue(request.asset_preference)
                        )}

                        ${emailRow(
                            "Priority",
                            displayValue(request.cargo_priority)
                        )}

                        ${emailRow(
                            "Pickup location",
                            displayValue(request.pickup_location)
                        )}

                        ${emailRow(
                            "Delivery point",
                            displayValue(request.delivery_point)
                        )}

                        ${emailRow(
                            "Dispatch time",
                            formatDispatchTime(
                                request.requested_dispatch_time
                            )
                        )}

                        ${emailRow(
                            "Cargo type",
                            displayValue(request.cargo_type)
                        )}

                        ${emailRow(
                            "Estimated weight",
                            request.estimated_weight_kg !== null
                                ? `${escapeHtml(
                                    request.estimated_weight_kg
                                )} kg`
                                : "Not provided"
                        )}

                        ${emailRow(
                            "Site restrictions",
                            displayValue(request.site_restrictions)
                        )}

                        ${emailRow(
                            "On-site coordinator",
                            displayValue(request.on_site_coordinator)
                        )}

                        ${emailRow(
                            "ETA recipient",
                            displayValue(request.dispatch_eta_recipient)
                        )}

                        <h2 style="
                            margin:28px 0 10px;
                            font-size:18px;
                        ">
                            Special handling notes
                        </h2>

                        <div style="
                            padding:14px;
                            background:#f9fafb;
                            border:1px solid #e5e7eb;
                            border-radius:8px;
                            white-space:pre-wrap;
                        ">${displayValue(
                            request.special_handling_notes,
                            "No special handling notes provided."
                        )}</div>

                        <p style="
                            margin:24px 0 0;
                            padding-top:18px;
                            border-top:1px solid #e5e7eb;
                            color:#6b7280;
                            font-size:13px;
                        ">
                            Request reference:
                            <strong>${escapeHtml(reference)}</strong>
                        </p>
                    </div>
                </div>
            </body>
        </html>
    `;
}

function emailRow(label, value) {
    return `
        <div style="
            display:flex;
            gap:16px;
            padding:10px 0;
            border-bottom:1px solid #f0f0f0;
        ">
            <div style="
                width:180px;
                flex-shrink:0;
                font-weight:bold;
                color:#374151;
            ">
                ${escapeHtml(label)}
            </div>

            <div style="
                flex:1;
                overflow-wrap:anywhere;
            ">
                ${value}
            </div>
        </div>
    `;
}
