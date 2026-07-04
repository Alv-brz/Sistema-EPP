import time
from typing import Any


def _load_cv2() -> Any:
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv-python-headless is not installed") from exc
    return cv2


def detect_webcams(max_devices: int = 10, in_use_indices: set[int] | None = None) -> list[dict[str, object]]:
    cv2 = _load_cv2()
    devices: list[dict[str, object]] = []
    in_use_indices = in_use_indices or set()
    backend = getattr(cv2, "CAP_DSHOW", 0)
    for index in range(max_devices):
        if index in in_use_indices:
            devices.append(
                {
                    "index": index,
                    "name": f"Webcam #{index}",
                    "source_url": str(index),
                    "in_use": True,
                }
            )
            continue
        capture = cv2.VideoCapture(index, backend) if backend else cv2.VideoCapture(index)
        try:
            if not capture.isOpened():
                continue
            ok, _ = capture.read()
            if not ok:
                continue
            devices.append(
                {
                    "index": index,
                    "name": f"Webcam #{index}",
                    "source_url": str(index),
                    "in_use": False,
                }
            )
        finally:
            capture.release()
            time.sleep(0.05)
    return devices
