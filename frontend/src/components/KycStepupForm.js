import React, { useState } from "react";
import { Container, Form, Button, Card, Alert, Row, Col, Badge } from "react-bootstrap";
import axios from "axios";
import VerificationResult from "./VerificationResult";
import GuidedCameraWorkspace from "./live/GuidedCameraWorkspace";
import PipelineProgress from "./live/PipelineProgress";
import { generateTraceId, logger } from "../utils/logger";
import { getOrCreateSessionId, resetSessionId } from "../utils/sessionManager";

/**
 * Production KYC Customer Verification Wizard Component
 * Implements clean 8-step enterprise state machine:
 * Step 1: Name & ID Numbers -> Step 2: Aadhaar Card -> Step 3: PAN Card -> Step 4: Camera Ready
 * -> Step 5: Guided Recording -> Step 6: Stream Closed -> Step 7: Animated AI Pipeline -> Step 8: Verification Results
 */
const KycStepupForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", aadhaar: "", pan: "" });
  const [files, setFiles] = useState({ aadhaarFile: null, panFile: null, selfieFile: null });
  const [capturedBestFrame, setCapturedBestFrame] = useState(null);
  
  // State Machine Flags
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  // Convert Base64 Snapshot to JPEG File
  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  // Step Navigation
  const nextStep = () => {
    setError("");
    if (step === 1) {
      if (!formData.name || (!formData.aadhaar && !formData.pan)) {
        setError("Please enter your Full Name and at least one ID Number.");
        return;
      }
    } else if (step === 2) {
      if (!files.aadhaarFile || !files.panFile) {
        setError("Please upload both your Aadhaar Card and PAN Card document images.");
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setError("");
    setStep((prev) => prev - 1);
  };

  // Handle Guided Live Capture Completion
  const handleRecordingComplete = async ({ bestFrame, frameCount }) => {
    console.log(`[KycStepupForm] Guided Recording Complete. ${frameCount} frames collected.`);
    setCapturedBestFrame(bestFrame);
    
    // Create selfie file from best frame snapshot
    let selfieFileObj = files.selfieFile;
    if (bestFrame) {
      selfieFileObj = dataURLtoFile(bestFrame, `live_best_frame_${Date.now()}.jpg`);
    }

    // Move to Step 4: AI Pipeline Execution (Camera Stream Destroyed & Released)
    setStep(4);
    setIsProcessing(true);
    executeBackendVerification(selfieFileObj, bestFrame);
  };

  // Execute Backend API Verification
  const executeBackendVerification = async (selfieFileObj, bestFrameSrc) => {
    setError("");
    const traceId = generateTraceId();
    const sessionId = getOrCreateSessionId();
    const startTime = Date.now();

    logger.info("Enterprise KYC Verification API submission started", { traceId, sessionId, name: formData.name });

    const formDataObj = new FormData();
    formDataObj.append("name", formData.name.trim());
    formDataObj.append("aadhaar", formData.aadhaar.trim());
    formDataObj.append("pan", formData.pan.trim());
    formDataObj.append("aadhaarFile", files.aadhaarFile);
    formDataObj.append("panFile", files.panFile);
    if (selfieFileObj) {
      formDataObj.append("selfieFile", selfieFileObj);
    }

    const localPreviews = {
      aadhaar: files.aadhaarFile ? URL.createObjectURL(files.aadhaarFile) : null,
      pan: files.panFile ? URL.createObjectURL(files.panFile) : null,
      selfie: bestFrameSrc || (files.selfieFile ? URL.createObjectURL(files.selfieFile) : null),
    };

    try {
      const response = await axios.post("http://localhost:5000/api/verify", formDataObj, {
        headers: {
          "Accept": "application/json",
          "x-trace-id": traceId,
          "x-session-id": sessionId,
        },
      });

      const duration = Date.now() - startTime;
      logger.info("KYC Verification response received", {
        traceId: response.data.traceId || traceId,
        status: response.data.status,
        verified: response.data.verified,
        duration: `${duration}ms`,
      });

      // Artificial small delay to allow animated pipeline progress bar to reach 100%
      setTimeout(() => {
        setIsProcessing(false);
        setVerificationResult({ ...response.data, _uploadedPreviews: localPreviews });
        setStep(5); // Step 5: Verification Result Screen
      }, 1200);

    } catch (err) {
      const duration = Date.now() - startTime;
      setIsProcessing(false);
      
      if (err.response && err.response.data) {
        logger.warn("KYC Verification failed with API response", {
          traceId: err.response.data.traceId || traceId,
          status: err.response.data.status,
          error: err.response.data.message || err.response.data.error,
          duration: `${duration}ms`,
        });
        setVerificationResult({ ...err.response.data, _uploadedPreviews: localPreviews });
        setStep(5);
      } else {
        logger.error("Network or unexpected server error", { traceId, error: err.message, duration: `${duration}ms` });
        setError("Network error. Could not connect to verification server.");
        setStep(3); // Fallback back to camera step
      }
    }
  };

  // Reset Complete Session to Start New Customer Verification
  const handleResetSession = () => {
    resetSessionId();
    setStep(1);
    setFormData({ name: "", aadhaar: "", pan: "" });
    setFiles({ aadhaarFile: null, panFile: null, selfieFile: null });
    setCapturedBestFrame(null);
    setVerificationResult(null);
    setIsProcessing(false);
    setError("");
  };

  return (
    <Container className="my-4" style={{ maxWidth: "850px" }}>
      {/* Header Banner */}
      <div className="text-center mb-4">
        <Badge bg="primary" className="px-3 py-2 mb-2 rounded-pill shadow-sm fs-6">
          🔒 Enterprise CKYC & DigiLocker Gateway
        </Badge>
        <h2 className="fw-bold text-dark mb-1">Automated Identity Verification</h2>
        <p className="text-muted small">Fast, Secure AI-Powered Document OCR & Live Facial Biometrics</p>
      </div>

      {/* Step Wizard Progress Bar */}
      {step <= 3 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className={`small fw-bold ${step >= 1 ? "text-primary" : "text-muted"}`}>1. Applicant Details</span>
              <span className={`small fw-bold ${step >= 2 ? "text-primary" : "text-muted"}`}>2. Document Upload (Aadhaar & PAN)</span>
              <span className={`small fw-bold ${step >= 3 ? "text-primary" : "text-muted"}`}>3. Live Facial Verification</span>
            </div>
            <div className="progress" style={{ height: "6px" }}>
              <div
                className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </Card.Body>
        </Card>
      )}

      {/* STEP 1: Applicant Details */}
      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-bottom py-3">
            <h5 className="fw-bold mb-0 text-dark">Step 1: Enter Customer Information</h5>
          </Card.Header>
          <Card.Body className="p-4">
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            <Form>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Full Name (as printed on ID)</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. KIRANKUMAR JAGESHWAR MESHRAM"
                  size="lg"
                  required
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">Aadhaar Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="aadhaar"
                      value={formData.aadhaar}
                      onChange={handleChange}
                      placeholder="12-digit Aadhaar Number"
                      maxLength={14}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">PAN Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="pan"
                      value={formData.pan}
                      onChange={handleChange}
                      placeholder="10-character PAN Number"
                      maxLength={10}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Button onClick={nextStep} variant="primary" size="lg" className="mt-3 w-100 fw-bold">
                Continue to Document Upload ➔
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}

      {/* STEP 2: Unified Document Upload (Aadhaar & PAN) */}
      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-bottom py-3">
            <h5 className="fw-bold mb-0 text-dark">Step 2: Upload Identity Documents</h5>
          </Card.Header>
          <Card.Body className="p-4">
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            
            <Row className="g-3">
              {/* Aadhaar Upload Box */}
              <Col md={6}>
                <div className="p-3 border border-2 border-dashed rounded bg-light text-center h-100 d-flex flex-column justify-content-between">
                  <div>
                    <span className="fs-2 d-block mb-1">📄</span>
                    <h6 className="fw-bold text-dark mb-1">Aadhaar Card Image</h6>
                    <p className="text-muted small mb-2">Upload Front Side of Aadhaar Card</p>
                  </div>
                  <div>
                    <Form.Control
                      type="file"
                      name="aadhaarFile"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="mb-2"
                    />
                    {files.aadhaarFile && (
                      <Badge bg="success" className="p-2 w-100 text-truncate">
                        ✓ {files.aadhaarFile.name} ({(files.aadhaarFile.size / 1024).toFixed(1)} KB)
                      </Badge>
                    )}
                  </div>
                </div>
              </Col>

              {/* PAN Upload Box */}
              <Col md={6}>
                <div className="p-3 border border-2 border-dashed rounded bg-light text-center h-100 d-flex flex-column justify-content-between">
                  <div>
                    <span className="fs-2 d-block mb-1">💳</span>
                    <h6 className="fw-bold text-dark mb-1">PAN Card Image</h6>
                    <p className="text-muted small mb-2">Upload Front Side of PAN Card</p>
                  </div>
                  <div>
                    <Form.Control
                      type="file"
                      name="panFile"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="mb-2"
                    />
                    {files.panFile && (
                      <Badge bg="success" className="p-2 w-100 text-truncate">
                        ✓ {files.panFile.name} ({(files.panFile.size / 1024).toFixed(1)} KB)
                      </Badge>
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            <div className="d-flex justify-content-between mt-4">
              <Button onClick={prevStep} variant="outline-secondary" size="lg">
                ← Back
              </Button>
              <Button onClick={nextStep} variant="primary" size="lg" className="fw-bold">
                Proceed to Live Facial Verification ➔
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* STEP 3: Live Camera & Guided Verification Workspace */}
      {step === 3 && (
        <div>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          <GuidedCameraWorkspace
            onRecordingComplete={handleRecordingComplete}
            onError={(msg) => setError(msg)}
          />
          <div className="text-start mt-2">
            <Button onClick={prevStep} variant="outline-secondary" size="sm">
              ← Back to Document Upload
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: AI Verification Pipeline Execution (Camera Stream Destroyed) */}
      {step === 4 && isProcessing && (
        <PipelineProgress capturedBestFrame={capturedBestFrame} />
      )}

      {/* STEP 5: Complete Verification Result & Action Controls */}
      {step === 5 && verificationResult && (
        <div>
          <VerificationResult data={verificationResult} />
          
          <Card className="border-0 shadow-sm mt-4 mb-4">
            <Card.Body className="p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="text-muted small fw-bold">Verification Complete</span>
              <div className="d-flex gap-2">
                <Button variant="primary" onClick={handleResetSession}>
                  🔄 Verify Another Customer
                </Button>
                <Button variant="outline-secondary" onClick={() => window.print()}>
                  📥 Download Compliance Report
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      )}
    </Container>
  );
};

export default KycStepupForm;
