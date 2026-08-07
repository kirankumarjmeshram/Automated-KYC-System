import React, { useState } from "react";
import { Container, Form, Button, Card, Alert, ProgressBar } from "react-bootstrap";
import axios from "axios";
import VerificationResult from "./VerificationResult";
import { generateTraceId, logger } from "../utils/logger";
import CameraDeviceManager from "./live/CameraDeviceManager";
import { getOrCreateSessionId } from "../utils/sessionManager";

const KycStepupForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", aadhaar: "", pan: "" });
  const [files, setFiles] = useState({ aadhaarFile: null, panFile: null, selfieFile: null });
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  // Convert base64 data URL to File object
  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const handleLiveCapture = (imageSrc) => {
    if (imageSrc) {
      setLiveSnapshot(imageSrc);
      const capturedFile = dataURLtoFile(imageSrc, `live_selfie_${Date.now()}.jpg`);
      setFiles((prev) => ({ ...prev, selfieFile: capturedFile }));
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setVerificationResult(null);
    setLoading(true);

    if (!files.aadhaarFile || !files.panFile) {
      setError("Please upload both Aadhaar and PAN files.");
      setLoading(false);
      return;
    }

    const traceId = generateTraceId();
    const sessionId = getOrCreateSessionId();
    const startTime = Date.now();
    logger.info("KYC Verification submission started", { traceId, sessionId, name: formData.name });

    const formDataObj = new FormData();
    formDataObj.append("name", formData.name.trim());
    formDataObj.append("aadhaar", formData.aadhaar.trim());
    formDataObj.append("pan", formData.pan.trim());
    formDataObj.append("aadhaarFile", files.aadhaarFile);
    formDataObj.append("panFile", files.panFile);
    if (files.selfieFile) {
      formDataObj.append("selfieFile", files.selfieFile);
    }

    const localPreviews = {
      aadhaar: files.aadhaarFile ? URL.createObjectURL(files.aadhaarFile) : null,
      pan: files.panFile ? URL.createObjectURL(files.panFile) : null,
      selfie: liveSnapshot || (files.selfieFile ? URL.createObjectURL(files.selfieFile) : null),
    };

    try {
      const response = await axios.post("http://localhost:5000/api/verify", formDataObj, {
        headers: {
          "Accept": "application/json",
          "x-trace-id": traceId,
        },
      });

      const duration = Date.now() - startTime;
      logger.info("KYC Verification response received", {
        traceId: response.data.traceId || traceId,
        status: response.data.status,
        verified: response.data.verified,
        duration: `${duration}ms`,
      });

      setVerificationResult({ ...response.data, _uploadedPreviews: localPreviews });
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err.response && err.response.data) {
        logger.warn("KYC Verification failed with API response", {
          traceId: err.response.data.traceId || traceId,
          status: err.response.data.status,
          error: err.response.data.message || err.response.data.error,
          duration: `${duration}ms`,
        });
        setVerificationResult({ ...err.response.data, _uploadedPreviews: localPreviews });
      } else {
        logger.error("Network or unexpected server error", { traceId, error: err.message, duration: `${duration}ms` });
        setError("Network error. Could not connect to verification server.");
      }
    }
    setLoading(false);
  };

  return (
    <Container className="mt-4">
      <Card className="shadow-sm border-0">
        <Card.Body>
          <h2 className="text-center fw-bold mb-4">KYC Verification</h2>

          {step === 1 && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Full Name</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name as on documents"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Aadhaar Number</Form.Label>
                <Form.Control
                  type="text"
                  name="aadhaar"
                  value={formData.aadhaar}
                  onChange={handleChange}
                  placeholder="12-digit Aadhaar Number"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">PAN Number</Form.Label>
                <Form.Control
                  type="text"
                  name="pan"
                  value={formData.pan}
                  onChange={handleChange}
                  placeholder="10-character PAN Number"
                  required
                />
              </Form.Group>

              <Button onClick={nextStep} variant="primary" className="mt-2 w-100">
                Next
              </Button>
            </Form>
          )}

          {step === 2 && (
            <Form onSubmit={handleSubmit} encType="multipart/form-data">
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Upload Aadhaar Card Image</Form.Label>
                <Form.Control type="file" name="aadhaarFile" onChange={handleFileChange} required />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Upload PAN Card Image</Form.Label>
                <Form.Control type="file" name="panFile" onChange={handleFileChange} required />
              </Form.Group>

              <Form.Group className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="fw-bold mb-0">Selfie Photo / Live Camera Capture</Form.Label>
                  <Button
                    variant={showCamera ? "outline-secondary" : "outline-primary"}
                    size="sm"
                    onClick={() => setShowCamera(!showCamera)}
                  >
                    {showCamera ? "📁 Switch to File Upload" : "📷 Open Live Camera"}
                  </Button>
                </div>

                {showCamera ? (
                  <div className="mt-2">
                    <CameraDeviceManager onCapture={handleLiveCapture} />
                    {liveSnapshot && (
                      <div className="text-center mt-2 p-2 border rounded bg-light">
                        <small className="fw-bold text-success d-block mb-1">✓ Live Snapshot Captured!</small>
                        <img src={liveSnapshot} alt="Live Snapshot" style={{ maxHeight: "120px" }} className="rounded shadow-sm" />
                      </div>
                    )}
                  </div>
                ) : (
                  <Form.Control type="file" name="selfieFile" accept="image/*" onChange={handleFileChange} />
                )}
              </Form.Group>

              {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

              <div className="d-flex justify-content-between mt-4">
                <Button onClick={prevStep} variant="outline-secondary">
                  Back
                </Button>
                <Button type="submit" variant="success" disabled={loading}>
                  {loading ? "Processing..." : "Submit Verification"}
                </Button>
              </div>
            </Form>
          )}

          {loading && (
            <div className="mt-4 text-center">
              <p className="text-muted fw-bold">Processing documents with AI engine...</p>
              <ProgressBar animated now={100} variant="info" />
            </div>
          )}

          {verificationResult && <VerificationResult data={verificationResult} />}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default KycStepupForm;
