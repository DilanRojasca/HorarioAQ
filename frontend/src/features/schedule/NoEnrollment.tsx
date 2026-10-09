import { useAuth } from '../auth/AuthContext';
import { card } from '../../shared/ui';

export default function NoEnrollment({ semester }: { semester: string }) {
  const { logout } = useAuth();
  return (
    <section className={`${card} mx-auto mt-4 max-w-md p-5`} aria-labelledby="inactive-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-primary">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">school</span>
          Univ. Católica Luis Amigó
        </span>
        <span className="rounded-full border border-[#FFDCC3] bg-[#FFF3E0] px-2.5 py-1 text-label-sm text-[#9A5B00]">Estado Inactivo</span>
      </div>

      <div className="mt-5 flex flex-col items-center text-center">
        <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-low">
          <span className="material-symbols-outlined text-[48px] text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">folder_managed</span>
          <span className="absolute -right-1 -top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">priority_high</span>
          </span>
        </span>
        <p className="mb-0 mt-4 text-label-sm uppercase text-on-surface-variant">Periodo académico</p>
        <h1 id="inactive-title" className="mb-0 mt-1 text-headline-lg font-bold text-on-surface">Semestre {semester}</h1>
      </div>

      <div className="mt-5 flex gap-2.5 rounded-r-lg border-l-4 border-secondary-container bg-[#FFF3E0] p-3">
        <span className="material-symbols-outlined shrink-0 text-[20px] text-secondary" aria-hidden="true">info</span>
        <p className="m-0 text-body-md text-on-surface">
          <strong className="font-bold text-secondary">No tienes matrícula vigente</strong> en el semestre {semester}. Contacta a Admisiones y Registro.
        </p>
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] px-4 font-semibold text-error hover:bg-error-container"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
        Cerrar sesión
      </button>
    </section>
  );
}
