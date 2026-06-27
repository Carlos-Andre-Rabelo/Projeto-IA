from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from ultralytics import YOLO
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import os

app = FastAPI(title="Dental Radiograph Disease Detection API")

# Caminho para o modelo YOLO treinado (agora local para o projeto)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "best.pt")

# Tenta carregar o modelo YOLO
try:
    model = YOLO(MODEL_PATH)
    print(f"Modelo carregado com sucesso de {MODEL_PATH}")
except Exception as e:
    print(f"Erro ao carregar o modelo: {e}")
    model = None

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not model:
        return {"error": "Modelo não foi carregado corretamente."}
        
    try:
        # Lê a imagem enviada
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Realiza a inferência com TTA (augment=True) e confiança reduzida para capturar mais casos (alta sensibilidade/recall)
        # conf=0.15 garante que não deixe passar possíveis doenças no modelo Small
        results = model.predict(img, conf=0.15, augment=True)
        
        # Pega o primeiro resultado (única imagem enviada) e plota (desenha as bounding boxes e labels)
        res_plotted = results[0].plot()

        # Converte de volta para imagem usando OpenCV para codificar como JPG
        is_success, buffer = cv2.imencode(".jpg", res_plotted)
        if not is_success:
            return {"error": "Falha ao processar a imagem resultante."}
            
        io_buf = BytesIO(buffer)
        
        # Retorna a imagem em formato binário que o frontend exibirá
        return Response(content=io_buf.getvalue(), media_type="image/jpeg")

    except Exception as e:
        return {"error": str(e)}

# Serve os arquivos estáticos (HTML/CSS/JS)
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
