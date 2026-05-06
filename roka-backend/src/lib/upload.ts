import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDirs = ['uploads/licitaciones', 'uploads/materiales', 'uploads/cotizaciones'];

uploadDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const getUploadDir = (fieldname: string): string => {
  if (fieldname === 'archivo_materiales') return 'uploads/materiales';
  if (fieldname === 'archivo_cotizacion') return 'uploads/cotizaciones';
  return 'uploads/licitaciones';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), getUploadDir(file.fieldname)));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
  const allowedExts = ['.pdf', '.xlsx', '.xls', '.csv'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: PDF, Excel, CSV`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export default upload;
