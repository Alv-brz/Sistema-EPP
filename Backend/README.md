# Sistema EPP Backend

FastAPI backend for the React/Vite PPE monitoring frontend and the YOLO detector.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

MongoDB must be running and reachable through `MONGODB_URI`.

Default development login after startup:

- `admin@empresa.com`
- `password123`

Change `JWT_SECRET_KEY` and default credentials before production.

## Frontend

Create `Frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Then run:

```powershell
cd Frontend
npm run dev
```

## Detector

The backend loads the YOLO model from `DETECTOR_MODEL_PATH`, defaulting to `../Detector/best.pt`.

Detection API:

- `POST /api/v1/detections/upload` multipart image upload
- `GET /api/v1/detections/history`
- `GET /api/v1/detections/{id}`
- `GET /api/v1/detections/{id}/image`
- `GET /api/v1/detections/{id}/annotated-image`

Real-time ready endpoint:

- `WS /api/v1/ws/detections`
