from ultralytics import YOLO

# Cargar modelo
model = YOLO("best.pt")

# Ejecutar predicción
results = model.predict(
    source="imagen.png",
    save=True,
    show=True
)
import cv2
from ultralytics import YOLO

model = YOLO("best.pt")

results = model.predict(source="imagen.png")

# Mostrar resultado
for r in results:
    img = r.plot()
    cv2.imshow("Resultado", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
print("Predicción completada")