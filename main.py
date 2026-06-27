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
