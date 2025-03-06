import React from "react";
import { Alert } from "react-bootstrap";

const VerificationResult = ({ data }) => {
  return (
    <Alert variant={data.success ? "success" : "danger"} className="mt-3">
      {data.success ? (
        <>
          <h4>✅ Verification Successful</h4>
          <p><strong>Type:</strong> {data.details.type}</p>
          <p><strong>Name:</strong> {data.details.name}</p>
          <p><strong>Number:</strong> {data.details.number}</p>
          <p><strong>Date of Birth:</strong> {data.details.dob}</p>
        </>
      ) : (
        <h4>❌ {data.message}</h4>
      )}
    </Alert>
  );
};

export default VerificationResult;
