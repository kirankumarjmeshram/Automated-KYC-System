import React, { useState } from "react";
import { Form, Button, Container, Row, Col } from "react-bootstrap";
import axios from "axios";
import VerificationResult from "./VerificationResult";

const AadhaarPanForm = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please upload an Aadhaar or PAN card image.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setLoading(true);
      const response = await axios.post("http://localhost:5000/api/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
    } catch (error) {
      setResult({ success: false, message: "Server error. Try again later." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row>
        <Col md={6} className="mx-auto">
          <h2 className="text-center">Aadhaar & PAN Verification</h2>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Upload Aadhaar/PAN Image</Form.Label>
              <Form.Control type="file" accept="image/*" onChange={handleFileChange} required />
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
              {loading ? "Processing..." : "Verify"}
            </Button>
          </Form>

          {result && <VerificationResult data={result} />}
        </Col>
      </Row>
    </Container>
  );
};

export default AadhaarPanForm;
