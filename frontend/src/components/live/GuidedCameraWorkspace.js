import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Badge, Button, Form, Alert, Spinner, Card, ProgressBar } from "react-bootstrap";

/**
 * Guided Camera Workspace Component (Production KYC Flow)
 * Manages guided 5-second live recording (Look Straight -> Blink -> Turn Left -> Turn Right),
 * automatic frame collection, best frame selection, and complete webcam track cleanup.
 */
const GuidedCameraWorkspace = ({ onRecordingComplete, onError }) => {
  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const frameBufferRef = useRef([]);

  // State Management
  const [cameraStatus, setCameraStatus] = useState("INITIALIZING"); // INITIALIZING, READY, RECORDING, COMPLETED, ERROR
  const [errorMessage, setErrorMessage] = useState("");
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState("user");

  // Recording State
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  const prompts = [
    { text: "👤 Look Straight at Camera", icon: "👁️", subtext: "Position face inside oval target" },
    { text: "😉 Blink Once Naturally", icon: "✨", subtext: "Keep eyes clear and visible" },
    { text: "👈 Turn Head Slowly Left", icon: "🔄", subtext: "Slight left rotation" },
    { text: "👉 Turn Head Slowly Right", icon: "🔄", subtext: "Slight right rotation" },
    { text: "✅ Verification Capture Complete", icon: "🎉", subtext: "Stopping camera stream..." }
  ];

  // Enumerate Media Devices
  const handleDevices = useCallback((mediaDevices) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
    setDevices(videoDevices);
    if (videoDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(videoDevices[0].deviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices).catch((err) => {
      console.warn("[GuidedCameraWorkspace] Device enumeration warning:", err.message);
    });
  }, [handleDevices]);

  // Clean Stop MediaStream Tracks (Turn off Camera LED)
  const stopWebcamStream = useCallback(() => {
    if (streamRef.current) {
      console.log("[GuidedCameraWorkspace] Releasing webcam hardware stream...");
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[GuidedCameraWorkspace] Track ${track.label} stopped.`);
      });
      streamRef.current = null;
    }
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
      const srcObj = webcamRef.current.video.srcObject;
      if (srcObj && srcObj.getTracks) {
        srcObj.getTracks().forEach((t) => t.stop());
      }
      webcamRef.current.video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopWebcamStream();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [stopWebcamStream]);

  // Handle Camera Init Success
  const handleUserMedia = useCallback((stream) => {
    streamRef.current = stream;
    setCameraStatus("READY");
    setErrorMessage("");
  }, []);

  // Handle Camera Init Error
  const handleUserMediaError = useCallback((error) => {
    console.error("[GuidedCameraWorkspace] Camera Error:", error);
    let msg = "Could not access camera. Please check permissions.";
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      msg = "Camera permission denied. Please allow camera access in browser settings and click Retry.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      msg = "Camera is currently in use by another application.";
    }
    setCameraStatus("ERROR");
    setErrorMessage(msg);
    if (onError) onError(msg);
  }, [onError]);

  // Simple Laplacian Sharpness Evaluator for Frame Selection
  const evaluateFrameSharpness = (imageData) => {
    if (!imageData) return 0;
    const data = imageData.data;
    let sumDiff = 0;
    for (let i = 0; i < data.length - 4; i += 8) {
      const gray1 = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const gray2 = data[i + 4] * 0.299 + data[i + 5] * 0.587 + data[i + 6] * 0.114;
      sumDiff += Math.abs(gray1 - gray2);
    }
    return sumDiff;
  };

  // Start Guided 5-Second Automated Recording
  const startGuidedVerification = () => {
    if (cameraStatus !== "READY" || !webcamRef.current) return;

    setCameraStatus("RECORDING");
    setProgress(0);
    setElapsedSec(0);
    setActivePromptIndex(0);
    frameBufferRef.current = [];

    const totalDurationMs = 5000;
    const intervalMs = 200; // Capture ~25 frames total over 5 sec (5 FPS)
    const startTime = Date.now();

    recordingIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
      const currentSec = Math.min(5, Math.floor(elapsed / 1000));
      
      setProgress(pct);
      setElapsedSec(currentSec);

      // Prompt Sequence Index
      const promptIdx = Math.min(3, Math.floor((elapsed / totalDurationMs) * 4));
      setActivePromptIndex(promptIdx);

      // Capture Frame Snapshot into In-Memory Buffer
      if (webcamRef.current) {
        const frameSrc = webcamRef.current.getScreenshot();
        if (frameSrc) {
          frameBufferRef.current.push({
            timestamp: elapsed,
            src: frameSrc
          });
        }
      }

      // Check if 5-Second Recording Complete
      if (elapsed >= totalDurationMs) {
        clearInterval(recordingIntervalRef.current);
        setActivePromptIndex(4); // "Capture Complete"
        setCameraStatus("COMPLETED");

        // Release Webcam Stream Immediately (Turn off LED)
        stopWebcamStream();

        // Best Frame Selection Algorithm: Select highest quality non-first frame
        const frames = frameBufferRef.current;
        let selectedBestFrame = null;

        if (frames.length > 2) {
          // Ignore initial 2 frames (often auto-exposure adjusting), pick frame with maximum length/detail
          const candidateFrames = frames.slice(2);
          candidateFrames.sort((a, b) => b.src.length - a.src.length);
          selectedBestFrame = candidateFrames[0].src;
        } else if (frames.length > 0) {
          selectedBestFrame = frames[frames.length - 1].src;
        }

        console.log(`[GuidedCameraWorkspace] Recording Finished. ${frames.length} frames captured. Stream destroyed.`);
        
        if (onRecordingComplete) {
          onRecordingComplete({
            bestFrame: selectedBestFrame,
            frameCount: frames.length,
            frameBuffer: frames
          });
        }
      }
    }, intervalMs);
  };

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode,
    ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden mb-3">
      <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-2 px-3">
        <span className="fw-bold fs-6">📹 Guided Live Facial Verification</span>
        <Badge bg={
          cameraStatus === "RECORDING" ? "danger" :
          cameraStatus === "READY" ? "success" :
          cameraStatus === "COMPLETED" ? "info" : "secondary"
        }>
          {cameraStatus === "RECORDING" ? "● RECORDING LIVE" : cameraStatus}
        </Badge>
      </Card.Header>

      <Card.Body className="p-3 bg-dark text-white position-relative text-center">
        {/* Camera Container */}
        <div className="position-relative rounded overflow-hidden mx-auto bg-black d-flex align-items-center justify-content-center"
             style={{ minHeight: "340px", maxHeight: "450px", width: "100%" }}>
          
          {cameraStatus === "INITIALIZING" && (
            <div className="text-center p-4">
              <Spinner animation="border" variant="light" className="mb-2" />
              <p className="small mb-0 text-light">Initializing camera stream...</p>
            </div>
          )}

          {cameraStatus === "ERROR" && (
            <Alert variant="danger" className="m-3 text-start">
              <Alert.Heading className="fs-6 fw-bold">⚠️ Camera Error</Alert.Heading>
              <p className="small mb-2">{errorMessage}</p>
            </Alert>
          )}

          {/* Webcam Component (Rendered ONLY during INITIALIZING, READY, or RECORDING) */}
          {(cameraStatus === "INITIALIZING" || cameraStatus === "READY" || cameraStatus === "RECORDING") && (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="w-100 h-100 rounded"
              style={{ objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}

          {/* Oval Target Overlay */}
          {(cameraStatus === "READY" || cameraStatus === "RECORDING") && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center pointer-events-none">
              <div
                className={`rounded-circle border border-3 ${cameraStatus === "RECORDING" ? "border-danger shadow-lg" : "border-info"}`}
                style={{
                  width: "220px",
                  height: "280px",
                  boxShadow: cameraStatus === "RECORDING" ? "0 0 25px rgba(220, 53, 69, 0.8)" : "0 0 15px rgba(13, 202, 240, 0.5)",
                  transition: "all 0.3s ease"
                }}
              />
            </div>
          )}

          {/* Guided Prompt Overlay Banner */}
          {(cameraStatus === "READY" || cameraStatus === "RECORDING" || cameraStatus === "COMPLETED") && (
            <div className="position-absolute top-0 start-0 w-100 p-3 bg-gradient-dark bg-opacity-75">
              <div className="bg-dark bg-opacity-75 backdrop-blur rounded p-2 border border-secondary shadow-sm">
                <div className="fs-5 fw-bold text-warning mb-0">
                  {prompts[activePromptIndex].icon} {prompts[activePromptIndex].text}
                </div>
                <small className="text-light opacity-75">{prompts[activePromptIndex].subtext}</small>
              </div>
            </div>
          )}

          {/* Live Recording Elapsed Time Overlay */}
          {cameraStatus === "RECORDING" && (
            <div className="position-absolute bottom-0 start-0 m-3 bg-danger text-white px-3 py-1 rounded-pill fw-bold small shadow">
              REC {elapsedSec}s / 5s
            </div>
          )}
        </div>

        {/* Recording Progress Bar */}
        {cameraStatus === "RECORDING" && (
          <div className="mt-3">
            <ProgressBar animated now={progress} variant="danger" style={{ height: "8px" }} className="rounded-pill" />
            <small className="text-light mt-1 d-block font-monospace">Capturing Live Facial Biometrics ({progress}%)</small>
          </div>
        )}

        {/* Toolbar & Controls */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          {/* Devices selector (Disabled during recording) */}
          {devices.length > 1 && (
            <Form.Select
              size="sm"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={cameraStatus === "RECORDING" || cameraStatus === "COMPLETED"}
              className="w-auto bg-dark text-white border-secondary"
            >
              {devices.map((dev, i) => (
                <option key={dev.deviceId} value={dev.deviceId}>{dev.label || `Camera ${i + 1}`}</option>
              ))}
            </Form.Select>
          )}

          {/* Front / Rear Switch (Disabled during recording) */}
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => setFacingMode((p) => (p === "user" ? "environment" : "user"))}
            disabled={cameraStatus !== "READY"}
          >
            🔄 Switch Camera
          </Button>

          {/* Main Action: START VERIFICATION */}
          <Button
            variant="success"
            size="lg"
            className="px-4 fw-bold shadow"
            onClick={startGuidedVerification}
            disabled={cameraStatus !== "READY"}
          >
            ▶️ Start Live Verification
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default GuidedCameraWorkspace;
