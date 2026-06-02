// 图片压缩和处理工具 - 基于 NextChat 实现优化

/**
 * NextChat 风格的图片压缩函数
 * @param {Blob} file 图片文件
 * @param {number} maxSize 最大大小（字节），默认 256KB
 * @returns {Promise<string>} 压缩后的 base64 数据 URL
 */
export function compressImage(file, maxSize = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (readerEvent) => {
      const image = new Image();
      
      image.onload = () => {
        try {
          let canvas = document.createElement("canvas");
          let ctx = canvas.getContext("2d");
          let width = image.width;
          let height = image.height;
          let quality = 0.9;
          let dataUrl;
          
          // NextChat 压缩策略：先降低质量，再缩小尺寸
          do {
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, width, height);
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            
            if (dataUrl.length < maxSize) break;
            
            if (quality > 0.5) {
              // 优先降低质量（0.9 → 0.5）
              quality -= 0.1;
            } else {
              // 然后缩小尺寸（每次缩小 90%）
              width *= 0.9;
              height *= 0.9;
            }
          } while (dataUrl.length > maxSize);
          
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      image.onerror = reject;
      image.src = readerEvent.target.result;
    };
    
    reader.onerror = reject;
    
    // HEIC 支持（可选，根据需要）
    if (file.type && file.type.includes("heic")) {
      // 如果需要 HEIC 支持，可以引入 heic2any 库
      // 这里暂时直接读取
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/**
 * 将图片文件转换为 base64（带压缩）
 * @param {File} file 图片文件
 * @param {boolean} useCompression 是否压缩
 * @param {number} maxSize 压缩后的最大大小（字节）
 * @returns {Promise<string>}
 */
export async function fileToDataURL(file, useCompression = true, maxSize = 256 * 1024) {
  if (useCompression && file.type && file.type.startsWith("image/")) {
    try {
      return await compressImage(file, maxSize);
    } catch (error) {
      console.warn("图片压缩失败，使用原始图片:", error);
    }
  }
  
  // 如果不压缩或压缩失败，直接转换
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 生成图片的缩略图
 * @param {File} file 图片文件
 * @param {number} maxSize 最大尺寸
 * @returns {Promise<string>}
 */
export async function generateThumbnail(file, maxSize = 200) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const image = new Image();
      
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(image.width, image.height, maxSize);
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext("2d");
        const sx = (image.width - size) / 2;
        const sy = (image.height - size) / 2;
        
        ctx.drawImage(image, sx, sy, size, size, 0, 0, size, size);
        
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      
      image.onerror = () => resolve(null);
      image.src = e.target.result;
    };
    
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * 将 base64 图片转换为 Blob
 * @param {string} base64Data base64 数据
 * @param {string} contentType 内容类型
 * @returns {Blob}
 */
export function base64Image2Blob(base64Data, contentType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType || "image/jpeg" });
}

/**
 * 检查是否是视觉模型（用于 NextChat 兼容性）
 * @param {string} modelName 模型名称
 * @returns {boolean}
 */
export function isVisionModel(modelName) {
  if (!modelName) return false;
  
  const visionModelRegexes = [
    /vision/i,
    /gpt-4o/i,
    /gpt-4\.1/i,
    /claude.*[34]/i,
    /gemini-1\.5/i,
    /gemini-exp/i,
    /gemini-2\.[05]/i,
    /qwen-vl/i,
    /qwen2-vl/i,
    /gpt-4-turbo(?!.*preview)/i,
    /^dall-e-3$/i,
    /glm-4v/i,
    /vl/i,
    /o3/i,
    /o4-mini/i,
    /grok-4/i,
    /gpt-5/i
  ];
  
  const excludeVisionModelRegexes = [
    /claude-3-5-haiku-20241022/i
  ];
  
  for (const regex of excludeVisionModelRegexes) {
    if (regex.test(modelName)) return false;
  }
  
  for (const regex of visionModelRegexes) {
    if (regex.test(modelName)) return true;
  }
  
  return false;
}
