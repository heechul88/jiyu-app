// 이미지/파일 선택 및 업로드 유틸리티

// 이미지 파일 선택 (갤러리에서)
export const selectImageFromGallery = () => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;
        
        input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        file,
                        dataUrl: e.target?.result,
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else {
                reject(new Error('No file selected'));
            }
        };
        
        input.click();
    });
};

// 카메라로 사진 촬영
export const captureImageFromCamera = () => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // 후면 카메라 사용
        
        input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        file,
                        dataUrl: e.target?.result,
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else {
                reject(new Error('No photo captured'));
            }
        };
        
        input.click();
    });
};

// 비디오 파일 선택
export const selectVideoFile = () => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.multiple = false;
        
        input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
                const url = URL.createObjectURL(file);
                resolve({
                    file,
                    url,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            } else {
                reject(new Error('No video selected'));
            }
        };
        
        input.click();
    });
};

// 드래그 앤 드롭 설정
export const setupDragAndDrop = (element, onFileDrop) => {
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        element.classList.add('drag-over');
    };
    
    const handleDragLeave = (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        const videoFiles = files.filter(file => file.type.startsWith('video/'));
        
        if (imageFiles.length > 0 || videoFiles.length > 0) {
            onFileDrop({ images: imageFiles, videos: videoFiles });
        }
    };
    
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
    
    // cleanup function
    return () => {
        element.removeEventListener('dragover', handleDragOver);
        element.removeEventListener('dragleave', handleDragLeave);
        element.removeEventListener('drop', handleDrop);
    };
};

// 파일 크기를 읽기 쉬운 형태로 변환
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};