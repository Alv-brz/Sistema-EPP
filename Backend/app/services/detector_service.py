import time
import threading
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from pymongo import MongoClient

from app.core.config import Settings
from app.repositories.yolo_settings import SETTINGS_KEY, default_yolo_settings
from app.schemas.yolo_settings import normalize_enabled_classes, normalize_enabled_objects, normalize_model_name


class DetectorService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model: Any | None = None
        self._active_model_name: str | None = None
        self._runtime_settings: dict[str, Any] | None = None
        self._runtime_settings_loaded_at = 0.0
        self._model_lock = threading.Lock()

    def _get_runtime_settings(self) -> dict[str, Any]:
        now = time.monotonic()
        if self._runtime_settings and now - self._runtime_settings_loaded_at < 2:
            return self._runtime_settings
        try:
            client = MongoClient(self.settings.mongodb_uri, serverSelectionTimeoutMS=1000)
            document = client[self.settings.mongodb_db].settings.find_one({"key": SETTINGS_KEY})
            client.close()
        except Exception:
            document = None
        runtime = default_yolo_settings()
        if document:
            active_model = normalize_model_name(document.get("active_model", runtime["active_model"]))
            runtime.update(
                {
                    "active_model": active_model,
                    "confidence_threshold": document.get("confidence_threshold", runtime["confidence_threshold"]),
                    "enabled_classes": normalize_enabled_classes(active_model, document.get("enabled_classes", runtime["enabled_classes"])),
                    "enabled_objects": normalize_enabled_objects(active_model, document.get("enabled_objects")),
                    "detection_enabled": document.get("detection_enabled", runtime["detection_enabled"]),
                }
            )
        self._runtime_settings = runtime
        self._runtime_settings_loaded_at = now
        return runtime

    def _model_path(self, active_model: str) -> Path:
        configured_path = Path(self.settings.detector_model_path)
        if not configured_path.is_absolute():
            configured_path = (Path.cwd() / configured_path).resolve()
        return configured_path.with_name(active_model)

    def _load_model(self, active_model: str) -> Any:
        if not self.settings.detector_enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Detector is disabled")
        if self._model is not None and self._active_model_name == active_model:
            return self._model
        with self._model_lock:
            if self._model is not None and self._active_model_name == active_model:
                return self._model

            model_path = self._model_path(active_model)
            if not model_path.exists():
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"YOLO model not found: {model_path}")

            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ultralytics is not installed") from exc

            self._model = YOLO(str(model_path))
            self._active_model_name = active_model
            return self._model

    @staticmethod
    def _normalize_label(label: str) -> str:
        value = label.lower().strip().replace(" ", "_").replace("-", "_")
        aliases = {
            "person": "persona",
            "people": "persona",
            "persona": "persona",
            "safety_cone": "cono_seguridad",
            "cone": "cono_seguridad",
            "cono_seguridad": "cono_seguridad",
            "machinery": "maquinaria",
            "machine": "maquinaria",
            "maquinaria": "maquinaria",
            "vehicle": "vehiculo",
            "vehiculo": "vehiculo",
            "casco": "casco",
            "helmet": "casco",
            "hardhat": "casco",
            "hard_hat": "casco",
            "no_hardhat": "sin_casco",
            "no_helmet": "sin_casco",
            "chaleco": "chaleco",
            "vest": "chaleco",
            "safety_vest": "chaleco",
            "no_safety_vest": "sin_chaleco",
            "no_vest": "sin_chaleco",
            "guantes": "guantes",
            "gloves": "guantes",
            "no_gloves": "sin_guantes",
            "botas": "botas",
            "boots": "botas",
            "no_boots": "sin_botas",
            "lentes": "lentes",
            "goggle": "lentes",
            "goggles": "lentes",
            "no_goggle": "sin_lentes",
            "no_goggles": "sin_lentes",
            "mask": "mascarilla",
            "face_mask": "mascarilla",
            "no_mask": "sin_mascarilla",
        }
        return aliases.get(value, value)

    @staticmethod
    def _should_include_detection(label: str, enabled_classes: set[str], enabled_objects: set[str]) -> bool:
        return label in enabled_classes or label in enabled_objects

    @staticmethod
    def _detected_objects(detected_classes: set[str]) -> list[str]:
        object_order = ["persona", "vehiculo", "maquinaria", "cono_seguridad"]
        return [item for item in object_order if item in detected_classes]

    @classmethod
    def _enabled_normalized_classes(cls, enabled_classes: list[str]) -> set[str]:
        normalized: set[str] = set()
        for item in enabled_classes:
            label = cls._normalize_label(item)
            normalized.add(label)
            if label == "casco":
                normalized.add("sin_casco")
            if label == "chaleco":
                normalized.add("sin_chaleco")
            if label == "guantes":
                normalized.add("sin_guantes")
            if label == "botas":
                normalized.add("sin_botas")
            if label == "lentes":
                normalized.add("sin_lentes")
            if label == "mascarilla":
                normalized.add("sin_mascarilla")
        return normalized

    @staticmethod
    def _missing_from_negative_label(label: str) -> str | None:
        return {
            "sin_casco": "casco",
            "sin_chaleco": "chaleco",
            "sin_guantes": "guantes",
            "sin_botas": "botas",
            "sin_lentes": "lentes",
            "sin_mascarilla": "mascarilla",
        }.get(label)

    @staticmethod
    def _enabled_epps(enabled_classes: set[str]) -> set[str]:
        return {item for item in enabled_classes if item in {"casco", "chaleco", "mascarilla", "guantes", "botas", "lentes"}}

    @staticmethod
    def _severity(missing_epps: set[str]) -> str:
        if len(missing_epps) >= 2:
            return "high"
        if len(missing_epps) == 1:
            return "medium"
        return "low"

    @staticmethod
    def _display_label(label: str) -> str:
        return {
            "persona": "Persona",
            "cono_seguridad": "Cono de Seguridad",
            "maquinaria": "Maquinaria",
            "vehiculo": "Vehículo",
            "casco": "Casco",
            "chaleco": "Chaleco",
            "guantes": "Guantes",
            "botas": "Botas",
            "lentes": "Lentes",
            "mascarilla": "Mascarilla",
            "sin_casco": "Sin Casco",
            "sin_chaleco": "Sin Chaleco",
            "sin_guantes": "Sin Guantes",
            "sin_botas": "Sin Botas",
            "sin_lentes": "Sin Lentes",
            "sin_mascarilla": "Sin Mascarilla",
        }.get(label, label.replace("_", " ").title())

    @staticmethod
    def _box_colors() -> dict[str, tuple[int, int, int]]:
        return {
            "persona": (59, 130, 246),
            "cono_seguridad": (251, 146, 60),
            "maquinaria": (147, 51, 234),
            "vehiculo": (14, 165, 233),
            "casco": (16, 185, 129),
            "chaleco": (245, 158, 11),
            "guantes": (168, 85, 247),
            "botas": (236, 72, 153),
            "lentes": (34, 211, 238),
            "mascarilla": (20, 184, 166),
            "sin_casco": (239, 68, 68),
            "sin_chaleco": (239, 68, 68),
            "sin_guantes": (239, 68, 68),
            "sin_botas": (239, 68, 68),
            "sin_lentes": (239, 68, 68),
            "sin_mascarilla": (239, 68, 68),
        }

    def _draw_box(self, frame: Any, label: str, confidence: float, xyxy: list[float]) -> None:
        try:
            import cv2
        except ImportError:
            return
        x1, y1, x2, y2 = [int(value) for value in xyxy]
        color = self._box_colors().get(label, (255, 255, 255))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        text = f"{self._display_label(label)} {confidence:.2f}"
        cv2.putText(
            frame,
            text,
            (x1, max(y1 - 8, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
        )

    def predict_frame(self, frame: Any) -> dict[str, Any]:
        runtime = self._get_runtime_settings()
        if not runtime["detection_enabled"]:
            return {
                "frame": frame,
                "detections": [],
                "detected_classes": [],
                "detected_objects": [],
                "missing_epps": [],
                "severity": "low",
                "confidence_threshold": runtime["confidence_threshold"],
                "processed_ms": 0,
            }
        model = self._load_model(runtime["active_model"])
        enabled_classes = self._enabled_normalized_classes(runtime["enabled_classes"])
        enabled_objects = set(runtime.get("enabled_objects", []))
        start = time.perf_counter()
        with self._model_lock:
            results = model.predict(source=frame, conf=runtime["confidence_threshold"], verbose=False)
        processed_ms = int((time.perf_counter() - start) * 1000)

        detections: list[dict[str, Any]] = []
        detected_classes: set[str] = set()
        present_epps: set[str] = set()
        annotated_frame = frame.copy()
        missing_epps: set[str] = set()

        for result in results:
            names = result.names
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                raw_label = str(names.get(class_id, class_id))
                label = self._normalize_label(raw_label)
                if not self._should_include_detection(label, enabled_classes, enabled_objects):
                    continue
                confidence = float(box.conf[0].item())
                xyxy = [float(value) for value in box.xyxy[0].tolist()]
                detected_classes.add(label)
                missing_from_negative = self._missing_from_negative_label(label)
                if missing_from_negative:
                    missing_epps.add(missing_from_negative)
                else:
                    if label in {"casco", "chaleco", "guantes", "botas", "lentes", "mascarilla"}:
                        present_epps.add(label)
                detections.append(
                    {
                        "label": label,
                        "raw_label": raw_label,
                        "confidence": confidence,
                        "box": xyxy,
                    }
                )
                self._draw_box(annotated_frame, label, confidence, xyxy)

        if "persona" in detected_classes:
            missing_epps.update(self._enabled_epps(enabled_classes) - present_epps)

        return {
            "frame": annotated_frame,
            "detections": detections,
            "detected_classes": sorted(detected_classes),
            "detected_objects": self._detected_objects(detected_classes),
            "missing_epps": sorted(missing_epps),
            "severity": self._severity(missing_epps),
            "confidence_threshold": runtime["confidence_threshold"],
            "processed_ms": processed_ms,
        }

    def predict(self, image_path: Path, annotated_path: Path) -> dict[str, Any]:
        runtime = self._get_runtime_settings()
        if not runtime["detection_enabled"]:
            return {
                "detections": [],
                "detected_classes": [],
                "detected_objects": [],
                "missing_epps": [],
                "severity": "low",
                "confidence_threshold": runtime["confidence_threshold"],
                "processed_ms": 0,
                "annotated_image_path": None,
            }
        model = self._load_model(runtime["active_model"])
        enabled_classes = self._enabled_normalized_classes(runtime["enabled_classes"])
        enabled_objects = set(runtime.get("enabled_objects", []))
        start = time.perf_counter()
        results = model.predict(source=str(image_path), conf=runtime["confidence_threshold"], verbose=False)
        processed_ms = int((time.perf_counter() - start) * 1000)

        detections: list[dict[str, Any]] = []
        detected_classes: set[str] = set()
        present_epps: set[str] = set()
        missing_epps: set[str] = set()
        annotated_image = None
        try:
            import cv2

            annotated_image = cv2.imread(str(image_path))
            if annotated_image is None:
                annotated_path = None  # type: ignore[assignment]
        except ImportError:
            annotated_path = None  # type: ignore[assignment]
        for result in results:
            names = result.names
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                raw_label = str(names.get(class_id, class_id))
                label = self._normalize_label(raw_label)
                if not self._should_include_detection(label, enabled_classes, enabled_objects):
                    continue
                confidence = float(box.conf[0].item())
                xyxy = [float(value) for value in box.xyxy[0].tolist()]
                detected_classes.add(label)
                missing_from_negative = self._missing_from_negative_label(label)
                if missing_from_negative:
                    missing_epps.add(missing_from_negative)
                else:
                    if label in {"casco", "chaleco", "guantes", "botas", "lentes", "mascarilla"}:
                        present_epps.add(label)
                detections.append({"label": label, "raw_label": raw_label, "confidence": confidence, "box": xyxy})
                if annotated_image is not None:
                    self._draw_box(annotated_image, label, confidence, xyxy)

        if annotated_path and annotated_image is not None:
            try:
                import cv2

                cv2.imwrite(str(annotated_path), annotated_image)
            except ImportError:
                annotated_path = None  # type: ignore[assignment]

        if "persona" in detected_classes:
            missing_epps.update(self._enabled_epps(enabled_classes) - present_epps)

        return {
            "detections": detections,
            "detected_classes": sorted(detected_classes),
            "detected_objects": self._detected_objects(detected_classes),
            "missing_epps": sorted(missing_epps),
            "severity": self._severity(missing_epps),
            "confidence_threshold": runtime["confidence_threshold"],
            "processed_ms": processed_ms,
            "annotated_image_path": str(annotated_path) if annotated_path else None,
        }
