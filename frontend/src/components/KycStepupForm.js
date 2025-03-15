// KycStepupForm.js
import React, { useState } from "react";
import { Container, Form, Button, Card, Alert, ProgressBar } from "react-bootstrap";
import axios from "axios";

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
    } catch (error) {
      setError("Verification failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Container className="mt-4">
      <Card>
        <Card.Body>
          <h2 className="text-center">KYC Verification</h2>
          {step === 1 && (
            <Form>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required />
              </Form.Group>
              <Form.Group>
                <Form.Label>Aadhaar Number</Form.Label>
                <Form.Control type="text" name="aadhaar" value={formData.aadhaar} onChange={handleChange} required />
              </Form.Group>
              <Form.Group>
                <Form.Label>PAN Number</Form.Label>
                <Form.Control type="text" name="pan" value={formData.pan} onChange={handleChange} required />
              </Form.Group>
              <Button onClick={nextStep} className="mt-3">Next</Button>
            </Form>
          )}
          {step === 2 && (
            <Form onSubmit={handleSubmit} encType="multipart/form-data">
              <Form.Group>
                <Form.Label>Upload Aadhaar Card</Form.Label>
                <Form.Control type="file" name="aadhaarFile" onChange={handleFileChange} required />
              </Form.Group>
              <Form.Group>
                <Form.Label>Upload PAN Card</Form.Label>
                <Form.Control type="file" name="panFile" onChange={handleFileChange} required />
              </Form.Group>
              {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
              <Button onClick={prevStep} className="mt-3 me-2">Back</Button>
              <Button type="submit" className="mt-3" disabled={loading}>{loading ? "Processing..." : "Submit"}</Button>
            </Form>
          )}
          {loading && <ProgressBar animated now={100} className="mt-3" />}
          {verificationResult && (
            <Alert className="mt-3" variant={verificationResult.success ? "success" : "danger"}>
              {verificationResult.success ? "KYC Verified Successfully!" : `Verification Failed: ${verificationResult.error}`}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default KycStepupForm;
