import React from "react";
import { Alert, Badge, Card, Row, Col, Table, ListGroup, Accordion } from "react-bootstrap";

const VerificationResult = ({ data }) => {
  if (!data) return null;

  const status = data.status || "REJECTED";
  const isVerified = data.verified === true;
  const traceId = data.traceId || "";
  const processingTimeMs = data.processingTimeMs || 0;
  const confidence = data.confidence || { overall: 0, aadhaar: 0, pan: 0 };
  const summary = data.summary || {};
  const submittedData = data.submittedData || {};
  const ocrData = data.ocrData || {};
  const comparison = data.comparison || {};
  const pipeline = data.pipeline || {};
  const timeline = data.timeline || [];
  const errors = data.errors || [];
  const warnings = data.warnings || [];
  const recommendations = data.recommendations || [];

  // Determine Alert variant
  let alertVariant = "danger";
  if (isVerified && status === "VERIFIED") alertVariant = "success";
  else if (status === "OCR_UNAVAILABLE" || status === "MANUAL_REVIEW") alertVariant = "warning";
  else if (status === "OCR_PROCESSING") alertVariant = "info";

  return (
    <div className="mt-4">
      {/* 1. Header Banner */}
      <Alert variant={alertVariant} className="border-0 shadow-sm mb-4">
        <Alert.Heading className="d-flex align-items-center justify-content-between flex-wrap">
          <div className="d-flex align-items-center me-2">
            {isVerified ? (
              <span className="fs-4 me-2">✓ KYC Successfully Verified</span>
            ) : status === "OCR_UNAVAILABLE" ? (
              <span className="fs-4 me-2">⚠️ AI OCR Service Unavailable</span>
            ) : status === "OCR_FAILED" ? (
              <span className="fs-4 me-2">❌ OCR Extraction Failed</span>
            ) : (
              <span className="fs-4 me-2">❌ KYC Verification Rejected</span>
            )}
          </div>
          <div className="mt-2 mt-sm-0">
            <Badge bg={isVerified ? "success" : status === "OCR_UNAVAILABLE" ? "warning" : "danger"} className="me-2 fs-6">
              {status}
            </Badge>
            {traceId && (
              <Badge bg="dark" text="white" className="fs-6">
                TraceID: {traceId.substring(0, 8)}...
              </Badge>
            )}
          </div>
        </Alert.Heading>
        <p className="mb-1">{data.message}</p>
        <div className="d-flex justify-content-between text-muted small mt-2 pt-2 border-top">
          <span>Processing Time: <strong>{processingTimeMs} ms</strong></span>
          <span>Overall Confidence: <strong>{confidence.overall}%</strong></span>
          <span>Timestamp: <strong>{data.verificationTime ? new Date(data.verificationTime).toLocaleTimeString() : "N/A"}</strong></span>
        </div>
      </Alert>

      {/* 2. Pipeline Execution Stages */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-light fw-bold">Pipeline Stage Tracker</Card.Header>
        <Card.Body>
          <Row className="text-center g-2">
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">Validation</small>
                <Badge bg={pipeline.imageValidation === "SUCCESS" ? "success" : "secondary"}>
                  {pipeline.imageValidation || "SUCCESS"}
                </Badge>
              </div>
            </Col>
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">OCR Engine</small>
                <Badge bg={pipeline.ocr === "SUCCESS" ? "success" : pipeline.ocr === "SKIPPED" ? "warning" : "danger"}>
                  {pipeline.ocr || "PENDING"}
                </Badge>
              </div>
            </Col>
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">Gemini AI</small>
                <Badge bg={pipeline.gemini === "SUCCESS" ? "success" : pipeline.gemini === "SKIPPED" ? "warning" : "secondary"}>
                  {pipeline.gemini || "PENDING"}
                </Badge>
              </div>
            </Col>
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">Data Match</small>
                <Badge bg={pipeline.dataMatching === "SUCCESS" ? "success" : pipeline.dataMatching === "MISMATCH" ? "danger" : "warning"}>
                  {pipeline.dataMatching || "PENDING"}
                </Badge>
              </div>
            </Col>
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">Face Match</small>
                <Badge bg="secondary">{pipeline.faceVerification || "PENDING"}</Badge>
              </div>
            </Col>
            <Col xs={6} sm={4} md={2}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block">Liveness</small>
                <Badge bg="secondary">{pipeline.liveness || "PENDING"}</Badge>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 3. Submitted vs OCR Field Comparison Table */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-light fw-bold">Submitted Data vs Extracted OCR Comparison</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Attribute</th>
                <th>Submitted Input</th>
                <th>Aadhaar OCR</th>
                <th>PAN OCR</th>
                <th>Match Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="fw-bold">Applicant Name</td>
                <td>{submittedData.name || "—"}</td>
                <td>{ocrData.aadhaar?.name || "—"}</td>
                <td>{ocrData.pan?.name || "—"}</td>
                <td>
                  {comparison.aadhaar?.name?.matched || comparison.pan?.name?.matched ? (
                    <Badge bg="success">
                      ✓ Match ({Math.max(comparison.aadhaar?.name?.similarity || 0, comparison.pan?.name?.similarity || 0)}%)
                    </Badge>
                  ) : (
                    <Badge bg="danger">❌ Mismatch</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td className="fw-bold">Aadhaar Number</td>
                <td>{submittedData.aadhaar || "—"}</td>
                <td>{ocrData.aadhaar?.number || "—"}</td>
                <td>N/A</td>
                <td>
                  {comparison.aadhaar?.number?.matched ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : submittedData.aadhaar ? (
                    <Badge bg="danger">❌ Mismatch</Badge>
                  ) : (
                    <Badge bg="secondary">Not Provided</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td className="fw-bold">PAN Number</td>
                <td>{submittedData.pan || "—"}</td>
                <td>N/A</td>
                <td>{ocrData.pan?.number || "—"}</td>
                <td>
                  {comparison.pan?.number?.matched ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : submittedData.pan ? (
                    <Badge bg="danger">❌ Mismatch</Badge>
                  ) : (
                    <Badge bg="secondary">Not Provided</Badge>
                  )}
                </td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* 4. Extracted Document Metadata */}
      <Row className="g-4 mb-4">
        {ocrData.aadhaar && (
          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <span>Aadhaar Card Extraction</span>
                <Badge bg="light" text="dark">{confidence.aadhaar}% Confidence</Badge>
              </Card.Header>
              <Card.Body>
                <p><strong>Name:</strong> {ocrData.aadhaar.name || "N/A"}</p>
                <p><strong>Aadhaar Number:</strong> {ocrData.aadhaar.number || "N/A"}</p>
                <p><strong>DOB:</strong> {ocrData.aadhaar.dob || "N/A"}</p>
                <p className="mb-0"><strong>Address:</strong> {ocrData.aadhaar.address || "N/A"}</p>
              </Card.Body>
            </Card>
          </Col>
        )}
        {ocrData.pan && (
          <Col md={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-success text-white d-flex justify-content-between align-items-center">
                <span>PAN Card Extraction</span>
                <Badge bg="light" text="dark">{confidence.pan}% Confidence</Badge>
              </Card.Header>
              <Card.Body>
                <p><strong>Holder Name:</strong> {ocrData.pan.name || "N/A"}</p>
                {ocrData.pan.father_name && <p><strong>Father's Name:</strong> {ocrData.pan.father_name}</p>}
                <p><strong>PAN Number:</strong> {ocrData.pan.number || "N/A"}</p>
                <p className="mb-0"><strong>DOB:</strong> {ocrData.pan.dob || "N/A"}</p>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {/* 5. Warnings, Errors & Recommendations */}
      {(errors.length > 0 || warnings.length > 0 || recommendations.length > 0) && (
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light fw-bold">Diagnostic Errors & Actionable Recommendations</Card.Header>
          <Card.Body>
            {errors.length > 0 && (
              <div className="mb-3">
                <h6 className="text-danger fw-bold">Validation Errors:</h6>
                <ListGroup variant="flush">
                  {errors.map((err, idx) => (
                    <ListGroup.Item key={idx} className="text-danger px-0 py-1 bg-transparent">
                      • {err.reason || err.message || JSON.stringify(err)}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mb-3">
                <h6 className="text-warning fw-bold">System Warnings:</h6>
                <ListGroup variant="flush">
                  {warnings.map((warn, idx) => (
                    <ListGroup.Item key={idx} className="text-warning px-0 py-1 bg-transparent">
                      • {warn}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}
            {recommendations.length > 0 && (
              <div>
                <h6 className="text-info fw-bold">Recommendations:</h6>
                <ListGroup variant="flush">
                  {recommendations.map((rec, idx) => (
                    <ListGroup.Item key={idx} className="text-info px-0 py-1 bg-transparent">
                      • {rec}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* 6. Audit Timeline */}
      {timeline.length > 0 && (
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-light fw-bold">Audit Timeline</Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-2">
              {timeline.map((step, idx) => (
                <div key={idx} className="p-2 border rounded bg-white shadow-sm d-flex align-items-center">
                  <Badge bg="primary" className="me-2">{step.status}</Badge>
                  <small className="text-muted">{new Date(step.timestamp).toLocaleTimeString()}</small>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default VerificationResult;
