import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

# Initialize OpenCV Haar Cascade Frontal Face Classifier
try:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
except Exception as e:
    logger.warning(f"Failed to load Haar Cascade default XML: {e}")
    face_cascade = None

def detect_and_crop_face(image_bytes: bytes) -> np.ndarray:
    """
    Detects and crops the primary face from image bytes.
    Falls back to a centered crop if no face bounding box is detected.
    """
    if not image_bytes:
        return None

    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Attempt face detection using Haar Cascade
    if face_cascade is not None and not face_cascade.empty():
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(30, 30)
        )
        if len(faces) > 0:
            # Pick largest face by area
            largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
            x, y, w, h = largest_face
            # Add small padding around face
            pad_x, pad_y = int(w * 0.1), int(h * 0.1)
            y1, y2 = max(0, y - pad_y), min(img.shape[0], y + h + pad_y)
            x1, x2 = max(0, x - pad_x), min(img.shape[1], x + w + pad_x)
            return img[y1:y2, x1:x2]

    # Fallback: Return centered crop of image if detection fails
    h, w, _ = img.shape
    start_y, start_x = int(h * 0.1), int(w * 0.1)
    end_y, end_x = int(h * 0.9), int(w * 0.9)
    return img[start_y:end_y, start_x:end_x]

def compute_face_feature_vector(face_img: np.ndarray) -> np.ndarray:
    """
    Generates a normalized facial feature embedding vector using HSV color histogram
    and structural gradient orientations.
    """
    if face_img is None or face_img.size == 0:
        return None

    # Resize to standard size (128x128)
    resized = cv2.resize(face_img, (128, 128))
    
    # 1. Color Histogram in HSV Space
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [32], [0, 180])
    hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256])
    hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256])
    
    cv2.normalize(hist_h, hist_h)
    cv2.normalize(hist_s, hist_s)
    cv2.normalize(hist_v, hist_v)

    # 2. Structural Gradient Orientations (Sobel)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobelx, sobely)
    mag_hist = cv2.calcHist([magnitude.astype(np.float32)], [0], None, [32], [0, 256])
    cv2.normalize(mag_hist, mag_hist)

    # Concatenate into unified 128-dimensional embedding vector
    embedding = np.concatenate([hist_h.flatten(), hist_s.flatten(), hist_v.flatten(), mag_hist.flatten()])
    norm = np.linalg.norm(embedding)
    return embedding / norm if norm > 0 else embedding

def verify_faces(doc_image_bytes: bytes, selfie_image_bytes: bytes) -> dict:
    """
    Compares cardholder photo from document against selfie image.
    Returns similarity score, confidence, and verification decision.
    """
    if not doc_image_bytes or not selfie_image_bytes:
        return {
            "verified": False,
            "similarity": 0.0,
            "confidence": 0.0,
            "threshold": 75.0,
            "reason": "Missing document photo or selfie image."
        }

    doc_crop = detect_and_crop_face(doc_image_bytes)
    selfie_crop = detect_and_crop_face(selfie_image_bytes)

    if doc_crop is None or selfie_crop is None:
        return {
            "verified": False,
            "similarity": 0.0,
            "confidence": 0.0,
            "threshold": 75.0,
            "reason": "Could not detect facial features in provided images."
        }

    vec_doc = compute_face_feature_vector(doc_crop)
    vec_selfie = compute_face_feature_vector(selfie_crop)

    if vec_doc is None or vec_selfie is None:
        return {
            "verified": False,
            "similarity": 0.0,
            "confidence": 0.0,
            "threshold": 75.0,
            "reason": "Failed to extract facial embedding vectors."
        }

    # Cosine Similarity between feature vectors
    cosine_sim = np.dot(vec_doc, vec_selfie)
    
    # Scale cosine similarity (-1..1) to percentage (0..100)
    scaled_sim = float(np.clip((cosine_sim + 1.0) / 2.0 * 100.0, 0.0, 100.0))
    similarity_score = round(scaled_sim, 1)

    threshold = 75.0
    verified = similarity_score >= threshold

    reason = (
        f"Face match verified with {similarity_score}% similarity."
        if verified
        else f"Face mismatch: similarity ({similarity_score}%) is below {threshold}% threshold."
    )

    return {
        "verified": verified,
        "similarity": similarity_score,
        "confidence": similarity_score,
        "threshold": threshold,
        "reason": reason
    }
