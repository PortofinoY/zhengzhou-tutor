const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png'
};
const ALLOWED_PURPOSES = new Set(['avatar', 'student_card', 'complaint_evidence']);

function uploadError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasValidSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

function parseImageUpload(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { files: 1, fields: 4, fileSize: MAX_IMAGE_BYTES }
      });
    } catch (error) {
      reject(uploadError('上传请求格式不正确'));
      return;
    }

    const fields = {};
    let uploadedFile = null;
    let failure = null;
    let fileSeen = false;

    parser.on('field', (name, value) => {
      fields[name] = String(value || '').trim();
    });

    parser.on('file', (fieldName, stream, info) => {
      if (fieldName !== 'file' || fileSeen) {
        failure = failure || uploadError('上传文件字段不正确');
        stream.resume();
        return;
      }
      fileSeen = true;
      const mimeType = String(info.mimeType || '').toLowerCase();
      if (!MIME_EXTENSIONS[mimeType]) {
        failure = uploadError('仅支持 JPG、JPEG、PNG 图片');
        stream.resume();
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        failure = uploadError('图片大小不能超过 10MB');
      });
      stream.on('end', () => {
        if (failure) return;
        const buffer = Buffer.concat(chunks);
        if (!hasValidSignature(buffer, mimeType)) {
          failure = uploadError('图片文件内容无效');
          return;
        }
        uploadedFile = {
          buffer,
          mimeType,
          extension: MIME_EXTENSIONS[mimeType],
          originalName: String(info.filename || '')
        };
      });
    });

    parser.on('filesLimit', () => {
      failure = uploadError('每次只能上传 1 张图片');
    });
    parser.on('error', () => reject(uploadError('图片上传失败，请重试')));
    parser.on('finish', () => {
      if (failure) {
        reject(failure);
        return;
      }
      if (!uploadedFile) {
        reject(uploadError('请选择需要上传的图片'));
        return;
      }
      if (!ALLOWED_PURPOSES.has(fields.purpose)) {
        reject(uploadError('图片用途不正确'));
        return;
      }
      resolve({ ...uploadedFile, purpose: fields.purpose });
    });

    req.pipe(parser);
  });
}

function persistImageUpload(upload, uploadDir) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${upload.purpose}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${upload.extension}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, upload.buffer, { flag: 'wx' });
  return { filename, filePath, size: upload.buffer.length };
}

module.exports = {
  MAX_IMAGE_BYTES,
  parseImageUpload,
  persistImageUpload
};
