import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Badge, Button, Form, Alert, Spinner, Card } from "react-bootstrap";
import { getOrCreateSessionId } from "../../utils/sessionManager";

/**
 * Milestone 1: Camera & Device Manager Component
 * Built with react-webcam for robust device enumeration, permission handling,
 * front/rear camera switching, resolution/FPS detection, and retry support.
 */
const CameraDeviceManager = ({ onCameraReady, onError, onCapture, isRecording = false }) => {
  const webcamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsCheckRef = useRef(performance.now());

  // Camera State
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState("user"); // "user" (front) or "environment" (rear)
  const [cameraStatus, setCameraStatus] = useState("INITIALIZING"); // INITIALIZING, ACTIVE, PERMISSION_DENIED, ERROR
  const [errorMessage, setErrorMessage] = useState("");
  
  // Real-time Metadata
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);
  const [sessionId] = useState(() => getOrCreateSessionId());

  // Enumerate Available Media Devices
  const handleDevices = useCallback((mediaDevices) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
    setDevices(videoDevices);
    if (videoDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(videoDevices[0].deviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices).catch((err) => {
      console.warn("[CameraDeviceManager] Device enumeration warning:", err.message);
    });
  }, [handleDevices]);

  // FPS Detection Loop
  const calculateFps = useCallback(() => {
    frameCountRef.current += 1;
    const now = performance.now();
    const delta = now - lastFpsCheckRef.current;

    if (delta >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / delta));
      frameCountRef.current = 0;
      lastFpsCheckRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(calculateFps);
  }, []);

  // On Successful Camera Stream Init
  const handleUserMedia = useCallback((stream) => {
    setCameraStatus("ACTIVE");
    setErrorMessage("");

    // Start FPS detection loop
    lastFpsCheckRef.current = performance.now();
    frameCountRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(calculateFps);

    // Detect Resolution after video metadata loads
    setTimeout(() => {
      if (webcamRef.current && webcamRef.current.video) {
        const video = webcamRef.current.video;
        const res = {
          width: video.videoWidth || 1280,
          height: video.videoHeight || 720,
        };
        setResolution(res);
        console.log(`[CameraDeviceManager] Camera Active - SessionID=${sessionId} Res=${res.width}x${res.height}`);
        if (onCameraReady) onCameraReady({ stream, resolution: res, sessionId });
      }
    }, 500);
  }, [calculateFps, onCameraReady, sessionId]);

  // On Camera Initialization Error / Permission Denied
  const handleUserMediaError = useCallback((error) => {
    console.error("[CameraDeviceManager] Camera Error:", error);
    let msg = "Could not access camera. Please check permissions.";
    
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      setCameraStatus("PERMISSION_DENIED");
      msg = "Camera permission was denied. Please allow camera access in your browser settings and click Retry.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      setCameraStatus("ERROR");
      msg = "No camera hardware detected on this device.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      setCameraStatus("ERROR");
      msg = "Camera is currently in use by another application or tab.";
    } else {
      setCameraStatus("ERROR");
      msg = error.message || msg;
    }

    setErrorMessage(msg);
    if (onError) onError(msg);
  }, [onError]);

  // Clean up FPS animation loop on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Toggle Front / Rear Facing Mode
  const toggleFacingMode = () => {
    setCameraStatus("INITIALIZING");
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // Device Selection Change
  const handleDeviceChange = (e) => {
    setCameraStatus("INITIALIZING");
    setSelectedDeviceId(e.target.value);
  };

  // Retry Camera Init
  const handleRetry = () => {
    setCameraStatus("INITIALIZING");
    setErrorMessage("");
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        navigator.mediaDevices.enumerateDevices().then(handleDevices);
      })
      .catch(handleUserMediaError);
  };

  // Video Constraints Config
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode,
    ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden mb-3">
      <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-2 px-3">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold fs-6">📷 Camera & Device Manager</span>
          <Badge bg={
            cameraStatus === "ACTIVE" ? "success" :
            cameraStatus === "PERMISSION_DENIED" ? "danger" :
            cameraStatus === "INITIALIZING" ? "warning" : "secondary"
          }>
            {cameraStatus}
          </Badge>
        </div>
        <small className="text-muted font-monospace">Session: {sessionId.substring(0, 14)}...</small>
      </Card.Header>

      <Card.Body className="p-3 bg-dark text-white position-relative text-center">
        {/* Video Stream Container */}
        <div className="position-relative rounded overflow-hidden mx-auto bg-black d-flex align-items-center justify-content-center"
             style={{ minHeight: "300px", maxHeight: "420px", width: "100%" }}>
          
          {cameraStatus === "INITIALIZING" && (
            <div className="text-center p-4">
              <Spinner animation="border" variant="light" className="mb-2" />
              <p className="small mb-0 text-light">Initializing camera stream...</p>
            </div>
          )}

          {cameraStatus === "PERMISSION_DENIED" && (
            <Alert variant="danger" className="m-3 text-start">
              <Alert.Heading className="fs-6 fw-bold">⚠️ Camera Access Denied</Alert.Heading>
              <p className="small mb-2">{errorMessage}</p>
              <Button variant="outline-danger" size="sm" onClick={handleRetry}>
                🔄 Retry Camera Access
              </Button>
            </Alert>
          )}

          {cameraStatus === "ERROR" && (
            <Alert variant="warning" className="m-3 text-start">
              <Alert.Heading className="fs-6 fw-bold">⚠️ Camera Error</Alert.Heading>
              <p className="small mb-2">{errorMessage}</p>
              <Button variant="outline-warning" size="sm" onClick={handleRetry}>
                🔄 Retry Connection
              </Button>
            </Alert>
          )}

          {/* React Webcam Instance */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className={`w-100 h-100 rounded ${cameraStatus === "ACTIVE" ? "d-block" : "d-none"}`}
            style={{ objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />

          {/* Active Stream Metadata Overlay */}
          {cameraStatus === "ACTIVE" && (
            <div className="position-absolute top-0 start-0 m-2 bg-dark bg-opacity-75 px-2 py-1 rounded text-start small">
              <span className="text-success me-2">● LIVE</span>
              <span className="text-light me-2">{resolution.width}x{resolution.height}</span>
              <span className="text-info">{fps} FPS</span>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          {/* Device Selection Dropdown */}
          {devices.length > 1 && (
            <Form.Select
              size="sm"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="w-auto bg-dark text-white border-secondary"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </Form.Select>
          )}

          {/* Front / Rear Toggle */}
          <Button
            variant="outline-light"
            size="sm"
            onClick={toggleFacingMode}
            disabled={cameraStatus !== "ACTIVE"}
          >
            🔄 Switch to {facingMode === "user" ? "Rear (Environment)" : "Front (User)"} Camera
          </Button>

          {/* Manual Capture / Test Snapshot */}
          {onCapture && (
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                if (webcamRef.current) {
                  const imageSrc = webcamRef.current.getScreenshot();
                  onCapture(imageSrc);
                }
              }}
              disabled={cameraStatus !== "ACTIVE" || isRecording}
            >
              📸 Capture Snapshot
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default CameraDeviceManager;
