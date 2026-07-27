import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, str]:
    """
    Advanced Computer Vision Preprocessing Pipeline:
    1. Image Decoding & Quality Validation
    2. Intelligent Upscaling / Resizing (1500px optimal width)
    3. CLAHE Contrast Normalization
    4. Grayscale & Fast Noise Denoising
    5. Image Sharpening (Unsharp Masking)
    6. Adaptive Thresholding
    7. Deskew & Orientation Normalization
    """
    logs = []
    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image buffer")
        logs.append("IMAGE_DECODED")

        # 1. Resizing / Upscaling to optimal dimension
        h, w = img.shape[:2]
        if w < 1000:
            scale = 1200.0 / float(w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
            logs.append(f"UPSCALED_{w}x{h}_TO_{int(w*scale)}x{int(h*scale)}")
        elif max(h, w) > 2000:
            scale = 2000.0 / float(max(h, w))
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            logs.append(f"DOWNSIZED_TO_{int(w*scale)}x{int(h*scale)}")

        # 2. Convert to Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        logs.append("GRAYSCALE")

        # 3. CLAHE Contrast Enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        logs.append("CLAHE_APPLIED")

        # 4. Denoising
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10, templateWindowSize=7, searchWindowSize=21)
        logs.append("DENOISED")

        # 5. Image Sharpening
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        sharpened = cv2.filter2D(denoised, -1, kernel)
        logs.append("SHARPENED")

        # 6. Adaptive Thresholding
        thresh = cv2.adaptiveThreshold(
            sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        logs.append("ADAPTIVE_THRESHOLD")

        # 7. Deskew Angle Correction
        processed_img, deskew_angle = deskew_image(thresh)
        if abs(deskew_angle) > 0.5:
            logs.append(f"DESKEWED_{deskew_angle:.1f}_DEG")

        status_msg = " | ".join(logs)
        logger.info(f"OpenCV Preprocessing Pipeline Complete: {status_msg}")
        return processed_img, status_msg
    except Exception as e:
        logger.warning(f"OpenCV Preprocessing exception: {e}. Falling back to raw image.")
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img, f"PREPROCESSING_FALLBACK: {str(e)}"

def deskew_image(gray_img: np.ndarray) -> tuple[np.ndarray, float]:
    """Detect text line angle and rotate matrix to deskew image."""
    try:
        coords = np.column_stack(np.where(gray_img > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        if abs(angle) > 0.5 and abs(angle) < 45:
            (h, w) = gray_img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(gray_img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated, float(angle)
    except Exception:
        pass
    return gray_img, 0.0
