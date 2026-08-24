# ISO 20022 Address Intelligence Engine — Feature Sort & Milestones

## FEATURE SORT

| Feature | Bucket | One-line reason |
|---|---|---|
| Paste/enter address input field | MUST HAVE | This is the entry point of the core action |
| Empty/invalid input check | MUST HAVE | Core flow breaks silently without it |
| Structured/unstructured/hybrid detection | MUST HAVE | The idea itself is defined as detecting this |
| AI parsing into ISO 20022 components | MUST HAVE | This is the core transformation |
| Structured address output display | MUST HAVE | This is the promised output of the core action |
| Field-level validation status (complete/incomplete) | MUST HAVE | Explicitly part of the core action's output |
| Confidence score calculation | MUST HAVE | Explicitly part of the core action's output |
| Ready vs. needs-review routing | MUST HAVE | This is the product's entire reason to exist |
| Editable fields on a "needs review" result | MUST HAVE | Without this, "needs review" is a dead end |
| Approve / mark-reviewed decision | MUST HAVE | Closes the human-review loop |
| Save input, output, confidence, validation, edits, decision, timestamps | MUST HAVE | Required for the "data survives" milestone |
| Working support for one country's address format | MUST HAVE | Proves the transformation works on something real |
| File/CSV upload as alternative input | NICE TO HAVE | Paste already covers one address at a time |
| History list of past transformations | NICE TO HAVE | One result view is enough to finish one item |
| Per-field confidence scores | NICE TO HAVE | An overall score is enough to route review |
| Second/third country format | NICE TO HAVE | One country proves the concept first |
| Payment processing or routing | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Payment initiation or settlement | NOT THIS WEEKEND | Explicitly parked — section 4 |
| KYC | NOT THIS WEEKEND | Explicitly parked — section 4 |
| AML screening | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Sanctions screening | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Compliance decisions | NOT THIS WEEKEND | Explicitly parked — section 4 |
| IBAN validation | NOT THIS WEEKEND | Explicitly parked — section 4 |
| BIC validation | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Beneficiary-name matching | NOT THIS WEEKEND | Explicitly parked — section 4 |
| External address enrichment | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Full MT → ISO 20022 message conversion | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Support for every ISO 20022 message type | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Support for every country | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Automatic modification of live payment messages | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Autonomous low-confidence decisions | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Direct core banking integration | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Advanced reporting | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Social/collaboration features | NOT THIS WEEKEND | Explicitly parked — section 4 |
| Large-scale enterprise workflow automation | NOT THIS WEEKEND | Explicitly parked — section 4 |

## V1 MILESTONES

| # | Milestone | Layer |
|---|---|---|
| 1 | I can open the Address Intelligence Engine and see one hardcoded structured address displayed with a confidence score and status | Frontend |
| 2 | I can paste one real hybrid/unstructured address and see the raw text sent for parsing | Frontend / Backend |
| 3 | I can get back one real, AI-parsed structured address (street, building number, town, postal code, country) for that pasted input | Backend / Integration |
| 4 | I can see a confidence score calculated and shown for that structured result | Backend |
| 5 | I can see a validation status (complete/incomplete fields) shown alongside the result | Backend |
| 6 | I can see a low-confidence result automatically flagged "Needs review" instead of "Ready" | Backend |
| 7 | I can edit the structured fields on a "Needs review" result and mark it reviewed | Frontend / Backend |
| 8 | I can paste an empty or invalid input and see a clear error instead of a broken result | Frontend / Backend |
| 9 | I can see my address, structured output, confidence, validation, edits, and decision saved to the database | Database |
| 10 | I can close and reopen the product and my data is still there | Database |
