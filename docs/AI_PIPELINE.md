# Automated KYC System — AI & Computer Vision Pipeline Specification

This document details the multi-stage artificial intelligence, computer vision, OCR extraction, facial verification, and liveness detection pipelines.

---

## 1. Document OCR & LLM Validation Pipeline

```
     [ Raw Image Upload ]
              │
              ▼
    1. OpenCV Pre-processing
   ┌──────────────────────────┐
   │ • Noise Filter           │
   │ • Contrast Enhancement   │
   │ • Deskew Correction      │
   └──────────┬───────────────┘
              │
              ▼
    2. Deep Learning OCR Engine
   ┌──────────────────────────┐
   │ • PaddleOCR / EasyOCR    │
   │ • Extract Bounding Boxes │
   │ • Raw Text Stream        │
   └──────────┬───────────────┘
              │
              ▼
    3. Gemini LLM Data Normalization
   ┌──────────────────────────┐
   │ • Fix Typographical Errors│
   │ • Identify Doc Type      │
   │ • Parse Structured JSON  │
   └──────────┬───────────────┘
              │
              ▼
    4. Verification Engine
   ┌──────────────────────────┐
   │ • Regex Format Validation│
   │ • Attribute Equality Check│
   └──────────────────────────┘
```

### Stage 1: OpenCV Image Enhancement
Before handing image buffers to deep learning models, OpenCV runs automated preprocessing steps:
* **Grayscale & Thresholding**: Converts RGB images to grayscale and applies Otsu's adaptive thresholding to maximize text-background contrast.
* **Perspective Transformation**: Uses edge detection (`cv2.Canny`) and contour finding (`cv2.findContours`) to locate rectangular document boundaries, applying perspective warp to flatten rotated or angled photos.

### Stage 2: OCR Text Extraction
* **Primary Engine**: `PaddleOCR` (Deep Learning-based text detection and recognition framework).
* **Secondary Engine**: `EasyOCR` (Lightweight fallback model for noisy text).
* Output: Array of raw text string fragments paired with detection confidence scores.

### Stage 3: Gemini LLM Normalization
Raw OCR output from real-world documents is often noisy or misaligned. The text payload is dispatched to Google Gemini (`google-generativeai`) with a structured system prompt instructing it to:
1. Extract standard fields (`name`, `document_number`, `dob`, `address`).
2. Correct common OCR character confusions (e.g., misreading 'O' as '0', or 'I' as '1').
3. Output strict JSON conforming to Pydantic schemas.

---

## 2. Facial Verification & Passive Liveness Pipeline (Phases 3 & 4)

```
[ Document Image ]                       [ Live Selfie Capture ]
        │                                         │
        ▼                                         ▼
  OpenCV Face Crop                         MediaPipe Landmark Detector
 (Detect Photo Area)                       (Track Facial Mesh Points)
        │                                         │
        ▼                                         ▼
InsightFace Model                         Passive Liveness Analyzer
(Extract 512D Vector)                     (Calculate EAR Blink & Smile)
        │                                         │
        └──────────────────┬──────────────────────┘
                           │
                           ▼
             Cosine Similarity Matching
            ┌──────────────────────────┐
            │ Similarity Score >= 0.85 │
            │ Liveness Passed == True  │
            └──────────────┬───────────┘
                           │
                           ▼
            [ Facial Verification Match ]
```

### Stage 1: Face Crop & Embedding Extraction
* **InsightFace (`insightface`)**: Loads `buffalo_l` or ArcFace lightweight deep neural net.
* Detects faces in both the cropped document image and live selfie buffer.
* Generates a normalized 512-dimensional floating-point feature embedding vector for each face.

### Stage 2: Vector Cosine Similarity Score
* Computes vector dot product:
  $$\text{Similarity} = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$
* A threshold score $\ge 0.85$ signifies a positive facial identity match.

### Stage 3: Passive Liveness Verification
* **MediaPipe (`mediapipe`)**: Fits 468 3D facial mesh landmark points across live video frames.
* Evaluates Eye Aspect Ratio (EAR) to confirm natural eye blinks and head pose rotation to prevent static photo or screen spoofing attacks.
