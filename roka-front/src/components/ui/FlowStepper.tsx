import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

interface FlowStepperProps {
  currentStep: number;
  estado?: string;
  tipo?: 'solicitud' | 'solicitud_cotizacion' | 'orden';
}

const FlowStepper: React.FC<FlowStepperProps> = ({ currentStep, estado, tipo = 'solicitud' }) => {
  const steps = [
    { number: 1, label: 'Solicitud', estado: 'Pendiente' },
    { number: 2, label: 'Cotización', estado: 'Cotizando' },
    { number: 3, label: 'Orden de Compra', estado: 'Aprobado' },
    { number: 4, label: 'Entrega', estado: 'Entrega' },
  ];

  const getStepIndex = () => {
    if (tipo === 'solicitud') {
      if (estado === 'Pendiente') return 0;
      if (estado === 'Cotizando') return 1;
      if (estado === 'Aprobado') return 2;
    } else if (tipo === 'solicitud_cotizacion') {
      if (estado === 'Pendiente') return 1;
      if (estado === 'Aprobada') return 2;
      if (estado === 'Rechazada') return 1;
    } else if (tipo === 'orden') {
      if (estado === 'Pendiente') return 3;
      if (estado === 'Recibido parcial') return 3;
      if (estado === 'Completado') return 3;
    }
    return currentStep;
  };

  const activeStep = getStepIndex();

  return (
    <div className="flex items-center justify-between w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                index <= activeStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              {index < activeStep ? (
                <CheckCircle size={24} />
              ) : (
                <span className="font-semibold">{step.number}</span>
              )}
            </div>
            <span className="text-xs font-medium mt-2 text-center text-gray-700 dark:text-slate-300 max-w-[80px]">
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-2 transition-all ${
                index < activeStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default FlowStepper;
