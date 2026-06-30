document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const imageInput = document.getElementById('image-input');
    const loadingState = document.getElementById('loading-state');
    const resultArea = document.getElementById('result-area');
    const resultImage = document.getElementById('result-image');
    const btnReset = document.getElementById('btn-reset');
    const btnExport = document.getElementById('btn-export');

    const confSlider = document.getElementById('conf-slider');
    const confValue = document.getElementById('conf-value');
    
    const boundingBoxesContainer = document.getElementById('bounding-boxes-container');
    const toggleBoxesBtn = document.getElementById('toggle-boxes-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const imageWrapper = document.getElementById('image-wrapper');
    const modalOverlay = document.getElementById('info-modal');
    const modalClose = document.getElementById('modal-close');
    const modalDisease = document.getElementById('modal-disease');
    const modalTooth = document.getElementById('modal-tooth');
    const modalConfidence = document.getElementById('modal-confidence');

    let currentFile = null;
    let currentBoxesData = [];
    let originalImageWidth = 1;
    let originalImageHeight = 1;

//funcao exportar analise csv
function translateProblem(className) {
    const key = String(className || "").toLowerCase();
    const map = {
        "caries": "Cárie",
        "impacted": "Dente impactado",
        "periapical lesion": "Lesão periapical"
    };
    return map[key] || className || "Desconhecido";
}

function extractToothNumber(toothText) {
    if (!toothText)
        return "Não identificado";
    const text = String(toothText);
    const match = text.match(/\b(\d{2})\b/);
    return match ? match[1] : text;
}

function escapeCsvValue(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g,'""')}"`;
}

function buildCsvFromBoxes(boxes){
    const header = [
        "nº do dente",
        "problema encontrado",
        "% de confiança"
    ];
    const rows = boxes.map(box => {
        const toothNumber =
            extractToothNumber(box.tooth);
        const problem =
            translateProblem(
                box.class || box.class_name
            );
        const confidence =
            `${(box.conf*100).toFixed(1)}%`;
        return [
            toothNumber,
            problem,
            confidence
        ];
    });

    const allRows = [header,...rows];
    return "\uFEFF" + allRows
        .map(row =>
            row
            .map(escapeCsvValue)
            .join(";")
        )
        .join("\r\n");
}

function downloadCsv(filename,csvContent){
    const blob = new Blob(
        [csvContent],
        {
            type:"text/csv;charset=utf-8;"
        }
    );

    const url =
        URL.createObjectURL(blob);
    const link =
        document.createElement("a");
    link.href=url;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

}

function exportResultsToCsv(){
    if(
        !currentBoxesData ||
        currentBoxesData.length===0
    ){
        alert(
            "Nenhum resultado disponível."
        );
        return;
    }
    const csv =
        buildCsvFromBoxes(
            currentBoxesData
        );
    const date =
        new Date()
        .toISOString()
        .slice(0,10);
    downloadCsv(
        `analise_${date}.csv`,
        csv
    );
}

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.querySelectorAll('.bounding-box.selected').forEach(el => el.classList.remove('selected'));
    }

    // Modal Events
    modalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });

    // Fecha o modal ao clicar fora (no documento geral)
    document.addEventListener('click', (e) => {
        if (modalOverlay.classList.contains('active')) {
            const isClickInsideModal = modalOverlay.querySelector('.modal-content').contains(e.target);
            const isClickOnBox = e.target.classList.contains('bounding-box') || e.target.closest('.bounding-box');
            
            if (!isClickInsideModal && !isClickOnBox) {
                closeModal();
            }
        }
    });

    // Toggle Bounding Boxes Visibility (Eye Icon)
    toggleBoxesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = boundingBoxesContainer.classList.toggle('hidden-boxes');
        const eyeOpen = toggleBoxesBtn.querySelector('.eye-icon.open');
        const eyeClosed = toggleBoxesBtn.querySelector('.eye-icon.closed');
        if (isHidden) {
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    });

    function toggleFullscreen() {
        const isFullscreen = imageWrapper.classList.contains('fullscreen-active');
        if (!isFullscreen) {
            // Salva a posição original usando um elemento de marcação temporária
            const parent = imageWrapper.parentNode;
            const placeholder = document.createElement('div');
            placeholder.id = 'image-wrapper-placeholder';
            parent.insertBefore(placeholder, imageWrapper);
            
            // Move o wrapper da imagem diretamente para o body para ignorar restrições de backdrop-filter
            document.body.appendChild(imageWrapper);
            imageWrapper.classList.add('fullscreen-active');
            
            fullscreenBtn.querySelector('.fullscreen-icon.enter').style.display = 'none';
            fullscreenBtn.querySelector('.fullscreen-icon.exit').style.display = 'block';
        } else {
            exitFullscreen();
        }
        drawBoxes();
    }

    function exitFullscreen() {
        if (imageWrapper.classList.contains('fullscreen-active')) {
            const placeholder = document.getElementById('image-wrapper-placeholder');
            if (placeholder) {
                // Devolve o wrapper da imagem ao seu lugar original no layout
                placeholder.parentNode.insertBefore(imageWrapper, placeholder);
                placeholder.remove();
            }
            imageWrapper.classList.remove('fullscreen-active');
            
            fullscreenBtn.querySelector('.fullscreen-icon.enter').style.display = 'block';
            fullscreenBtn.querySelector('.fullscreen-icon.exit').style.display = 'none';
            drawBoxes();
        }
    }

    // Alternar Tela Cheia (Fullscreen)
    fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
    });

    // Pressionar ESC para fechar tela cheia
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            exitFullscreen();
        }
    });

    // Filtro interativo na legenda
    const legendItems = document.querySelectorAll('.legend-item');
    legendItems.forEach(item => {
        item.addEventListener('click', () => {
            const wasActive = item.classList.contains('active');
            item.classList.toggle('active');
            
            // Se desativou o filtro e esta classe estiver com o modal aberto, fecha o modal
            if (wasActive) {
                const selectedBox = document.querySelector('.bounding-box.selected');
                if (selectedBox && selectedBox.dataset.class === item.dataset.class) {
                    closeModal();
                }
            }
            
            drawBoxes();
        });
    });

    // Resize observer for dynamic box scaling
    const resizeObserver = new ResizeObserver(() => {
        drawBoxes();
    });
    resizeObserver.observe(resultImage);

    function drawBoxes() {
        boundingBoxesContainer.innerHTML = '';
        
        const displayedWidth = resultImage.clientWidth;
        const displayedHeight = resultImage.clientHeight;
        
        if (displayedWidth === 0 || displayedHeight === 0 || currentBoxesData.length === 0) return;
        
        // Alinha e redimensiona o container de bounding boxes de acordo com a imagem real
        boundingBoxesContainer.style.left = `${resultImage.offsetLeft}px`;
        boundingBoxesContainer.style.top = `${resultImage.offsetTop}px`;
        boundingBoxesContainer.style.width = `${displayedWidth}px`;
        boundingBoxesContainer.style.height = `${displayedHeight}px`;
        
        // Obtém as classes que estão marcadas como ativas na legenda
        const activeLegendItems = document.querySelectorAll('.legend-item.active');
        const activeClasses = Array.from(activeLegendItems).map(item => item.dataset.class);
        
        const scaleX = displayedWidth / originalImageWidth;
        const scaleY = displayedHeight / originalImageHeight;
        
        currentBoxesData.forEach(box => {
            // Ignora se a classe da detecção não estiver ativa nos filtros da legenda
            if (!activeClasses.includes(box.class)) return;
            
            const div = document.createElement('div');
            div.className = 'bounding-box';
            div.dataset.class = box.class; // Armazena a classe na div para controle do modal
            
            // Calculate scaled coordinates
            const x1 = box.x1 * scaleX;
            const y1 = box.y1 * scaleY;
            const width = (box.x2 - box.x1) * scaleX;
            const height = (box.y2 - box.y1) * scaleY;
            
            div.style.left = `${x1}px`;
            div.style.top = `${y1}px`;
            div.style.width = `${width}px`;
            div.style.height = `${height}px`;
            
            // Set border color based on class
            let color = '#ff0000';
            if (box.class === 'Impacted') {
                color = '#042aff';
            } else if (box.class === 'Caries') {
                color = '#ffaa00';
            } else if (box.class === 'Periapical Lesion') {
                color = '#00aa00';
            }
            div.style.borderColor = color;
            
            // Traduz o nome da doença
            let diseaseName = box.class;
            if (diseaseName === 'Impacted') diseaseName = 'Dente Impactado';
            else if (diseaseName === 'Caries') diseaseName = 'Cárie';
            else if (diseaseName === 'Periapical Lesion') diseaseName = 'Lesão Periapical';
            
            const confidencePercent = Math.round(box.conf * 100) + '%';
            
            let labelText = `${diseaseName} (${confidencePercent})`;
            if (box.tooth && box.tooth !== 'Não identificado') {
                const fdiMatch = box.tooth.match(/Dente (\d+)/);
                if (fdiMatch) {
                    labelText = `${diseaseName} [${fdiMatch[1]}] (${confidencePercent})`;
                }
            }
            
            // Legenda acima ou abaixo da box
            const labelSpan = document.createElement('span');
            labelSpan.className = 'bounding-box-label';
            labelSpan.innerText = labelText;
            labelSpan.style.backgroundColor = color;
            
            // Se estiver muito próximo ao topo da imagem, exibe abaixo da box
            if (y1 < 22) {
                labelSpan.style.top = '100%';
                labelSpan.style.bottom = 'auto';
                labelSpan.style.borderRadius = '0 0 4px 4px';
            } else {
                labelSpan.style.bottom = '100%';
                labelSpan.style.top = 'auto';
                labelSpan.style.borderRadius = '4px 4px 0 0';
            }
            div.appendChild(labelSpan);
            
            // Add click event for modal (positioned relative to mouse click)
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Desmarca qualquer outra caixa previamente selecionada
                document.querySelectorAll('.bounding-box.selected').forEach(el => el.classList.remove('selected'));
                
                // Marca a caixa atual como selecionada
                div.classList.add('selected');
                
                modalDisease.innerText = diseaseName;
                modalTooth.innerText = box.tooth || 'Não identificado';
                modalConfidence.innerText = confidencePercent;
                
                const modalContent = modalOverlay.querySelector('.modal-content');
                const modalWidth = 280; // Largura do modal configurada no CSS
                const modalHeight = 180; // Altura aproximada do modal
                
                let left = e.pageX + 10;
                let top = e.pageY + 10;
                
                // Evita que o modal passe da borda direita da viewport (considerando o scroll)
                if (left + modalWidth > window.innerWidth + window.scrollX) {
                    left = e.pageX - modalWidth - 10;
                }
                // Evita que o modal passe da borda inferior da viewport (considerando o scroll)
                if (top + modalHeight > window.innerHeight + window.scrollY) {
                    top = e.pageY - modalHeight - 10;
                }
                
                // Garante limites positivos dentro da viewport visível
                if (left < window.scrollX + 10) left = window.scrollX + 10;
                if (top < window.scrollY + 10) top = window.scrollY + 10;
                
                modalContent.style.left = `${left}px`;
                modalContent.style.top = `${top}px`;
                
                modalOverlay.classList.add('active');
            });
            
            boundingBoxesContainer.appendChild(div);
        });
    }

    // Handle click on upload area
    uploadArea.addEventListener('click', () => {
        imageInput.click();
    });

    // Handle drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            currentFile = e.dataTransfer.files[0];
            handleFile(currentFile);
        }
    });

    // Handle file input change
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            currentFile = e.target.files[0];
            handleFile(currentFile);
        }
    });

    // Handle slider change (re-run analysis)
    confSlider.addEventListener('input', (e) => {
        // Update label text in real-time
        confValue.innerText = Math.round(e.target.value * 100) + '%';
    });

    confSlider.addEventListener('change', (e) => {
        // Re-run the analysis with the new confidence when user releases slider
        if (currentFile) {
            handleFile(currentFile, false);
        }
    });

    // Reset button
    btnReset.addEventListener('click', () => {
        exitFullscreen();
        closeModal();
        resultArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        imageInput.value = '';
        currentFile = null;
        currentBoxesData = [];
        boundingBoxesContainer.innerHTML = '';
        
        // Reseta o texto do resumo Gemini
        const summaryDiv = document.getElementById('summary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="summary-placeholder">
                    <svg class="sparkles-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z"/>
                        <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>
                    </svg>
                    <span>Aguardando a análise do raio-x panorâmico para gerar a análise dos achados.</span>
                </div>
            `;
        }

        // Reseta o estado de visibilidade do olho e das caixas
        boundingBoxesContainer.classList.remove('hidden-boxes');
        toggleBoxesBtn.querySelector('.eye-icon.open').style.display = 'block';
        toggleBoxesBtn.querySelector('.eye-icon.closed').style.display = 'none';
        
        // Reseta os filtros da legenda
        document.querySelectorAll('.legend-item').forEach(item => {
            item.classList.add('active');
        });
        
        imageInput.click(); // Abre o seletor de arquivo automaticamente
    });

    //exportar analise csv
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            exportResultsToCsv();
        });

    }

    async function handleFile(file, showFullLoading = true) {
        // Only accept images
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione um arquivo de imagem válido.');
            return;
        }

        // Show loading
        if (showFullLoading) {
            uploadArea.classList.add('hidden');
        } else {
            // Se for apenas ajuste de slider, esconde apenas a imagem e mostra loading rápido
            resultImage.style.opacity = '0.3';
        }
        loadingState.classList.remove('hidden');

        // Prepare FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conf', confSlider.value); // Envia o valor do slider

        try {
            // Send to backend
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Erro na análise da imagem.');
            }

            const json = await response.json();
            if (json.error) {
                throw new Error(json.error);
            }

            // Wait for image to load to get dimensions correct before drawing boxes
            const imageUrl = URL.createObjectURL(currentFile);
            
            // Wait for image to load to get dimensions correct before drawing boxes (definido antes de definir o .src)
            resultImage.onload = () => {
                originalImageWidth = json.width;
                originalImageHeight = json.height;
                currentBoxesData = json.boxes || [];
                drawBoxes();
                
                resultImage.style.opacity = '1';
                loadingState.classList.add('hidden');
                resultArea.classList.remove('hidden');

                // Dispara a geração de resumo clínico com o Gemini de forma assíncrona
                gerarResumo(currentBoxesData);
            };

            // Set the local image as source (dispara o onload)
            resultImage.src = imageUrl;

        } catch (error) {
            console.error('Error:', error);
            alert('Erro ao processar a imagem: ' + error.message);
            
            // Reset UI on error
            loadingState.classList.add('hidden');
            resultArea.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            currentFile = null;
        }
    }

    async function gerarResumo(boxes) {
        const summaryDiv = document.getElementById('summary');
        const summaryStatus = document.getElementById('summary-status');
        
        if (!summaryDiv) return;

        if (summaryStatus) {
            summaryStatus.innerText = "Laudo automático dos achados:";
        }
        
        // Exibe o esqueleto animado de carregamento
        summaryDiv.innerHTML = `
            <div class="summary-loading">
                <div class="pulse-line line-1"></div>
                <div class="pulse-line line-2"></div>
                <div class="pulse-line line-3"></div>
                <span class="loading-text">Gerando análise dos achados...</span>
            </div>
        `;

        try {
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(boxes)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Erro ao gerar o resumo.');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Exibe o resumo clínico retornado pelo Gemini
            summaryDiv.innerText = data.summary || "Nenhum resumo disponível.";
        } catch (error) {
            console.error('Erro no resumo Gemini:', error);
            summaryDiv.innerHTML = `
                <div class="summary-error">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>Erro ao obter resumo da IA: ${error.message}</span>
                </div>
            `;
        }
    }
});
