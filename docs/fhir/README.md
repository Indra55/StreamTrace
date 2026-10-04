# Prototype FHIR export

Judges can inspect [sample-bundle.json](sample-bundle.json) without a reviewer login. To download a case, sign in at `/review`, open the **Case** tab and use **Download FHIR bundle (prototype)** next to **Export JSON** in the case panel. The button calls `GET /api/cases/:id/export?format=fhir` and saves `fhir-bundle-<case>.json`.

Prototype FHIR R4 collection Bundle. Base R4, no profile conformance claimed. Validate before external use.

## Bundle contents

The shared API builder produces a `collection` Bundle containing a Location for each stored observation site and an Observation for each currently approved case report. Every entry has a unique `fullUrl`. Observation `focus` references resolve to Locations in the same Bundle.

Locations include the site name, a StreamTrace site identifier and the site's stored position when available. Positions come from the stored site, never from citizen geolocation. The `https://streamtrace.example/` identifiers are prototype namespaces.

Observations have status `final`, a text-only signal code, a CodeableConcept text value of `seen`, `not seen` or `cannot tell`, and `effectiveDateTime` from `observed_at`. A reviewer reason is included in `note` when present for the current approved revision. Approval records review status; it does not certify water safety.

The sample uses the existing simulated Coimbra demo and the same `fhirBundle` function as the API. It contains two approved observations; the pending demo observation is omitted. Every resource, including the Bundle, has a StreamTrace `simulated` metadata tag with a text notice. Locations also have a simulated description and Observations a simulated note. No personal data is included. Live cases are not marked as simulated.

## Deliberately omitted

- Pending, unreviewed, rejected and uncertain reports, and all general-inbox reports.
- Citizen notes, citizen coordinates and reporter identifiers.
- Patient, Practitioner, diagnostic claims, invented LOINC or SNOMED codes and profile conformance claims.
- Engine internals, candidate source stretches and recommendations.

## Validation

Regenerate the sample first:

```bash
npm run fhir:sample
```

Prerequisite: Java 17 or newer, and the validator jar:

```bash
curl -L -o validator_cli.jar https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
```

1. HL7 FHIR Validator. Record the actual result in [VALIDATION.md](VALIDATION.md):

```bash
java -jar validator_cli.jar docs/fhir/sample-bundle.json -version 4.0.1 | tee docs/fhir/validator-output.txt
```

2. Public HAPI server as a second opinion. It receives the sample bundle, which is simulated and contains no personal data:

```bash
curl -s -X POST -H "Content-Type: application/fhir+json" --data @docs/fhir/sample-bundle.json 'https://hapi.fhir.org/baseR4/Bundle/$validate'
```

External validation is pending. The project owner will run these commands and add the real results to [VALIDATION.md](VALIDATION.md). This README makes no validation claim.
