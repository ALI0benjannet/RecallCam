import { BackendStatus } from "../components/backend-status";

export default function HomePage() {
  return (
    <>
      <p className="eyebrow">Video investigation workspace</p>
      <h1>RecallCam</h1>
      <p>Search recorded footage and return answers linked to the moments that support them.</p>
      <p className="notice">Development scaffold. Upload, indexing, and answers are not connected yet.</p>
      <BackendStatus />
    </>
  );
}
