# Projeto IA: Detecção Odontológica Inteligente

Este projeto é uma aplicação web completa (backend e frontend) para detectar e localizar doenças em radiografias odontológicas utilizando modelos treinados da família YOLOv8. O sistema suporta Test-Time Augmentation (TTA) nativamente e possui um layout moderno de vidro fosco (glassmorphism) totalmente responsivo.

## Estrutura do Projeto

- `model/`: Contém o arquivo do modelo YOLO (`best.pt`).
- `static/`: Contém a interface do usuário (HTML, CSS e JavaScript).
- `main.py`: O servidor FastAPI que integra a Inteligência Artificial e expõe a rota web.
- `requirements.txt`: As dependências do projeto em Python.

## Como instalar e executar localmente

Siga o passo a passo abaixo para rodar o servidor na sua máquina:

### 1. Pré-requisitos
Você precisará ter o [Python](https://www.python.org/downloads/) instalado na sua máquina (versão 3.8 ou superior).

### 2. Instalação das dependências
Abra o seu terminal (Prompt de Comando ou PowerShell), navegue até a pasta deste projeto e rode o comando de instalação:

```bash
pip install -r requirements.txt
```

### 3. Rodando o servidor
Ainda no terminal, execute o servidor FastAPI usando o pacote Uvicorn:

```bash
python -m uvicorn main:app --reload
```
*Nota: A flag `--reload` faz o servidor reiniciar sozinho caso você modifique algum arquivo do código.*

### 4. Acessando a Interface Web
Assim que o servidor carregar e exibir a mensagem "Application startup complete", abra o seu navegador favorito e acesse:

👉 **[http://localhost:8000](http://localhost:8000)**

Faça o upload de uma radiografia pelo botão ou arrastando o arquivo para a área pontilhada e aguarde o resultado da detecção!

## Configurações do Modelo
Se você quiser tornar o modelo mais ou menos sensível às doenças, você pode alterar a variável `conf` dentro do arquivo `main.py`.
- **Valores menores (ex: `conf=0.15`):** O modelo fica mais sensível. Acha mais doenças, mas pode dar alarmes falsos.
- **Valores maiores (ex: `conf=0.40`):** O modelo fica mais conservador. Pode deixar passar alguma anomalia incerta, mas os alarmes tendem a ser muito precisos.