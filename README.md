# Sistema EPP

Sistema web para monitoreo de equipos de proteccion personal mediante camaras, backend FastAPI, frontend React/Vite, MongoDB y modelos YOLO entrenados.

## Que hace

- Autentica usuarios con roles.
- Administra usuarios, areas y camaras.
- Ejecuta deteccion YOLO sobre imagenes subidas.
- Ejecuta deteccion sobre streams de camara usando OpenCV.
- Registra infracciones por EPP faltante.
- Muestra dashboard, historial, reportes y configuracion del modelo.

## Estructura

```text
Sistema-EPP/
├── Backend/      # API FastAPI, MongoDB, servicios de deteccion y streaming
├── Frontend/     # Aplicacion React/Vite
├── Detector/     # Pesos YOLO y scripts manuales de prueba
├── AI_CONTEXT.md
├── PROJECT_STATUS.md
└── README.md
```

## Requisitos

- Python 3.11 o 3.12.
- Node.js LTS.
- MongoDB Community Server.
- Pesos YOLO presentes en `Detector/`.

## Ejecutar backend

```powershell
cd Backend
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger:

```text
http://localhost:8000/docs
```

## Ejecutar frontend

```powershell
cd Frontend
npm install
npm run dev
```

Aplicacion:

```text
http://localhost:5173
```

## Acceso por defecto

```text
admin@empresa.com
password123
```

Cambiar estas credenciales y `JWT_SECRET_KEY` antes de usar en produccion.

## Modelos YOLO

Modelos soportados:

- `Detector/best.pt`
- `Detector/best2.pt`
- `Detector/best3.pt`

El modelo activo, umbral y clases habilitadas se configuran desde la pantalla de configuracion o desde MongoDB.

## Documentacion tecnica

- `AI_CONTEXT.md`: memoria tecnica completa del proyecto.
- `PROJECT_STATUS.md`: estado actual, pendientes, riesgos y recomendaciones.
- `Backend/README.md`: guia breve del backend.
- `README.txt`: guia original de instalacion y ejecucion.
