import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import "./addressiq.css";

type AddressFormat = "structured" | "hybrid" | "unstructured";

type ParsedAddress = {
  floorUnit: string | null;
  buildingNumber: string | null;
  streetName: string | null;
  townName: string | null;
  postalCode: string | null;
  countryCode: string | null;
  countryName: string | null;
  confidence: number;
  missingRequiredFields: string[];
  status: "ready" | "needs_review";
  addressFormat: AddressFormat;
  fieldIssues: Record<string, string>;
};

type EditableFields = {
  floorUnit: string;
  buildingNumber: string;
  streetName: string;
  townName: string;
  postalCode: string;
  countryCode: string;
  countryName: string;
};

const MAX_INPUT_LENGTH = 1000;

const REQUIRED_KEYS: (keyof EditableFields)[] = [
  "streetName",
  "townName",
  "countryCode",
];

const FORMAT_LABEL: Record<AddressFormat, string> = {
  structured: "Structured",
  hybrid: "Hybrid",
  unstructured: "Unstructured",
};

function toEditableFields(result: ParsedAddress): EditableFields {
  return {
    floorUnit: result.floorUnit ?? "",
    buildingNumber: result.buildingNumber ?? "",
    streetName: result.streetName ?? "",
    townName: result.townName ?? "",
    postalCode: result.postalCode ?? "",
    countryCode: result.countryCode ?? "",
    countryName: result.countryName ?? "",
  };
}

function missingFrom(fields: EditableFields): string[] {
  const labels: Record<(typeof REQUIRED_KEYS)[number], string> = {
    streetName: "Street Name",
    townName: "Town Name",
    countryCode: "Country",
  };
  return REQUIRED_KEYS.filter((key) => !fields[key].trim()).map(
    (key) => labels[key],
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPstlAdrXml(fields: EditableFields): string {
  const lines: string[] = [];
  const tag = (name: string, value: string) => {
    if (value.trim()) lines.push(`  <${name}>${escapeXml(value.trim())}</${name}>`);
  };
  tag("StrtNm", fields.streetName);
  tag("BldgNb", fields.buildingNumber);
  tag("Flr", fields.floorUnit);
  tag("PstCd", fields.postalCode);
  tag("TwnNm", fields.townName);
  tag("Ctry", fields.countryCode);
  return ["<PstlAdr>", ...lines, "</PstlAdr>"].join("\n");
}

const SAMPLE_CATEGORIES: AddressFormat[] = ["structured", "hybrid", "unstructured"];

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ParsedAddress | null>(null);
  const [fields, setFields] = useState<EditableFields | null>(null);
  const [recordId, setRecordId] = useState<Id<"addressChecks"> | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [copiedId, setCopiedId] = useState<Id<"sampleAddresses"> | null>(
    null,
  );
  const parseAddress = useAction(api.parseAddress.parse);
  const saveResult = useMutation(api.addressChecks.save);
  const markReviewed = useMutation(api.addressChecks.markReviewed);
  const latestCheck = useQuery(api.addressChecks.latest);
  const samples = useQuery(api.samples.list);

  useEffect(() => {
    if (hydrated || latestCheck === undefined) return;
    setHydrated(true);
    if (latestCheck) {
      setInput(latestCheck.rawAddress);
      setResult({
        ...latestCheck.aiFields,
        confidence: latestCheck.confidence,
        missingRequiredFields: latestCheck.missingRequiredFields,
        status: latestCheck.status,
        addressFormat: latestCheck.addressFormat,
        fieldIssues: latestCheck.fieldIssues,
      });
      setFields({
        floorUnit: latestCheck.finalFields.floorUnit ?? "",
        buildingNumber: latestCheck.finalFields.buildingNumber ?? "",
        streetName: latestCheck.finalFields.streetName ?? "",
        townName: latestCheck.finalFields.townName ?? "",
        postalCode: latestCheck.finalFields.postalCode ?? "",
        countryCode: latestCheck.finalFields.countryCode ?? "",
        countryName: latestCheck.finalFields.countryName ?? "",
      });
      setRecordId(latestCheck._id);
      setReviewed(latestCheck.reviewed);
    }
  }, [hydrated, latestCheck]);

  async function handleSubmit() {
    const raw = input.trim();
    if (!raw || raw.length > MAX_INPUT_LENGTH) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    setResult(null);
    setFields(null);
    setRecordId(null);
    setReviewed(false);
    try {
      const parsed = await parseAddress({ rawAddress: raw });
      setResult(parsed);
      const editable = toEditableFields(parsed);
      setFields(editable);
      try {
        const id = await saveResult({
          rawAddress: raw,
          fields: editable,
          confidence: parsed.confidence,
          missingRequiredFields: parsed.missingRequiredFields,
          status: parsed.status,
          addressFormat: parsed.addressFormat,
          fieldIssues: parsed.fieldIssues,
        });
        setRecordId(id);
      } catch {
        setSaveError("Couldn't save this result — it won't survive a reload.");
      }
    } catch (err) {
      const message =
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Something went wrong parsing that address. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkReviewed() {
    if (!fields) return;
    setReviewed(true);
    if (recordId) {
      try {
        await markReviewed({ id: recordId, fields });
      } catch {
        setSaveError("Couldn't save your review — it won't survive a reload.");
      }
    }
  }

  function updateField(key: keyof EditableFields, value: string) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleCopySample(id: Id<"sampleAddresses">, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context); no fallback needed for this internal tool.
    }
  }

  function handleDownloadXml() {
    if (!fields) return;
    const xml = buildPstlAdrXml(fields);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `structured-address-${fields.countryCode || "address"}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isEditable = result?.status === "needs_review" && !reviewed && fields;
  const liveMissing = fields ? missingFrom(fields) : [];
  const isTooLong = input.length > MAX_INPUT_LENGTH;
  const issues = result?.fieldIssues ?? {};
  const showXmlOutput = Boolean(fields) && (reviewed || result?.status === "ready");

  return (
    <div className="aiq-page">
      <div className="aiq-container">
        <p className="aiq-eyebrow">AddressIQ &middot; ISO 20022</p>
        <h1 className="aiq-h1">Paste an address, get it structured.</h1>
        <p className="aiq-subtitle">
          Paste a hybrid or unstructured payment address below. A real AI
          call structures it into ISO 20022 fields, flags what's uncertain,
          and suggests a fix.
        </p>

        <div className="aiq-layout">
        <div className="aiq-main">

        <div className="aiq-card">
          <p className="aiq-pane-label">Original</p>
          <textarea
            className="aiq-textarea"
            placeholder="e.g. Flat 12, 123 MG Road, Near City Mall, Mumbai 400058 India"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {isTooLong && (
            <p className="aiq-inline-warning">
              That&rsquo;s {input.length} characters &mdash; paste a single
              address, not a full document ({MAX_INPUT_LENGTH} max).
            </p>
          )}
          <div className="aiq-form-footer">
            <button
              className="aiq-button"
              disabled={!input.trim() || isTooLong || loading}
              onClick={handleSubmit}
            >
              {loading ? "Parsing…" : "Structure this"}
            </button>
          </div>
        </div>

        {error && (
          <div className="aiq-card">
            <p className="aiq-pane-label">Couldn&rsquo;t parse this</p>
            <div className="aiq-error">{error}</div>
          </div>
        )}

        {result && fields && (
          <div className="aiq-card">
            <p className="aiq-pane-label">Structured &middot; ISO 20022</p>
            <div className="aiq-status-row">
              {reviewed ? (
                <span className="aiq-pill aiq-pill-good">Reviewed</span>
              ) : result.status === "ready" ? (
                <span className="aiq-pill aiq-pill-good">
                  Ready for approval
                </span>
              ) : (
                <span className="aiq-pill aiq-pill-warn">Needs review</span>
              )}
              <span className="aiq-confidence">
                <span className="aiq-confidence-value">
                  {Math.round(result.confidence)}%
                </span>
                <span className="aiq-confidence-caption">confidence</span>
              </span>
              <span className="aiq-pill aiq-pill-neutral">
                Input: {FORMAT_LABEL[result.addressFormat]}
              </span>
              {!reviewed && liveMissing.length > 0 && (
                <span className="aiq-pill aiq-pill-warn">
                  Missing: {liveMissing.join(", ")}
                </span>
              )}
            </div>
            {result.addressFormat === "unstructured" && (
              <p className="aiq-note">
                Unstructured addresses are being phased out of ISO 20022
                CBPR+ cross-border payments — SWIFT stops accepting them from
                November 2026. Structured or hybrid (Town Name + Country in
                their own fields) will be required.
              </p>
            )}
            {saveError && <p className="aiq-inline-warning">{saveError}</p>}

            {isEditable ? (
              <>
                <div className="aiq-fields">
                  <FieldInput
                    label="Floor / Unit"
                    value={fields.floorUnit}
                    issue={issues.floorUnit}
                    onChange={(v) => updateField("floorUnit", v)}
                  />
                  <FieldInput
                    label="Building Number"
                    value={fields.buildingNumber}
                    issue={issues.buildingNumber}
                    onChange={(v) => updateField("buildingNumber", v)}
                  />
                  <FieldInput
                    label="Street Name"
                    value={fields.streetName}
                    issue={issues.streetName}
                    onChange={(v) => updateField("streetName", v)}
                  />
                  <FieldInput
                    label="Town Name"
                    value={fields.townName}
                    issue={issues.townName}
                    onChange={(v) => updateField("townName", v)}
                  />
                  <FieldInput
                    label="Postal Code"
                    value={fields.postalCode}
                    issue={issues.postalCode}
                    onChange={(v) => updateField("postalCode", v)}
                  />
                  <FieldInput
                    label="Country Code"
                    value={fields.countryCode}
                    issue={issues.countryCode}
                    onChange={(v) => updateField("countryCode", v)}
                  />
                </div>
                <div className="aiq-form-footer">
                  <button
                    className="aiq-button"
                    disabled={liveMissing.length > 0}
                    onClick={handleMarkReviewed}
                  >
                    Mark reviewed
                  </button>
                </div>
              </>
            ) : (
              <div className="aiq-fields">
                <Field label="Floor / Unit" value={fields.floorUnit} />
                <Field
                  label="Building Number"
                  value={fields.buildingNumber}
                />
                <Field label="Street Name" value={fields.streetName} />
                <Field label="Town Name" value={fields.townName} />
                <Field label="Postal Code" value={fields.postalCode} />
                <Field
                  label="Country"
                  value={
                    fields.countryName
                      ? `${fields.countryCode} · ${fields.countryName}`.trim()
                      : fields.countryCode
                  }
                />
              </div>
            )}

            {showXmlOutput && fields && (
              <div className="aiq-xml-section">
                <p className="aiq-pane-label">Structured ISO 20022 output</p>
                <pre className="aiq-xml-output">
                  {buildPstlAdrXml(fields)}
                </pre>
                <div className="aiq-form-footer">
                  <button
                    type="button"
                    className="aiq-button-secondary"
                    onClick={handleDownloadXml}
                  >
                    Download .xml
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        </div>

        <aside className="aiq-sidebar">
          <div className="aiq-card aiq-samples-card">
            <p className="aiq-pane-label">Samples</p>
            {SAMPLE_CATEGORIES.map((category) => (
              <div key={category} className="aiq-sample-group">
                <p className="aiq-sample-group-label">
                  {FORMAT_LABEL[category]}
                </p>
                {(samples ?? [])
                  .filter((s) => s.category === category)
                  .map((sample) => (
                    <div key={sample._id} className="aiq-sample-row">
                      <span className="aiq-sample-label">{sample.label}</span>
                      <button
                        type="button"
                        className="aiq-copy-btn"
                        onClick={() => handleCopySample(sample._id, sample.text)}
                      >
                        {copiedId === sample._id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </aside>

        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="aiq-field-label">{label}</p>
      <p className="aiq-field-value">{value || "—"}</p>
    </div>
  );
}

function FieldInput({
  label,
  value,
  issue,
  onChange,
}: {
  label: string;
  value: string;
  issue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="aiq-field-label">{label}</p>
      <input
        className="aiq-field-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {issue && <p className="aiq-field-issue">{issue}</p>}
    </div>
  );
}
