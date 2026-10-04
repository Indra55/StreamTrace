import sampleUrl from "../../docs/fhir/sample-bundle.json?url&no-inline";
import guideUrl from "../../docs/fhir/README.md?url&no-inline";

export function FhirPrototype({ guidedCase = false }: { guidedCase?: boolean }) {
  return <section className="fhir-prototype" aria-label="Prototype FHIR export">
    <h3>Prototype FHIR export</h3>
    <p>Inspect approved observations and their observation sites in a FHIR bundle. Citizen notes, citizen coordinates and reporter identifiers are omitted. Reviewers can download a case bundle from the Case tab in the reviewer area.</p>
    {guidedCase && <p>This is the fixed simulated Coimbra sample, separate from the report you created in this guided case.</p>}
    <p className="fhir-prototype-notice">Prototype FHIR R4 collection Bundle. Base R4, no profile conformance claimed. Validate before external use.</p>
    <div className="fhir-prototype-links"><a href={sampleUrl}>Inspect simulated FHIR sample</a><a href={guideUrl}>Export and validation guide</a></div>
  </section>;
}
