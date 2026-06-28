from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from ultralytics import YOLO
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import os
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field
from typing import List

# Carrega variáveis de ambiente do .env de forma robusta usando caminho absoluto
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# Inicializa o cliente Gemini
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

class DetectionBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    conf: float
    class_name: str = Field(..., alias="class")
    tooth: str = "Não identificado"

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

FDI_TOOTH_NAMES = {
    "11": "Dente 11 (Incisivo Central Superior Direito)",
    "12": "Dente 12 (Incisivo Lateral Superior Direito)",
    "13": "Dente 13 (Canino Superior Direito)",
    "14": "Dente 14 (Primeiro Pré-Molar Superior Direito)",
    "15": "Dente 15 (Segundo Pré-Molar Superior Direito)",
    "16": "Dente 16 (Primeiro Molar Superior Direito)",
    "17": "Dente 17 (Segundo Molar Superior Direito)",
    "18": "Dente 18 (Terceiro Molar Superior Direito / Siso)",
    "21": "Dente 21 (Incisivo Central Superior Esquerdo)",
    "22": "Dente 22 (Incisivo Lateral Superior Esquerdo)",
    "23": "Dente 23 (Canino Superior Esquerdo)",
    "24": "Dente 24 (Primeiro Pré-Molar Superior Esquerdo)",
    "25": "Dente 25 (Segundo Pré-Molar Superior Esquerdo)",
    "26": "Dente 26 (Primeiro Molar Superior Esquerdo)",
    "27": "Dente 27 (Segundo Molar Superior Esquerdo)",
    "28": "Dente 28 (Terceiro Molar Superior Esquerdo / Siso)",
    "31": "Dente 31 (Incisivo Central Inferior Esquerdo)",
    "32": "Dente 32 (Incisivo Lateral Inferior Esquerdo)",
    "33": "Dente 33 (Canino Inferior Esquerdo)",
    "34": "Dente 34 (Primeiro Pré-Molar Inferior Esquerdo)",
    "35": "Dente 35 (Segundo Pré-Molar Inferior Esquerdo)",
    "36": "Dente 36 (Primeiro Molar Inferior Esquerdo)",
    "37": "Dente 37 (Segundo Molar Inferior Esquerdo)",
    "38": "Dente 38 (Terceiro Molar Inferior Esquerdo / Siso)",
    "41": "Dente 41 (Incisivo Central Inferior Direito)",
    "42": "Dente 42 (Incisivo Lateral Inferior Direito)",
    "43": "Dente 43 (Canino Inferior Direito)",
    "44": "Dente 44 (Primeiro Pré-Molar Inferior Direito)",
    "45": "Dente 45 (Segundo Pré-Molar Inferior Direito)",
    "46": "Dente 46 (Primeiro Molar Inferior Direito)",
    "47": "Dente 47 (Segundo Molar Inferior Direito)",
    "48": "Dente 48 (Terceiro Molar Inferior Direito / Siso)"
}

TEETH_MODEL_NAME = "yolov8s_robust.pt"

# Pré-carrega o modelo padrão e o de dentes
get_model(TEETH_MODEL_NAME)
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
        results = model.predict(img, conf=conf, augment=True)
        
        # Executa inferência do modelo de mapeamento de dentes (usamos conf=0.15 para boa sensibilidade)
        teeth_model = get_model(TEETH_MODEL_NAME)
        teeth_boxes = []
        if teeth_model:
            try:
                teeth_results = teeth_model.predict(img, conf=0.15, augment=True)
                t_result = teeth_results[0]
                t_names = teeth_model.names
                if t_result.boxes:
                    for t_box in t_result.boxes:
                        tx1, ty1, tx2, ty2 = t_box.xyxy[0].tolist()
                        t_cls = int(t_box.cls[0])
                        t_num = t_names[t_cls]
                        teeth_boxes.append((tx1, ty1, tx2, ty2, t_num))
            except Exception as te:
                print(f"Erro na inferência do modelo de dentes: {te}")
        
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
                
                # Mapeamento do dente correspondente
                best_tooth_num = "Não identificado"
                max_overlap = 0.0
                d_area = (x2 - x1) * (y2 - y1)
                
                for tx1, ty1, tx2, ty2, t_num in teeth_boxes:
                    # Calcula interseção
                    ix1 = max(x1, tx1)
                    iy1 = max(y1, ty1)
                    ix2 = min(x2, tx2)
                    iy2 = min(y2, ty2)
                    
                    inter_w = max(0, ix2 - ix1)
                    inter_h = max(0, iy2 - iy1)
                    inter_area = inter_w * inter_h
                    
                    if inter_area > 0 and d_area > 0:
                        overlap = inter_area / d_area
                        if overlap > max_overlap:
                            max_overlap = overlap
                            best_tooth_num = t_num
                
                # Fallback: busca pelo dente mais próximo caso a sobreposição seja baixa ou nula
                if max_overlap < 0.1 and len(teeth_boxes) > 0:
                    d_cx = (x1 + x2) / 2.0
                    d_cy = (y1 + y2) / 2.0
                    min_dist = float('inf')
                    nearest_t_num = "Não identificado"
                    
                    for tx1, ty1, tx2, ty2, t_num in teeth_boxes:
                        t_cx = (tx1 + tx2) / 2.0
                        t_cy = (ty1 + ty2) / 2.0
                        dist = ((d_cx - t_cx) ** 2 + (d_cy - t_cy) ** 2) ** 0.5
                        if dist < min_dist:
                            min_dist = dist
                            nearest_t_num = t_num
                            
                    if min_dist < 300:  # Limite máximo aceitável de distância em pixels
                        best_tooth_num = nearest_t_num
                
                # Tradução/Nome formatado para o dente
                tooth_display = FDI_TOOTH_NAMES.get(best_tooth_num, "Não identificado")
                if best_tooth_num != "Não identificado" and tooth_display == "Não identificado":
                    tooth_display = f"Dente {best_tooth_num}"
                
                boxes_data.append({
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "conf": b_conf,
                    "class": b_name,
                    "tooth": tooth_display
                })
                
        # Retorna os dados em JSON para o frontend desenhar as caixas
        return {
            "boxes": boxes_data,
            "width": result.orig_shape[1],
            "height": result.orig_shape[0]
        }

    except Exception as e:
        return {"error": str(e)}

@app.post("/summarize")
def summarize(boxes: List[DetectionBox]):
    if not client:
        raise HTTPException(
            status_code=500,
            detail="Cliente Gemini não configurado. Verifique se o arquivo .env existe e possui a chave GEMINI_API_KEY."
        )

    if len(boxes) == 0:
        return {"summary": "Nenhuma anomalia foi detectada pela inteligência artificial na radiografia odontológica."}

    # Traduz os termos em inglês do YOLO para português
    class_translation = {
        "caries": "Cárie",
        "impacted": "Dente Impactado",
        "periapical lesion": "Lesão Periapical"
    }

    # Transforma a lista de caixas em texto descritivo amigável para o Gemini, incluindo o dente
    detections_text = "\n".join([
        f"- {class_translation.get(b.class_name.lower(), b.class_name)} | Dente: {b.tooth} | Confiança: {b.conf*100:.1f}% | Coordenadas bbox: ({int(b.x1)}, {int(b.y1)}, {int(b.x2)}, {int(b.y2)})"
        for b in boxes
    ])

    prompt = f"""
Você é um assistente odontológico acadêmico e clínico especializado em laudos radiográficos.

Analise estritamente a lista de detecções geradas pela IA abaixo, que associa cada anomalia encontrada a um dente específico:
{detections_text}

Sua tarefa:
- Gerar um resumo clínico descritivo em português dos achados. Relacione explicitamente cada anomalia detectada ao dente correspondente informado.
- Não inventar nenhum achado clínico que não esteja na lista fornecida.
- Não fornecer diagnósticos definitivos (lembre de enfatizar que o parecer definitivo cabe ao cirurgião-dentista).
- Ser objetivo, técnico, claro e profissional no tom.
- Estruturar a resposta com seções breves e objetivas em português.
- Gerar a resposta sem markdown.
- Não dizer que aquele é um laudo clínico, e sim uma interpretação textual dos achados detectados pelo modelo.
- Seja impessoal e meramente informativo nas respostas.
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return {
            "summary": response.text
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve os arquivos estáticos (HTML/CSS/JS)
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
