import React from "react";
import { Alert, Badge } from "react-bootstrap";

const VerificationResult = ({ data }) => {
  if (!data) return null;

  const status = data.status || "REJECTED";
  const isVerified = data.verified === true;
  const traceId = data.traceId || "";

  // Case 1: VERIFIED
  if (isVerified && status === "VERIFIED") {
    return (
      <Alert variant="success" className="mt-4 border-0 shadow-sm">
        <Alert.Heading className="d-flex align-items-center justify-content-between">
          <span>✓ KYC Successfully Verified</span>
          <div>
            <Badge bg="success" className="me-2">VERIFIED</Badge>
            {traceId && <Badge bg="light" text="dark">Trace: {traceId.substring(0, 8)}...</Badge>}
          </div>
        </Alert.Heading>
        <p className="mb-0">{data.message || "All submitted document attributes matched successfully."}</p>
        {data.details && (
          <div className="mt-3 bg-white p-3 rounded text-dark">
            <h6 className="fw-bold">Extracted Details:</h6>
            {data.details.aadhaar && (
              <div>
                <strong>Aadhaar:</strong> {data.details.aadhaar.name} | {data.details.aadhaar.number}
              </div>
            )}
            {data.details.pan && (
              <div>
                <strong>PAN:</strong> {data.details.pan.name} | {data.details.pan.number}
              </div>
            )}
          </div>
        )}
      </Alert>
    );
  }

  // Case 2: OCR_UNAVAILABLE
  if (status === "OCR_UNAVAILABLE") {
    return (
      <Alert variant="warning" className="mt-4 border-0 shadow-sm">
        <Alert.Heading className="d-flex align-items-center justify-content-between">
          <span>✓ Documents Uploaded</span>
          <div>
            <Badge bg="warning" text="dark" className="me-2">OCR UNAVAILABLE</Badge>
            {traceId && <Badge bg="light" text="dark">Trace: {traceId.substring(0, 8)}...</Badge>}
          </div>
        </Alert.Heading>
        <p className="mb-0">
          <strong>⚠️ AI OCR Service Not Available</strong>
        </p>
        <p className="mb-0 text-muted mt-1">
          {data.message || "Documents were uploaded successfully. Automated AI OCR verification is currently unconfigured or offline."}
        </p>
        <div className="mt-2 text-secondary small">
          <em>Verification Status: Unverified (`verified: false`) | Trace ID: `{traceId}`</em>
        </div>
      </Alert>
    );
  }

  // Case 3: OCR_PROCESSING
  if (status === "OCR_PROCESSING") {
    return (
      <Alert variant="info" className="mt-4 border-0 shadow-sm">
        <Alert.Heading className="d-flex align-items-center justify-content-between">
          <span>Processing documents...</span>
          <Badge bg="info">PROCESSING</Badge>
        </Alert.Heading>
        <p className="mb-0">Running OCR text extraction and AI validation pipeline...</p>
      </Alert>
    );
  }

  // Case 4: OCR_FAILED
  if (status === "OCR_FAILED") {
    return (
      <Alert variant="danger" className="mt-4 border-0 shadow-sm">
        <Alert.Heading className="d-flex align-items-center justify-content-between">
          <span>❌ OCR Extraction Failed</span>
          <div>
            <Badge bg="danger" className="me-2">OCR FAILED</Badge>
            {traceId && <Badge bg="light" text="dark">Trace: {traceId.substring(0, 8)}...</Badge>}
          </div>
        </Alert.Heading>
        <p className="mb-0">{data.message || "Could not read text from uploaded document images. Please upload clearer document photos."}</p>
        {traceId && <div className="mt-2 text-secondary small"><em>Trace ID: `{traceId}`</em></div>}
      </Alert>
    );
  }

  // Case 5: MANUAL_REVIEW
  if (status === "MANUAL_REVIEW") {
    return (
      <Alert variant="warning" className="mt-4 border-0 shadow-sm">
        <Alert.Heading className="d-flex align-items-center justify-content-between">
          <span>⏳ Waiting for Manual Review</span>
          <div>
            <Badge bg="secondary" className="me-2">MANUAL REVIEW</Badge>
            {traceId && <Badge bg="light" text="dark">Trace: {traceId.substring(0, 8)}...</Badge>}
          </div>
        </Alert.Heading>
        <p className="mb-0">{data.message || "Document extraction confidence is below threshold. Forwarded to a compliance officer."}</p>
      </Alert>
    );
  }

  // Case 6: REJECTED
  return (
    <Alert variant="danger" className="mt-4 border-0 shadow-sm">
      <Alert.Heading className="d-flex align-items-center justify-content-between">
        <span>❌ KYC Verification Rejected</span>
        <div>
          <Badge bg="danger" className="me-2">REJECTED</Badge>
          {traceId && <Badge bg="light" text="dark">Trace: {traceId.substring(0, 8)}...</Badge>}
        </div>
      </Alert.Heading>
      <p className="mb-0">{data.message || data.error || "Verification failed due to document mismatch or invalid inputs."}</p>
      {traceId && <div className="mt-2 text-secondary small"><em>Trace ID: `{traceId}`</em></div>}
    </Alert>
  );
};

export default VerificationResult;
