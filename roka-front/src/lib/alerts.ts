import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const showConfirm = async (options: {
  title: string;
  text: string;
  icon?: 'warning' | 'error' | 'success' | 'info' | 'question';
  confirmButtonText?: string;
  cancelButtonText?: string;
}) => {
  return MySwal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon || 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b', // amber-500
    cancelButtonColor: '#64748b',  // slate-500
    confirmButtonText: options.confirmButtonText || 'Confirmar',
    cancelButtonText: options.cancelButtonText || 'Cancelar',
    customClass: {
      popup: 'rounded-2xl border border-slate-100 shadow-xl dark:bg-slate-900 dark:border-slate-800',
      title: 'text-slate-900 dark:text-slate-100 font-bold',
      htmlContainer: 'text-slate-600 dark:text-slate-400',
      confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-lg shadow-amber-500/20',
      cancelButton: 'rounded-xl font-bold px-6 py-2.5',
    }
  });
};

export const showAlert = (options: {
  title: string;
  text: string;
  icon: 'success' | 'error' | 'warning' | 'info';
}) => {
  return MySwal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon,
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'rounded-2xl border border-slate-100 shadow-xl dark:bg-slate-900 dark:border-slate-800',
      title: 'text-slate-900 dark:text-slate-100 font-bold',
      htmlContainer: 'text-slate-600 dark:text-slate-400',
      confirmButton: 'rounded-xl font-bold px-6 py-2.5',
    }
  });
};

export const showToast = (options: {
  title: string;
  icon: 'success' | 'error' | 'warning' | 'info';
}) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
    customClass: {
      popup: 'rounded-xl shadow-lg dark:bg-slate-900 dark:text-slate-100',
    }
  });

  return Toast.fire({
    icon: options.icon,
    title: options.title
  });
};
