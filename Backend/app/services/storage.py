from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


class StorageService:
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    def __init__(self, upload_dir: Path, annotated_dir: Path):
        self.upload_dir = upload_dir
        self.annotated_dir = annotated_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.annotated_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, file: UploadFile) -> Path:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in self.allowed_extensions:
            extension = ".jpg"
        file_path = self.upload_dir / f"{uuid4().hex}{extension}"
        with file_path.open("wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
        return file_path

    def annotated_path_for(self, image_path: Path) -> Path:
        return self.annotated_dir / f"{image_path.stem}_annotated.jpg"
