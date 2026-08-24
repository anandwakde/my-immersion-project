# Sample ISO 20022 address blocks

Three small pacs.008 (`FIToFICustomerCreditTransfer`) excerpts, one per
address format, so you can open a file, copy the address, and paste it
straight into AddressIQ to see how each one is handled.

These are hand-built illustrative excerpts (not full schema-validated
messages) — they exist to give you real ISO 20022-shaped text to copy from,
not to be run through a validator. For full, downloadable, schema-checked
sample messages, see the **Real sources** section below.

| File | Format | What it looks like |
|---|---|---|
| `structured-address-sample.xml` | Structured | Every component (`StrtNm`, `BldgNb`, `Flr`, `PstCd`, `TwnNm`, `Ctry`) in its own tag. No free-text lines at all. |
| `hybrid-address-sample.xml` | Hybrid | `TwnNm` and `Ctry` in their own tags; everything else (building, floor, landmark) folded into up to two `AdrLine` elements. |
| `unstructured-address-sample.xml` | Unstructured | Only `Ctry` is a distinct tag — town, street, everything else sits inside free-text `AdrLine` elements. This is the format SWIFT is removing from CBPR+ cross-border payments from November 2026. |

## Real sources, if you want fully validated official samples

- **ISO 20022 message catalogue** — the standard-setter's own archive of
  message definitions (including pacs.008) with downloadable XSDs and
  examples: https://www.iso20022.org/iso-20022-message-definitions
- **IsSettled sample repo** — real pacs.008.001.09 XML sample messages and
  schemas on GitHub: https://github.com/issettled/iso20022-issettled
- **Swift's own explainer** on structured vs. hybrid vs. unstructured
  addresses and the November 2026 CBPR+ deadline:
  https://www.swift.com/standards/iso-20022/removal-unstructured-address
