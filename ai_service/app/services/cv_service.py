import cv2
import numpy as np

def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, str]:
    """
    OpenCV Preprocessing Pipeline:
    1. Decode image buffer to numpy matrix
    2. Resize if image is too large (> 1500px width)
    3. Convert to Grayscale
    4. Apply Gaussian Noise Filtering
    5. Perform Adaptive Thresholding for high-contrast text OCR
    6. Attempt deskew correction if angle detected
    """
    try:
        # 1. Decode byte stream to OpenCV BGR image
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image buffer")

        # 2. Resize maintaining aspect ratio
        h, w = img.shape[:2]
        max_dim = 1500
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        # 3. Convert to Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 4. Noise Reduction using Gaussian Blur
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)

        # 5. Adaptive Thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )

        # 6. Deskew Calculation
        processed_img = deskew_image(thresh)

        return processed_img, "success"
    except Exception as e:
        # Fall back to raw color image if processing fails
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img, f"preprocessing_warning: {str(e)}"

def deskew_image(gray_img: np.ndarray) -> np.ndarray:
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
            return rotated
    except Exception:
        pass
    return gray_img
