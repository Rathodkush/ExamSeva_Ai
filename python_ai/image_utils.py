from PIL import Image, ImageFilter, ImageOps
import numpy as np
import io

# Blur detection using variance of Laplacian approximation via edge variance
def is_blurry_pil(image: Image.Image, threshold: float = 100.0) -> bool:
    """Return True if image is likely blurry.
    We compute an edge-map using FIND_EDGES and measure variance; low variance -> blurry.
    Threshold is empirically chosen; adjust as needed.
    """
    try:
        gray = image.convert('L')
        edges = gray.filter(ImageFilter.FIND_EDGES)
        arr = np.asarray(edges, dtype=np.float32)
        var = arr.var()
        # Debug: print('edge var', var)
        return var < threshold
    except Exception:
        return False


def _otsu_threshold(gray_arr: np.ndarray) -> int:
    # Otsu's method to pick threshold
    hist, bin_edges = np.histogram(gray_arr.flatten(), bins=256, range=(0,255))
    total = gray_arr.size
    current_max, threshold = 0, 0
    sum_total = np.dot(np.arange(256), hist)
    sumB, wB = 0.0, 0.0
    wF = 0.0
    mB = 0.0
    for i in range(256):
        wB += hist[i]
        if wB == 0:
            continue
        wF = total - wB
        if wF == 0:
            break
        sumB += i * hist[i]
        mB = sumB / wB
        mF = (sum_total - sumB) / wF
        # Between class variance
        varBetween = wB * wF * (mB - mF) ** 2
        if varBetween > current_max:
            current_max = varBetween
            threshold = i
    return int(threshold)


def enhance_pil_image(image: Image.Image, do_binarize: bool = True) -> Image.Image:
    """Perform a set of fast, classical enhancements to improve OCR quality.
    Steps:
      - Convert to RGB
      - Autocontrast
      - Unsharp mask (sharpen)
      - Optional binarization using Otsu threshold
    """
    try:
        img = image.convert('RGB')
        # Slightly increase contrast
        img = ImageOps.autocontrast(img, cutoff=0)
        # Unsharp mask to sharpen edges
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))
        # Optional: convert to grayscale then binarize
        if do_binarize:
            gray = img.convert('L')
            arr = np.asarray(gray)
            th = _otsu_threshold(arr)
            bw = (arr > th).astype('uint8') * 255
            return Image.fromarray(bw)
        return img
    except Exception:
        return image


def pil_image_to_bytes(img: Image.Image, fmt: str = 'PNG') -> bytes:
    bio = io.BytesIO()
    img.save(bio, format=fmt)
    return bio.getvalue()
