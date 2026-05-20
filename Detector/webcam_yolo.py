import cv2
from ultralytics import YOLO

# Cargar modelo
model = YOLO("best.pt")

# Abrir cámara
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ No se pudo abrir la cámara")
    exit()

print("✅ Cámara activa - presiona 'q' para salir")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Predicción (SIN filtro de clases)
    results = model.predict(frame, conf=0.5)

    # Dibujar resultados
    for r in results:
        frame = r.plot()

    # Mostrar en pantalla
    cv2.imshow("Deteccion YOLO Webcam", frame)

    # Salir con 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Liberar recursos
cap.release()
cv2.destroyAllWindows()
print("👋 Programa finalizado")