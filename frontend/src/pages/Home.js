import React from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <Container className="text-center mt-5">
      <Row>
        <Col>
          <h1>Welcome to Aadhaar & PAN Verification System</h1>
          <p className="lead">Upload your Aadhaar or PAN card image and verify its authenticity.</p>
          <Button as={Link} to="/verify" variant="primary">Start Verification</Button>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;
