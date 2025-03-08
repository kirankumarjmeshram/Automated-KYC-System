import React from "react";
import { Container } from "react-bootstrap";
import KycStepupForm from "./components/KycStepupForm";

function App() {
  return (
    <Container>
      <h1 className="text-center mt-4">Automated KYC System</h1>
      <KycStepupForm />
    </Container>
  );
}

export default App;
