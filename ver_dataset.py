import cv2
import os
import argparse

# Nomes das classes do seu dataset
CLASSES = {0: 'Impacted', 1: 'Caries', 2: 'Periapical Lesion'}
# Cores no formato BGR (OpenCV)
COLORS = {0: (255, 42, 4), 1: (0, 170, 255), 2: (0, 170, 0)}

def show_labels(img_path):
    # O YOLO sempre espera que a pasta se chame 'images' e os labels fiquem em 'labels'
    label_path = img_path.replace('images', 'labels').replace('.jpg', '.txt').replace('.png', '.txt')
    
    if not os.path.exists(img_path):
        print(f"Erro: Imagem não encontrada em: {img_path}")
        return
        
    img = cv2.imread(img_path)
    h, w, _ = img.shape
    
    if os.path.exists(label_path):
        print(f"Lendo anotações originais de: {label_path}")
        with open(label_path, 'r') as f:
            for line in f.readlines():
                data = line.strip().split()
                if len(data) < 5: continue
                
                class_id, x_center, y_center, width, height = map(float, data[:5])
                class_id = int(class_id)
                
                # Desnormalizando os valores do YOLO (0 a 1) para pixels reais da imagem
                x_center, width = x_center * w, width * w
                y_center, height = y_center * h, height * h
                
                # Calculando os cantos da caixa
                x1 = int(x_center - width / 2)
                y1 = int(y_center - height / 2)
                x2 = int(x_center + width / 2)
                y2 = int(y_center + height / 2)
                
                color = COLORS.get(class_id, (255, 255, 255))
                label = CLASSES.get(class_id, str(class_id))
                
                # Desenhando a Bounding Box original
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
                
                # Colocando um fundo escuro para o texto ficar legível
                (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                cv2.rectangle(img, (x1, y1 - 25), (x1 + text_w, y1), color, -1)
                
                # Escrevendo o rótulo
                cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
    else:
        print(f"Aviso: Nenhum arquivo de anotação (.txt) encontrado em: {label_path}")
        print("Mostrando apenas a imagem...")
        
    # Redimensiona apenas para a janela caber na tela (mantém a proporção)
    scale_percent = 800 / max(h, w)
    new_w, new_h = int(w * scale_percent), int(h * scale_percent)
    resized_img = cv2.resize(img, (new_w, new_h))
    
    cv2.imshow('Ground Truth (Anotacao dos Dentistas)', resized_img)
    print(">>> Pressione qualquer tecla NA JANELA DA IMAGEM para fechar... <<<")
    cv2.waitKey(0)
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Visualizar anotacoes originais do dataset (Ground Truth)")
    parser.add_argument("image", help="Caminho completo para a imagem (.jpg) do dataset")
    args = parser.parse_args()
    show_labels(args.image)
