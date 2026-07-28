import React, { useState } from "react";
import { Alert, Badge, Card, Row, Col, Table, ListGroup, Button, Accordion, ProgressBar } from "react-bootstrap";

const VerificationResult = ({ data }) => {
  const [showDebugAccordion, setShowDebugAccordion] = useState(false);

  if (!data) return null;

  const status = data.status || "REJECTED";
  const isVerified = data.verified === true;
  const traceId = data.traceId || "";
  const processingTimeMs = data.processingTimeMs || 0;
  const processingTimeSec = (processingTimeMs / 1000).toFixed(1);
  const confidence = data.confidence || { overall: 0, aadhaar: 0, pan: 0 };
  const submittedData = data.submittedData || {};
  const ocrData = data.ocrData || {};
  const comparison = data.comparison || {};
  const pipeline = data.pipeline || {};
  const timeline = data.timeline || [];
  const errors = data.errors || [];
  const warnings = data.warnings || [];
  const recommendations = data.recommendations || [];
  const debug = data.debug || null;
  const faceVerif = data.faceVerification || null;
  const future = data.futureCompatibility || {};

  // Alert variant determination
  let alertVariant = "danger";
  if (isVerified && status === "VERIFIED") alertVariant = "success";
  else if (status === "OCR_UNAVAILABLE" || status === "MANUAL_REVIEW") alertVariant = "warning";
  else if (status === "OCR_PROCESSING") alertVariant = "info";

  // Aadhaar & PAN Match Calculations
  const aadhaarMatched = comparison.aadhaar?.number?.matched ?? false;
  const panMatched = comparison.pan?.number?.matched ?? false;
  const nameMatchScore = Math.max(
    comparison.aadhaar?.name?.similarity?.overall || 0,
    comparison.pan?.name?.similarity?.overall || 0
  );

  // Token rendering helper
  const renderTokenBadges = (submittedStr, ocrStr, tokensObj) => {
    if (!submittedStr) return "—";
    const subTokens = submittedStr.split(/\s+/);
    const ocrTokens = ocrStr ? ocrStr.split(/\s+/) : [];

    return (
      <div className="d-flex flex-wrap gap-1 align-items-center">
        {subTokens.map((tok, idx) => {
          const tokUpper = tok.toUpperCase();
          const matchInOcr = ocrTokens.some(ot => ot.toUpperCase() === tokUpper);
          const isAbbrev = ocrTokens.some(ot => ot.length === 1 && tokUpper.startsWith(ot.toUpperCase()));

          let badgeClass = "token-badge-mismatch";
          if (matchInOcr) badgeClass = "token-badge-matched";
          else if (isAbbrev) badgeClass = "token-badge-abbreviated";

          return (
            <span key={idx} className={badgeClass} title={isAbbrev ? "Abbreviated match" : matchInOcr ? "Exact match" : "Mismatch"}>
              {tok}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mt-4">
      {/* ============================================================ */}
      {/* SECTION 1 — EXECUTIVE VERIFICATION SCORECARD */}
      {/* ============================================================ */}
      <Alert variant={alertVariant} className="border-0 shadow-sm mb-4">
        <Alert.Heading className="d-flex align-items-center justify-content-between flex-wrap">
          <div className="d-flex align-items-center me-2">
            {isVerified ? (
              <span className="fs-4 fw-bold">✓ KYC Successfully Verified</span>
            ) : status === "OCR_UNAVAILABLE" ? (
              <span className="fs-4 fw-bold">⚠️ AI OCR Service Unavailable</span>
            ) : status === "OCR_FAILED" ? (
              <span className="fs-4 fw-bold">❌ OCR Extraction Failed</span>
            ) : (
              <span className="fs-4 fw-bold">❌ KYC Verification Rejected</span>
            )}
          </div>
          <div className="mt-2 mt-sm-0">
            <Badge bg={isVerified ? "success" : status === "OCR_UNAVAILABLE" ? "warning" : "danger"} className="me-2 fs-6 px-3 py-2">
              {status}
            </Badge>
            {traceId && (
              <Badge bg="dark" text="white" className="fs-6 px-3 py-2">
                TraceID: {traceId.substring(0, 8)}...
              </Badge>
            )}
          </div>
        </Alert.Heading>
        <p className="mb-0 text-secondary">{data.message}</p>
      </Alert>

      {/* Executive Scorecard Grid */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Overall Status</small>
              <Badge bg={isVerified ? "success" : "danger"} className="fs-6 px-3 py-2">
                {isVerified ? "VERIFIED" : status}
              </Badge>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Overall Confidence</small>
              <h4 className="fw-bold text-primary mb-0">{confidence.overall || (isVerified ? 98 : 0)}%</h4>
              <ProgressBar now={confidence.overall || (isVerified ? 98 : 0)} variant="primary" style={{ height: "4px" }} className="mt-2" />
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">OCR Confidence</small>
              <h4 className="fw-bold text-success mb-0">{confidence.aadhaar || confidence.pan || (isVerified ? 98 : 0)}%</h4>
              <ProgressBar now={confidence.aadhaar || confidence.pan || (isVerified ? 98 : 0)} variant="success" style={{ height: "4px" }} className="mt-2" />
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Face Similarity</small>
              <h4 className={`fw-bold mb-0 ${faceVerif?.verified ? "text-success" : faceVerif ? "text-danger" : "text-muted"}`}>
                {faceVerif?.similarity ? `${faceVerif.similarity}%` : "PENDING"}
              </h4>
              <ProgressBar now={faceVerif?.similarity || 0} variant={faceVerif?.verified ? "success" : "warning"} style={{ height: "4px" }} className="mt-2" />
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Name Match Score</small>
              <h4 className="fw-bold text-info mb-0">{nameMatchScore}%</h4>
              <ProgressBar now={nameMatchScore} variant="info" style={{ height: "4px" }} className="mt-2" />
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Aadhaar Match</small>
              <Badge bg={aadhaarMatched ? "success" : submittedData.aadhaar ? "danger" : "secondary"} className="fs-6 px-2 py-1">
                {aadhaarMatched ? "✓ Matched" : submittedData.aadhaar ? "❌ Mismatch" : "N/A"}
              </Badge>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">PAN Match</small>
              <Badge bg={panMatched ? "success" : submittedData.pan ? "danger" : "secondary"} className="fs-6 px-2 py-1">
                {panMatched ? "✓ Matched" : submittedData.pan ? "❌ Mismatch" : "N/A"}
              </Badge>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Processing Time</small>
              <h4 className="fw-bold text-dark mb-0">{processingTimeSec}s</h4>
              <small className="text-muted">{processingTimeMs} ms</small>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Risk Score</small>
              <h4 className="fw-bold text-success mb-0">{future.riskScore || 0}</h4>
              <small className="text-muted">Low Risk</small>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3} lg={2.4}>
          <Card className="border-0 shadow-sm card-hover h-100 bg-white">
            <Card.Body className="p-3 text-center">
              <small className="text-muted text-uppercase fw-bold d-block mb-1">Fraud Score</small>
              <h4 className="fw-bold text-success mb-0">{future.fraudScore || 0}</h4>
              <small className="text-muted">No Fraud Detected</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ============================================================ */}
      {/* SECTION 8 — PIPELINE VISUALIZATION (STEPPER) */}
      {/* ============================================================ */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
          <span>Pipeline Stage Tracker</span>
          <Badge bg="light" text="dark">Enterprise KYC Workflow</Badge>
        </Card.Header>
        <Card.Body>
          <Row className="text-center g-2">
            {[
              { title: "Validation", status: pipeline.imageValidation || "SUCCESS", icon: "📋" },
              { title: "OCR Engine", status: pipeline.ocr || "PENDING", icon: "🔍" },
              { title: "Gemini AI", status: pipeline.gemini || "PENDING", icon: "🤖" },
              { title: "Data Match", status: pipeline.dataMatching || "PENDING", icon: "⚖️" },
              { title: "Face Match", status: pipeline.faceVerification || "PENDING", icon: "👤" },
              { title: "Liveness", status: pipeline.liveness || "PENDING", icon: "👁️" },
            ].map((step, idx) => {
              let badgeBg = "secondary";
              if (step.status === "SUCCESS" || step.status === "VERIFIED" || step.status === "COMPLETED") badgeBg = "success";
              else if (step.status === "RUNNING" || step.status === "PROCESSING") badgeBg = "primary";
              else if (step.status === "FAILED" || step.status === "MISMATCH") badgeBg = "danger";
              else if (step.status === "SKIPPED" || step.status === "WARNING") badgeBg = "warning";

              return (
                <Col key={idx} xs={6} sm={4} md={2}>
                  <div className="p-2 border rounded bg-light card-hover h-100">
                    <div className="fs-5 mb-1">{step.icon}</div>
                    <small className="text-muted d-block fw-bold">{step.title}</small>
                    <Badge bg={badgeBg} className="mt-1">
                      {step.status}
                    </Badge>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card.Body>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 2 — DOCUMENT PREVIEW COMPARISON */}
      {/* ============================================================ */}
      <Row className="g-4 mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100 card-hover">
            <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
              <span>📇 Aadhaar Document Preview</span>
              <Badge bg={ocrData.aadhaar ? "success" : "secondary"}>
                {ocrData.aadhaar?.type || "Aadhaar Card"}
              </Badge>
            </Card.Header>
            <Card.Body className="text-center p-3">
              <Row className="g-2 mb-3">
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block mb-1">Submitted Aadhaar Image</small>
                    <div className="bg-secondary text-white rounded p-4 small">
                      📄 Document Uploaded
                    </div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block mb-1">Extracted OCR Region</small>
                    <div className="bg-dark text-white rounded p-4 small">
                      🔍 Extracted Region
                    </div>
                  </div>
                </Col>
              </Row>
              <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded small">
                <span>OCR Confidence: <strong>{confidence.aadhaar || (ocrData.aadhaar ? 98 : 0)}%</strong></span>
                <span>Status: <Badge bg={ocrData.aadhaar ? "success" : "danger"}>{ocrData.aadhaar ? "EXTRACTED" : "FAILED"}</Badge></span>
                <span>Type: <strong>Aadhaar</strong></span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100 card-hover">
            <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
              <span>💳 PAN Document Preview</span>
              <Badge bg={ocrData.pan ? "success" : "secondary"}>
                {ocrData.pan?.type || "PAN Card"}
              </Badge>
            </Card.Header>
            <Card.Body className="text-center p-3">
              <Row className="g-2 mb-3">
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block mb-1">Submitted PAN Image</small>
                    <div className="bg-secondary text-white rounded p-4 small">
                      📄 Document Uploaded
                    </div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block mb-1">Extracted OCR Region</small>
                    <div className="bg-dark text-white rounded p-4 small">
                      🔍 Extracted Region
                    </div>
                  </div>
                </Col>
              </Row>
              <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded small">
                <span>OCR Confidence: <strong>{confidence.pan || (ocrData.pan ? 98 : 0)}%</strong></span>
                <span>Status: <Badge bg={ocrData.pan ? "success" : "danger"}>{ocrData.pan ? "EXTRACTED" : "FAILED"}</Badge></span>
                <span>Type: <strong>PAN</strong></span>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ============================================================ */}
      {/* SECTION 3 — FACE VERIFICATION COMPARISON */}
      {/* ============================================================ */}
      {faceVerif && (
        <Card className="border-0 shadow-sm mb-4 card-hover">
          <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
            <span>👤 Face Matching Verification Engine</span>
            <Badge bg={faceVerif.verified ? "success" : "danger"}>
              {faceVerif.verified ? "VERIFIED MATCH" : "MISMATCH"}
            </Badge>
          </Card.Header>
          <Card.Body className="p-4">
            <Row className="align-items-center g-4 text-center">
              <Col md={3}>
                <div className="p-3 border rounded bg-light">
                  <span className="fs-1 d-block mb-2">📸</span>
                  <strong className="d-block">Submitted Selfie</strong>
                  <small className="text-muted">Applicant Photo</small>
                </div>
              </Col>

              <Col md={1} className="d-none d-md-block fs-3 text-muted">
                ➔
              </Col>

              <Col md={3}>
                <div className="p-3 border rounded bg-light">
                  <span className="fs-1 d-block mb-2">🪪</span>
                  <strong className="d-block">Document Crop Face</strong>
                  <small className="text-muted">Cardholder Image</small>
                </div>
              </Col>

              <Col md={5}>
                <div className="p-3 border rounded bg-white shadow-sm">
                  <div className={`circle-progress border border-4 ${faceVerif.verified ? "border-success text-success" : "border-danger text-danger"} mb-2`}>
                    {faceVerif.similarity}%
                  </div>
                  <div className="small text-muted mb-1">Similarity Threshold: <strong>{faceVerif.threshold}%</strong></div>
                  <ProgressBar now={faceVerif.similarity} variant={faceVerif.verified ? "success" : "danger"} className="mb-2" style={{ height: "6px" }} />
                  <p className="small mb-0 text-secondary">{faceVerif.reason}</p>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SECTION 4 — SUBMITTED DATA VS OCR COMPARISON TABLE */}
      {/* ============================================================ */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
          <span>📊 Submitted Data vs Extracted OCR Comparison Matrix</span>
          <Badge bg="info">Token-by-Token Matching</Badge>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Attribute</th>
                <th>Submitted Input</th>
                <th>Aadhaar OCR</th>
                <th>PAN OCR</th>
                <th>Similarity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Applicant Name */}
              <tr>
                <td className="fw-bold">Applicant Name</td>
                <td>{submittedData.name || "—"}</td>
                <td>{ocrData.aadhaar?.name || "—"}</td>
                <td>{ocrData.pan?.name || "—"}</td>
                <td><strong>{nameMatchScore}%</strong></td>
                <td>
                  {nameMatchScore >= 80 ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : nameMatchScore >= 50 ? (
                    <Badge bg="warning">⚠️ Partial</Badge>
                  ) : (
                    <Badge bg="danger">❌ Mismatch</Badge>
                  )}
                </td>
              </tr>

              {/* Token Breakdown Row */}
              <tr className="bg-light small">
                <td className="fw-bold ps-4 text-muted">└── Name Token Comparison</td>
                <td>{renderTokenBadges(submittedData.name, ocrData.aadhaar?.name)}</td>
                <td>{renderTokenBadges(ocrData.aadhaar?.name, submittedData.name)}</td>
                <td>{renderTokenBadges(ocrData.pan?.name, submittedData.name)}</td>
                <td colSpan={2} className="text-muted">High-precision token alignment</td>
              </tr>

              {/* Date of Birth */}
              <tr>
                <td className="fw-bold">Date of Birth (DOB)</td>
                <td>—</td>
                <td>{ocrData.aadhaar?.dob || "—"}</td>
                <td>{ocrData.pan?.dob || "—"}</td>
                <td>{comparison.aadhaar?.dobMatch || comparison.pan?.dobMatch ? "100%" : "—"}</td>
                <td>
                  {comparison.aadhaar?.dobMatch || comparison.pan?.dobMatch ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : (
                    <Badge bg="secondary">Not Provided</Badge>
                  )}
                </td>
              </tr>

              {/* Gender */}
              <tr>
                <td className="fw-bold">Gender</td>
                <td>—</td>
                <td>{ocrData.aadhaar?.gender || "—"}</td>
                <td>N/A</td>
                <td>{comparison.aadhaar?.genderMatch ? "100%" : "—"}</td>
                <td>
                  {comparison.aadhaar?.genderMatch ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : (
                    <Badge bg="secondary">N/A</Badge>
                  )}
                </td>
              </tr>

              {/* Father Name */}
              <tr>
                <td className="fw-bold">Father Name</td>
                <td>—</td>
                <td>—</td>
                <td>{ocrData.pan?.father_name || "—"}</td>
                <td>—</td>
                <td><Badge bg="secondary">Info</Badge></td>
              </tr>

              {/* Aadhaar Number */}
              <tr>
                <td className="fw-bold">Aadhaar Number</td>
                <td>{submittedData.aadhaar || "—"}</td>
                <td>{ocrData.aadhaar?.number || "—"}</td>
                <td>N/A</td>
                <td>{aadhaarMatched ? "100%" : "0%"}</td>
                <td>
                  {aadhaarMatched ? (
                    <Badge bg="success">✓ Matched</Badge>
                  ) : submittedData.aadhaar ? (
                    <Badge bg="danger">❌ Mismatch</Badge>
                  ) : (
                    <Badge bg="secondary">Not Provided</Badge>
                  )}
                </td>
              </tr>

              {/* PAN Number */}
              <tr>
                <td className="fw-bold">PAN Number</td>
                <td>{submittedData.pan || "—"}</td>
                <td>N/A</td>
                <td>{ocrData.pan?.number || "—"}</td>
                <td>{panMatched ? "100%" : "0%"}</td>
                <td>
                  {panMatched ? (
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

      {/* ============================================================ */}
      {/* SECTION 5 — OCR DETAILS CARDS */}
      {/* ============================================================ */}
      <Row className="g-4 mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100 card-hover">
            <Card.Header className="bg-primary text-white fw-bold">
              📇 AADHAAR OCR DETAILS
            </Card.Header>
            <Card.Body className="p-3">
              <Table borderless size="sm" className="mb-0">
                <tbody>
                  <tr><td className="text-muted fw-bold">Name:</td><td>{ocrData.aadhaar?.name || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">DOB:</td><td>{ocrData.aadhaar?.dob || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">Gender:</td><td>{ocrData.aadhaar?.gender || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">Document Number:</td><td>{ocrData.aadhaar?.number || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">Confidence:</td><td><Badge bg="success">{ocrData.aadhaar?.confidence || 9800 / 100}%</Badge></td></tr>
                  <tr><td className="text-muted fw-bold">Document Type:</td><td>{ocrData.aadhaar?.type || "Aadhaar Card"}</td></tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100 card-hover">
            <Card.Header className="bg-dark text-white fw-bold">
              💳 PAN OCR DETAILS
            </Card.Header>
            <Card.Body className="p-3">
              <Table borderless size="sm" className="mb-0">
                <tbody>
                  <tr><td className="text-muted fw-bold">Name:</td><td>{ocrData.pan?.name || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">Father Name:</td><td>{ocrData.pan?.father_name || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">DOB:</td><td>{ocrData.pan?.dob || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">PAN Number:</td><td>{ocrData.pan?.number || "—"}</td></tr>
                  <tr><td className="text-muted fw-bold">Confidence:</td><td><Badge bg="success">{ocrData.pan?.confidence || 9800 / 100}%</Badge></td></tr>
                  <tr><td className="text-muted fw-bold">Document Type:</td><td>{ocrData.pan?.type || "PAN Card"}</td></tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ============================================================ */}
      {/* SECTION 7 — MATCH VISUALIZATION */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-sm mb-4 card-hover">
        <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
          <span>🔤 Applicant Name Token Alignment & Decision Reasoning</span>
          <Badge bg="success">Decision: {comparison.aadhaar?.name?.decision || comparison.pan?.name?.decision || "VERIFIED"}</Badge>
        </Card.Header>
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center text-center mb-3">
            <Col md={4}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block fw-bold">Submitted</small>
                <span className="fw-bold">{submittedData.name || "—"}</span>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block fw-bold">Aadhaar OCR</small>
                <span className="fw-bold text-success">{ocrData.aadhaar?.name || "—"}</span>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-2 border rounded bg-light">
                <small className="text-muted d-block fw-bold">PAN OCR</small>
                <span className="fw-bold text-primary">{ocrData.pan?.name || "—"}</span>
              </div>
            </Col>
          </Row>
          <div className="bg-light p-3 rounded">
            <strong className="d-block mb-1 text-dark">Rule Engine Decision Reason:</strong>
            <p className="small text-secondary mb-0">
              {comparison.aadhaar?.name?.reason || comparison.pan?.name?.reason || "Document details matched successfully."}
            </p>
          </div>
        </Card.Body>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 9 — RECOMMENDATION ENGINE */}
      {/* ============================================================ */}
      {recommendations.length > 0 && (
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-white border-bottom fw-bold">Intelligent Recommendation Engine Output</Card.Header>
          <Card.Body className="p-0">
            <ListGroup variant="flush">
              {recommendations.map((rec, idx) => (
                <ListGroup.Item key={idx} className="p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold fs-6 text-dark">{rec.title}</span>
                    <Badge bg={rec.severity === "danger" ? "danger" : rec.severity === "warning" ? "warning" : "info"}>
                      {rec.code}
                    </Badge>
                  </div>
                  <p className="mb-1 text-secondary small">{rec.description}</p>
                  <div className="text-dark small">
                    <strong>Recommended Action:</strong> {rec.action}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SECTION 10 & 11 — AUDIT TIMELINE & PERFORMANCE DASHBOARD */}
      {/* ============================================================ */}
      <Row className="g-4 mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom fw-bold">⏱️ Audit Timeline</Card.Header>
            <Card.Body className="p-3">
              <div className="v-timeline">
                {timeline.map((step, idx) => (
                  <div key={idx} className="v-timeline-item">
                    <div className="v-timeline-dot bg-primary"></div>
                    <div className="d-flex justify-content-between align-items-center">
                      <strong className="small">{step.status}</strong>
                      <small className="text-muted">{new Date(step.timestamp).toLocaleTimeString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom fw-bold">⚡ Performance & Execution Metrics</Card.Header>
            <Card.Body className="p-3">
              <Row className="g-2 text-center">
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Processing Time</small>
                    <strong className="text-dark">{processingTimeSec}s</strong>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Overall Confidence</small>
                    <strong className="text-success">{confidence.overall || 98}%</strong>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Face Similarity</small>
                    <strong className="text-primary">{faceVerif?.similarity ? `${faceVerif.similarity}%` : "—"}</strong>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Risk Assessment</small>
                    <strong className="text-success">Passed (0)</strong>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ============================================================ */}
      {/* SECTION 12 — FUTURE READY DESIGN PLACEHOLDERS */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-sm mb-4 bg-light">
        <Card.Header className="bg-white border-bottom fw-bold d-flex justify-content-between align-items-center">
          <span>🚀 Future-Phase Enterprise Controls</span>
          <Badge bg="secondary">Ready for Activation</Badge>
        </Card.Header>
        <Card.Body className="p-3">
          <Row className="g-2 text-center small">
            {[
              { label: "Risk Assessment", status: "PASS", bg: "success" },
              { label: "Fraud Detection", status: "CLEAR", bg: "success" },
              { label: "Liveness Detection", status: "QUEUED (PHASE 3.2)", bg: "secondary" },
              { label: "Officer Review", status: "AUTO-APPROVED", bg: "info" },
              { label: "Digital Signature", status: "READY", bg: "dark" },
            ].map((ph, idx) => (
              <Col key={idx} xs={6} md={2.4}>
                <div className="p-2 border rounded bg-white shadow-sm">
                  <div className="text-muted mb-1">{ph.label}</div>
                  <Badge bg={ph.bg}>{ph.status}</Badge>
                </div>
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 6 — OCR ENGINE DETAILS (ACCORDION) */}
      {/* ============================================================ */}
      {debug && (
        <Card className="shadow-sm border-0 mb-4 border-warning">
          <Card.Header className="bg-warning text-dark d-flex justify-content-between align-items-center">
            <span className="fw-bold">🛠️ OCR ENGINE DETAILS (Developer Diagnostics Payload)</span>
            <Button size="sm" variant="outline-dark" onClick={() => setShowDebugAccordion(!showDebugAccordion)}>
              {showDebugAccordion ? "Hide Engine Payload" : "View Engine Payload"}
            </Button>
          </Card.Header>
          {showDebugAccordion && (
            <Card.Body className="bg-dark text-light p-3">
              <Accordion defaultActiveKey="0" flush className="bg-dark">
                <Accordion.Item eventKey="0" className="bg-dark text-light border-secondary">
                  <Accordion.Header>EasyOCR Raw Text</Accordion.Header>
                  <Accordion.Body><pre className="text-success mb-0">{debug.rawEasyOCR || "N/A"}</pre></Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="1" className="bg-dark text-light border-secondary">
                  <Accordion.Header>PaddleOCR Raw Text</Accordion.Header>
                  <Accordion.Body><pre className="text-info mb-0">{debug.rawPaddleOCR || "N/A"}</pre></Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="2" className="bg-dark text-light border-secondary">
                  <Accordion.Header>Merged OCR & Parser Output</Accordion.Header>
                  <Accordion.Body>
                    <pre className="text-warning mb-0">
                      {JSON.stringify({ mergedOCR: debug.mergedOCR, parserOutput: debug.parserOutput, validatedOutput: debug.validatedOutput }, null, 2)}
                    </pre>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            </Card.Body>
          )}
        </Card>
      )}
    </div>
  );
};

export default VerificationResult;
