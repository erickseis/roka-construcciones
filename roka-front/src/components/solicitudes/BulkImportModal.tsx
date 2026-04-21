import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download, 
  Loader2,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { createSolicitud } from '@/lib/api';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  proyectos: any[];
  masterMateriales: any[];
  onSuccess: () => void;
}

export default function BulkImportModal({ 
  isOpen, 
  onClose, 
  proyectos, 
  masterMateriales,
  onSuccess 
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Header state
  const [proyectoId, setProyectoId] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          setError('El archivo está vacío o no tiene el formato correcto.');
          setLoading(false);
          return;
        }

        // Map and validate columns
        // Expected columns (flexible): Material/Descripcion, SKU/Codigo, Cantidad, Unidad
        const mapped = json.map((row, index) => {
          const materialName = row['Material'] || row['Descripcion'] || row['Descripción'] || row['Nombre'] || '';
          const sku = row['SKU'] || row['Codigo'] || row['Código'] || '';
          const cantidad = Number(row['Cantidad'] || row['Cant'] || 0);
          const unidad = row['Unidad'] || row['Medida'] || 'Unidades';

          // Try to match with master catalog
          let matchedMaterial = null;
          if (sku) {
            matchedMaterial = masterMateriales.find(m => String(m.sku).toLowerCase() === String(sku).toLowerCase());
          }
          if (!matchedMaterial && materialName) {
            matchedMaterial = masterMateriales.find(m => m.nombre.toLowerCase() === materialName.toLowerCase());
          }

          return {
            id: index,
            material_id: matchedMaterial?.id || null,
            nombre_material: matchedMaterial?.nombre || materialName,
            cantidad_requerida: cantidad,
            unidad: matchedMaterial?.unidad_abreviatura || unidad,
            is_valid: materialName && cantidad > 0,
            original_row: row
          };
        });

        setParsedData(mapped);
      } catch (err) {
        setError('Error al procesar el archivo. Asegúrate de que sea un Excel o CSV válido.');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!proyectoId || !solicitante || parsedData.length === 0) {
      setError('Por favor completa todos los campos y carga un archivo válido.');
      return;
    }

    const validItems = parsedData.filter(item => item.is_valid);
    if (validItems.length === 0) {
      setError('No hay ítems válidos para importar.');
      return;
    }

    setSubmitting(true);
    try {
      await createSolicitud({
        proyecto_id: Number(proyectoId),
        solicitante,
        items: validItems.map(i => ({
          material_id: i.material_id,
          nombre_material: i.nombre_material,
          cantidad_requerida: i.cantidad_requerida,
          unidad: i.unidad,
        })),
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la solicitud masiva.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setError(null);
    setProyectoId('');
    setSolicitante('');
    onClose();
  };

  const downloadTemplate = () => {
    const templateData = [
      { 'Material': 'Cemento Gris', 'Cantidad': 10, 'Unidad': 'Sacos', 'SKU': 'CEM-001' },
      { 'Material': 'Varilla 1/2', 'Cantidad': 50, 'Unidad': 'Piezas', 'SKU': 'VAR-002' },
      { 'Material': 'Arena IT', 'Cantidad': 5.5, 'Unidad': 'm3', 'SKU': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_Solicitud_Materiales.xlsx');
  };

  const removeItem = (id: number) => {
    setParsedData(prev => prev.filter(item => item.id !== id));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Carga Masiva de Materiales"
      subtitle="Sube un archivo Excel o CSV para crear una solicitud rápidamente"
      size="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Info & Header */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto</label>
            <select
              value={proyectoId}
              onChange={e => setProyectoId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Seleccionar proyecto...</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitante</label>
            <input
              type="text"
              value={solicitante}
              onChange={e => setSolicitante(e.target.value)}
              placeholder="Nombre de quien solicita"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </div>

        {/* Step 2: File Upload */}
        {!file ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 transition-all hover:border-amber-400 hover:bg-amber-50"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden" 
            />
            <div className="mb-3 rounded-full bg-white p-3 shadow-sm transition-transform group-hover:scale-110">
              <Upload className="text-amber-500" size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700">Haz clic para subir o arrastra un archivo</p>
            <p className="mt-1 text-xs text-slate-500">Excel (.xlsx, .xls) o CSV</p>
            
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
              className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:underline"
            >
              <Download size={12} /> Descargar Plantilla
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500 p-2 text-white">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB — {parsedData.length} ítems encontrados</p>
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setParsedData([]); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Step 3: Preview */}
        {parsedData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Previsualización de Items</h3>
              <span className="text-[10px] font-medium text-slate-400">
                Solo se importarán los marcados con <CheckCircle2 size={10} className="inline text-emerald-500" />
              </span>
            </div>
            
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-center w-8">#</th>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 w-20 text-right">Cant.</th>
                    <th className="px-3 py-2 w-20">Unidad</th>
                    <th className="px-3 py-2 text-center w-10">Estado</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((item, idx) => (
                    <tr key={item.id} className={!item.is_valid ? 'bg-red-50/30' : ''}>
                      <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-700">{item.nombre_material || 'N/A'}</div>
                        {item.material_id && (
                          <div className="text-[9px] text-amber-600 font-medium">Vinculado al catálogo</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-600">
                        {item.cantidad_requerida}
                      </td>
                      <td className="px-3 py-2 text-slate-500 italic">{item.unidad}</td>
                      <td className="px-3 py-2 text-center">
                        {item.is_valid ? (
                          <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                        ) : (
                          <AlertCircle size={14} className="mx-auto text-red-400" title="Nombre o cantidad inválidos" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={submitting || !file || !proyectoId || !solicitante || loading}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Confirmar Importación
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
