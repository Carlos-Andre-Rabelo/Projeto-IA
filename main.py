from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from ultralytics import YOLO
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import os

app = FastAPI(title="Dental Radiograph Disease Detection API")

# Diretório onde os modelos estão armazenados
MODELS_DIR = os.path.join(os.path.dirname(__file__), "model")
loaded_models = {}

def get_model(model_name: str):
    if model_name not in loaded_models:
        model_path = os.path.join(MODELS_DIR, model_name)
        if not os.path.exists(model_path):
            return None
        try:
            loaded_models[model_name] = YOLO(model_path)
            print(f"Modelo {model_name} carregado com sucesso de {model_path}")
        except Exception as e:
            print(f"Erro ao carregar o modelo {model_name}: {e}")
            return None
    return loaded_models[model_name]

# Pré-carrega o modelo padrão
get_model("best.pt")

@app.post("/predict")
async def predict(file: UploadFile = File(...), conf: float = Form(0.15), model_name: str = Form("best.pt")):
    model = get_model(model_name)
    if not model:
        return {"error": f"Modelo '{model_name}' não foi carregado corretamente ou não existe."}
        
    try:
        # Lê a imagem enviada
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Realiza a inferência com TTA (augment=True) e confiança dinâmica
        # conf dinâmico enviado pelo frontend
        results = model.predict(img, conf=conf, augment=True)
        
        result = results[0]
        boxes_data = []
        names = model.names
        
        if result.boxes:
            for box in result.boxes:
                # get box coordinates in (left, top, right, bottom) format
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                b_conf = float(box.conf[0])
                cls = int(box.cls[0])
                b_name = names[cls]
                
                boxes_data.append({
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "conf": b_conf,
                    "class": b_name
                })
                
        # Retorna os dados em JSON para o frontend desenhar as caixas
        return {
            "boxes": boxes_data,
            "width": result.orig_shape[1],
            "height": result.orig_shape[0]
        }

    except Exception as e:
        return {"error": str(e)}

# Serve os arquivos estáticos (HTML/CSS/JS)
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
