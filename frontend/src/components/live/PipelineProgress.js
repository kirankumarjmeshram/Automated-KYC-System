import React, { useState, useEffect } from "react";
import { Card, ProgressBar, Spinner, Badge } from "react-bootstrap";

/**
 * Animated Multi-Stage AI Verification Pipeline Component
 * Renders the frozen captured best frame and animates pipeline stages cleanly during backend AI execution.
 */
const PipelineProgress = ({ capturedBestFrame }) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progressPct, setProgressPct] = useState(10);

  const stages = [
    { label: "Image Validation & Preprocessing", icon: "📷" },
    { label: "Dual OCR Extraction (PaddleOCR & EasyOCR)", icon: "🔍" },
    { label: "Gemini Multimodal Structure Parsing", icon: "🤖" },
    { label: "Identity & Name Document Matching", icon: "📋" },
    { label: "Facial Landmark & Bounding Box Detection", icon: "👤" },
    { label: "Face Feature Vector Matching", icon: "🧬" },
    { label: "MediaPipe Blink & Head Pose Liveness Detection", icon: "✨" },
    { label: "Enterprise Decision & Risk Engine Evaluation", icon: "🛡️" }
  ];

  useEffect(() => {
    // Stage Animation Loop over ~6-8 seconds total
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < stages.length - 1) {
          const next = prev + 1;
          setProgressPct(Math.round(((next + 1) / stages.length) * 100));
          return next;
        }
        return prev;
      });
    }, 900);

    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden mb-4">
      <Card.Header className="bg-primary text-white py-3 text-center">
        <h5 className="fw-bold mb-0">⚡ AI KYC Pipeline Execution</h5>
        <small className="opacity-75">Analyzing document extractions and facial biometrics...</small>
      </Card.Header>

      <Card.Body className="p-4">
        {/* Captured Best Frame Preview */}
        {capturedBestFrame && (
          <div className="text-center mb-4">
            <small className="text-muted fw-bold d-block mb-2">FREEZED CAPTURED BEST FRAME</small>
            <div className="d-inline-block position-relative rounded overflow-hidden shadow-sm border border-success p-1 bg-white">
              <img src={capturedBestFrame} alt="Captured Best Frame" style={{ maxHeight: "160px", width: "auto" }} className="rounded" />
              <Badge bg="success" className="position-absolute bottom-0 end-0 m-2 shadow-sm">
                ✓ Best Frame Selected
              </Badge>
            </div>
          </div>
        )}

        {/* Progress Bar & Percentage */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="fw-bold text-secondary">Verification Progress</span>
            <span className="fw-bold text-primary fs-5">{progressPct}%</span>
          </div>
          <ProgressBar animated now={progressPct} variant="success" style={{ height: "10px" }} className="rounded-pill" />
          <div className="text-end mt-1">
            <small className="text-muted">Estimated time remaining: ~{Math.max(1, Math.ceil((100 - progressPct) / 20))}s</small>
          </div>
        </div>

        {/* Pipeline Stage List */}
        <div className="border rounded bg-light p-3">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <div key={idx} className={`d-flex align-items-center justify-content-between p-2 rounded mb-1 ${isCurrent ? "bg-white shadow-sm border" : ""}`}>
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-5">{stage.icon}</span>
                  <span className={`small ${isCurrent ? "fw-bold text-dark" : isCompleted ? "text-success" : "text-muted"}`}>
                    {stage.label}
                  </span>
                </div>
                <div>
                  {isCompleted && <span className="text-success fw-bold">✓ Done</span>}
                  {isCurrent && <Spinner animation="border" size="sm" variant="primary" />}
                  {idx > currentStageIndex && <span className="text-muted small">Pending</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
};

export default PipelineProgress;
