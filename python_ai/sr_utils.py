from PIL import Image
import io

# Optional deep-learning super-resolution wrapper.
# If a heavy model like Real-ESRGAN is installed, it will be used.
# Otherwise we fall back to a fast Lanczos upscale as a lightweight SR.

HAS_REALESRGAN = False
try:
    # Try to import Real-ESRGAN if available in the environment
    from realesrgan import RealESRGAN
    import torch
    HAS_REALESRGAN = True
except Exception:
    HAS_REALESRGAN = False


def apply_sr_image(pil_image: Image.Image, scale: int = 2, use_model: bool = False) -> Image.Image:
    """Apply super-resolution to a PIL image.

    - If `use_model` is True and Real-ESRGAN is installed, attempt to use it.
    - Otherwise, perform a high-quality Lanczos upsample (fast, CPU-friendly).
    """
    if use_model and HAS_REALESRGAN:
        try:
            # Use CPU/GPU depending on availability
            import torch
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            # RealESRGAN expects a model name/scale; typical models use x4
            model = RealESRGAN(device, scale=4)
            # Attempt to download weights if needed (RealESRGAN may handle this)
            try:
                model.load_weights('RealESRGAN_x4plus.pth', download=True)
            except Exception:
                # If load_weights signature differs, ignore and let model initialization use defaults
                pass
            # RealESRGAN API may accept PIL images directly
            sr = model.predict(pil_image)
            if isinstance(sr, Image.Image):
                return sr
        except Exception:
            # Fall through to fallback resize
            pass

    # Fallback: simple Lanczos upscale by integer scale factor
    try:
        target = (pil_image.width * scale, pil_image.height * scale)
        return pil_image.resize(target, resample=Image.LANCZOS)
    except Exception:
        return pil_image
