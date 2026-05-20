REQUISITOS PARA EJECUTAR EL SISTEMA EPP

1. Instalar:

* Python 3.12+
* Node.js
* MongoDB Community Server
* MongoDB Compass (opcional)
* VS Code

2. Verificar instalaciones:
   Abrir PowerShell y ejecutar:

python --version
npm -v

3. Backend (FastAPI + YOLO)

Abrir terminal en la carpeta backend y ejecutar:

pip install -r requirements.txt

Luego iniciar backend:

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

4. Frontend (React/Vite)

Abrir otra terminal en la carpeta Frontend y ejecutar:

npm install

Luego iniciar frontend:

npm run dev

5. MongoDB

Asegurarse que MongoDB esté iniciado.

La conexión usada es:

mongodb://localhost:27017

6. Acceso al sistema

Frontend:
http://localhost:5173

Backend:
http://localhost:8000

7. Modelos YOLO

Los modelos .pt deben estar en la carpeta:

Detector/

Modelos usados:

* best.pt
* belst.pt
* bes33t.pt

8. Notas importantes

* No cerrar las terminales mientras el sistema esté ejecutándose.
* Backend y frontend deben estar activos al mismo tiempo.
* Si la cámara falla, cerrar otras apps que usen webcam.
* Para iniciar nuevamente:

  * ejecutar backend
  * ejecutar frontend
  * verificar MongoDB

9. Arquitectura general

Frontend (React/Vite)
↓
Backend FastAPI
↓
MongoDB
↓
YOLO/OpenCV
