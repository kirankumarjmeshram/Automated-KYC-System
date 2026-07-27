import React, { useState } from "react";
import { Container, Form, Button, Card, Alert, ProgressBar } from "react-bootstrap";
import axios from "axios";
import VerificationResult from "./VerificationResult";

const KycStepupForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", aadhaar: "", pan: "" });
  const [files, setFiles] = useState({ aadhaarFile: null, panFile: null });
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
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

    const formDataObj = new FormData();
    formDataObj.append("name", formData.name.trim());
    formDataObj.append("aadhaar", formData.aadhaar.trim());
    formDataObj.append("pan", formData.pan.trim());
    formDataObj.append("aadhaarFile", files.aadhaarFile);
    formDataObj.append("panFile", files.panFile);

    try {
      const response = await axios.post("http://localhost:5000/api/verify", formDataObj, {
        headers: { "Accept": "application/json" },
      });
      setVerificationResult(response.data);
    } catch (err) {
      if (err.response && err.response.data) {
        setVerificationResult(err.response.data);
      } else {
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
