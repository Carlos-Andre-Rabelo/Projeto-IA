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

    let currentFile = null;

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
        resultArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        imageInput.value = '';
        currentFile = null;
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
                throw new Error('Erro na análise da imagem.');
            }

            // The backend returns an image directly
            const blob = await response.blob();
            
            // Check if backend returned JSON error instead of image
            if (blob.type === 'application/json') {
                const text = await blob.text();
                const json = JSON.parse(text);
                throw new Error(json.error || 'Erro desconhecido.');
            }

            // Create object URL for the image
            const imageUrl = URL.createObjectURL(blob);
            
            // Display result
            resultImage.src = imageUrl;
            resultImage.style.opacity = '1';
            
            loadingState.classList.add('hidden');
            resultArea.classList.remove('hidden');

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
