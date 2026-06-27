document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const imageInput = document.getElementById('image-input');
    const loadingState = document.getElementById('loading-state');
    const resultArea = document.getElementById('result-area');
    const resultImage = document.getElementById('result-image');
    const btnReset = document.getElementById('btn-reset');

    const confSlider = document.getElementById('conf-slider');
    const confValue = document.getElementById('conf-value');
    const modelSelect = document.getElementById('model-select');
    
    const boundingBoxesContainer = document.getElementById('bounding-boxes-container');
    const toggleBoxesBtn = document.getElementById('toggle-boxes-btn');
    const modalOverlay = document.getElementById('info-modal');
    const modalClose = document.getElementById('modal-close');
    const modalDisease = document.getElementById('modal-disease');
    const modalConfidence = document.getElementById('modal-confidence');

    let currentFile = null;
    let currentBoxesData = [];
    let originalImageWidth = 1;
    let originalImageHeight = 1;

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
        
        const scaleX = displayedWidth / originalImageWidth;
        const scaleY = displayedHeight / originalImageHeight;
        
        currentBoxesData.forEach(box => {
            const div = document.createElement('div');
            div.className = 'bounding-box';
            
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
            
            // Legenda acima ou abaixo da box
            const labelSpan = document.createElement('span');
            labelSpan.className = 'bounding-box-label';
            labelSpan.innerText = `${diseaseName} (${confidencePercent})`;
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
                modalConfidence.innerText = confidencePercent;
                
                const modalContent = modalOverlay.querySelector('.modal-content');
                const modalWidth = 280; // Largura do modal configurada no CSS
                const modalHeight = 150; // Altura aproximada do modal
                
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

    modelSelect.addEventListener('change', (e) => {
        // Re-run the analysis when user changes the model
        if (currentFile) {
            handleFile(currentFile, false);
        }
    });

    // Reset button
    btnReset.addEventListener('click', () => {
        closeModal();
        resultArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        imageInput.value = '';
        currentFile = null;
        currentBoxesData = [];
        boundingBoxesContainer.innerHTML = '';
        
        // Reseta o estado de visibilidade do olho e das caixas
        boundingBoxesContainer.classList.remove('hidden-boxes');
        toggleBoxesBtn.querySelector('.eye-icon.open').style.display = 'block';
        toggleBoxesBtn.querySelector('.eye-icon.closed').style.display = 'none';
        
        imageInput.click(); // Abre o seletor de arquivo automaticamente
    });

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
        formData.append('model_name', modelSelect.value); // Envia o modelo selecionado

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

            // Set the local image as source
            const imageUrl = URL.createObjectURL(currentFile);
            resultImage.src = imageUrl;
            
            // Wait for image to load to get dimensions correct before drawing boxes
            resultImage.onload = () => {
                originalImageWidth = json.width;
                originalImageHeight = json.height;
                currentBoxesData = json.boxes || [];
                drawBoxes();
                
                resultImage.style.opacity = '1';
                loadingState.classList.add('hidden');
                resultArea.classList.remove('hidden');
            };

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
});
