import React, { useState } from "react";
import {
  Container,
  Form,
  Button,
  Card,
  Alert,
  ProgressBar,
} from "react-bootstrap";
import axios from "axios";

const KycStepupForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", aadhaar: "", pan: "" });
  const [files, setFiles] = useState({ aadhaarFile: null, panFile: null });
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  //   const handleSubmit = async (e) => {
  //     e.preventDefault();
  //     setLoading(true);

  //     const formDataObj = new FormData();
  //     formDataObj.append("name", formData.name);
  //     formDataObj.append("aadhaar", formData.aadhaar);
  //     formDataObj.append("pan", formData.pan);
  //     if (files.aadhaarFile) formDataObj.append("aadhaarFile", files.aadhaarFile);
  //     if (files.panFile) formDataObj.append("panFile", files.panFile);

  //     try {
  //       const response = await axios.post("http://localhost:5000/verify", formDataObj, {
  //         headers: { "Content-Type": "multipart/form-data" },
  //       });
  //       setVerificationResult(response.data);
  //     } catch (error) {
  //       setVerificationResult({ success: false, error: "Verification failed. Unable to connect to the server." });
  //     }
  //     setLoading(false);
  //   };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formDataObj = new FormData();
    formDataObj.append("name", formData.name);
    formDataObj.append("aadhaar", formData.aadhaar);
    formDataObj.append("pan", formData.pan);
    formDataObj.append("aadhaarFile", files.aadhaarFile);
    formDataObj.append("panFile", files.panFile);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/process",
        formDataObj,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.success) {
        setVerificationResult({
          success: true,
          message: "KYC Verified Successfully!",
        });
      } else {
        setVerificationResult({
          success: false,
          message: "Verification Failed",
          mismatches: response.data.mismatches || ["Unknown error"],
        });
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: "Failed to connect to the server. Please try again.",
      });
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
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Aadhaar Number</Form.Label>
                <Form.Control
                  type="text"
                  name="aadhaar"
                  value={formData.aadhaar}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>PAN Number</Form.Label>
                <Form.Control
                  type="text"
                  name="pan"
                  value={formData.pan}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Button onClick={nextStep} className="mt-3">
                Next
              </Button>
            </Form>
          )}
          {step === 2 && (
            <Form onSubmit={handleSubmit}>
              <Form.Group>
                <Form.Label>Upload Aadhaar Card</Form.Label>
                <Form.Control
                  type="file"
                  name="aadhaarFile"
                  onChange={handleFileChange}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Upload PAN Card</Form.Label>
                <Form.Control
                  type="file"
                  name="panFile"
                  onChange={handleFileChange}
                  required
                />
              </Form.Group>
              <Button onClick={prevStep} className="mt-3 me-2">
                Back
              </Button>
              <Button type="submit" className="mt-3" disabled={loading}>
                {loading ? "Processing..." : "Submit"}
              </Button>
            </Form>
          )}
          {loading && <ProgressBar animated now={100} className="mt-3" />}
          {/* {verificationResult && (
            <Alert className="mt-3" variant={verificationResult.success ? "success" : "danger"}>
              {verificationResult.success ? (
                "KYC Verified Successfully!"
              ) : (
                <>
                  <strong>Verification Failed:</strong> 
                  {verificationResult.error && <div>{verificationResult.error}</div>}
                  <ul>
                    {verificationResult.mismatches &&
                      verificationResult.mismatches.map((mismatch, index) => (
                        <li key={index}>{mismatch}</li>
                      ))}
                  </ul>
                </>
              )}
            </Alert>
          )} */}
          {verificationResult && (
            <Alert
              className="mt-3"
              variant={verificationResult.success ? "success" : "danger"}
            >
              {verificationResult.success ? (
                "KYC Verified Successfully!"
              ) : (
                <>
                  <strong>Verification Failed:</strong>{" "}
                  {verificationResult.error}
                  {verificationResult.mismatches && (
                    <ul>
                      {verificationResult.mismatches.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default KycStepupForm;
