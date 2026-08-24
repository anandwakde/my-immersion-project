import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./addressiq.css";

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
  const parseAddress = useAction(api.parseAddress.parse);
  const saveResult = useMutation(api.addressChecks.save);
  const markReviewed = useMutation(api.addressChecks.markReviewed);
  const latestCheck = useQuery(api.addressChecks.latest);

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

  const isEditable = result?.status === "needs_review" && !reviewed && fields;
  const liveMissing = fields ? missingFrom(fields) : [];
  const isTooLong = input.length > MAX_INPUT_LENGTH;

  return (
    <div className="aiq-page">
      <div className="aiq-container">
        <div className="aiq-topbar">
          <ThemeToggle />
        </div>

        <p className="aiq-eyebrow">AddressIQ &middot; ISO 20022</p>
        <h1 className="aiq-h1">Paste an address, get it structured.</h1>
        <p className="aiq-subtitle">
          Paste a hybrid or unstructured payment address below. A real AI
          call structures it into ISO 20022 fields.
        </p>
        <p className="aiq-scope-note">
          Milestone 10 &mdash; V1 complete. Close this tab and reopen it: your
          last result is still here.
        </p>

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
              {!reviewed && liveMissing.length > 0 && (
                <span className="aiq-pill aiq-pill-warn">
                  Missing: {liveMissing.join(", ")}
                </span>
              )}
            </div>
            {saveError && <p className="aiq-inline-warning">{saveError}</p>}

            {isEditable ? (
              <>
                <div className="aiq-fields">
                  <FieldInput
                    label="Floor / Unit"
                    value={fields.floorUnit}
                    onChange={(v) => updateField("floorUnit", v)}
                  />
                  <FieldInput
                    label="Building Number"
                    value={fields.buildingNumber}
                    onChange={(v) => updateField("buildingNumber", v)}
                  />
                  <FieldInput
                    label="Street Name"
                    value={fields.streetName}
                    onChange={(v) => updateField("streetName", v)}
                  />
                  <FieldInput
                    label="Town Name"
                    value={fields.townName}
                    onChange={(v) => updateField("townName", v)}
                  />
                  <FieldInput
                    label="Postal Code"
                    value={fields.postalCode}
                    onChange={(v) => updateField("postalCode", v)}
                  />
                  <FieldInput
                    label="Country Code"
                    value={fields.countryCode}
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
          </div>
        )}
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
  onChange,
}: {
  label: string;
  value: string;
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
    </div>
  );
}
