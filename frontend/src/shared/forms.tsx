import { useId, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * Librería de formularios compartida (DRY): un solo estilo y un solo lugar para la accesibilidad
 * (etiquetas, `aria-invalid`, `aria-describedby`, objetivos táctiles ≥ 44 px, foco visible).
 * Toda pantalla con formulario compone estas piezas en vez de repetir clases.
 */

const base =
  'block w-full min-h-[48px] rounded-[10px] border bg-surface-container-lowest px-3.5 text-body-md text-on-surface shadow-[inset_0_1px_0_rgba(27,42,51,0.03)] transition-[border-color,box-shadow] placeholder:text-outline focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant read-only:bg-surface-container-low read-only:text-on-surface-variant';
const stateOk = 'border-outline-variant hover:border-outline focus:border-primary focus-visible:ring-primary/20';
const stateErr = 'border-error focus:border-error focus-visible:ring-error/20';

/** Clases de un campo de texto (para usos sueltos como la barra de búsqueda). */
export const fieldInput = `${base} ${stateOk}`;

export const primaryButton =
  'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary-container px-4 font-semibold text-on-primary shadow-sm transition hover:bg-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:bg-primary-container disabled:active:translate-y-0';

export const secondaryButton =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-outline-variant bg-surface-container-lowest px-3.5 text-label-md font-semibold text-primary transition hover:border-primary/40 hover:bg-surface-container active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface-container-lowest';

const dangerButton =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-error/30 bg-surface-container-lowest px-3.5 text-label-md font-semibold text-error transition hover:bg-error-container/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined text-[20px] ${className}`} aria-hidden="true">{name}</span>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin ${className}`}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Muestra un spinner y deshabilita el botón mientras se procesa. */
  loading?: boolean;
  loadingText?: string;
  icon?: string;
}

/** Botón con estados de carga. Mantiene su ancho (no «salta») gracias al texto de carga explícito. */
export function Button({ variant = 'primary', loading = false, loadingText, icon, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  const style = variant === 'primary' ? primaryButton : variant === 'danger' ? dangerButton : secondaryButton;
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${style} ${className}`} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} className="text-[18px]" /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

/* ------------------------------------------------------------------ Campos */

interface FieldBase {
  label: string;
  error?: string;
  hint?: string;
  /** Marca «(opcional)» junto a la etiqueta. */
  optional?: boolean;
}

function FieldShell({ id, label, error, hint, optional, counter, children }: FieldBase & { id: string; counter?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-label-md font-semibold text-on-surface">
          {label}
          {optional && <span className="ml-1 font-normal text-on-surface-variant">(opcional)</span>}
        </label>
        {counter && <span className="text-label-sm text-outline" aria-hidden="true">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p id={`${id}-err`} className="m-0 mt-1.5 flex items-start gap-1 text-body-sm text-error">
          <Icon name="error" className="mt-px text-[16px]" />{error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 mt-1.5 text-body-sm text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

interface FieldProps extends FieldBase, Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  /** Ícono a la izquierda (nombre de Material Symbols). */
  icon?: string;
  /** Elemento propio a la derecha (p. ej. un botón). */
  trailing?: ReactNode;
  /** Muestra ✓ cuando el valor es válido y el campo ya tiene contenido. */
  valid?: boolean;
}

export function Field({ id, label, error, hint, optional, icon, trailing, valid, className = '', maxLength, value, ...input }: FieldProps) {
  const len = typeof value === 'string' ? value.length : undefined;
  const counter = maxLength && len !== undefined && len > maxLength * 0.7 ? `${len}/${maxLength}` : undefined;
  const showValid = valid && !error && typeof value === 'string' && value.length > 0;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} counter={counter}>
      <div className="relative">
        {icon && <Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />}
        <input
          id={id} value={value} maxLength={maxLength} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)}
          className={`${base} ${error ? stateErr : stateOk} ${icon ? 'pl-11' : ''} ${trailing || showValid ? 'pr-12' : ''} ${className}`} {...input}
        />
        {showValid && <Icon name="check_circle" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1E7E34]" />}
        {trailing}
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps extends FieldBase, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> { id: string }

/** `<select>` nativo (accesible y con teclado móvil correcto) con chevron propio y el mismo estilo que `Field`. */
export function SelectField({ id, label, error, hint, optional, className = '', children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <div className="relative">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} className={`${base} ${error ? stateErr : stateOk} appearance-none pr-10 ${className}`} {...rest}>
          {children}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
      </div>
    </FieldShell>
  );
}

/** Select compacto sin etiqueta visible (filtros, filas de tabla). Exige `aria-label`. */
export function InlineSelect({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { 'aria-label': string }) {
  return (
    <div className={`relative ${className}`}>
      <select className={`${fieldInput} appearance-none pr-9`} {...rest}>{children}</select>
      <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline" />
    </div>
  );
}

interface TextAreaProps extends FieldBase, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> { id: string }

export function TextAreaField({ id, label, error, hint, optional, maxLength, value, className = '', rows = 3, ...rest }: TextAreaProps) {
  const len = typeof value === 'string' ? value.length : undefined;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} counter={maxLength && len !== undefined ? `${len}/${maxLength}` : undefined}>
      <textarea
        id={id} value={value} rows={rows} maxLength={maxLength} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)}
        className={`${base} resize-y py-3 ${error ? stateErr : stateOk} ${className}`} {...rest}
      />
    </FieldShell>
  );
}

/* ------------------------------------------------------------- Contraseñas */

export interface PasswordRule { label: string; ok: boolean }

/** Reglas de la política de contraseña (las mismas que valida el servidor). */
export const passwordRules = (pw: string): PasswordRule[] => [
  { label: 'Mínimo 8 caracteres', ok: pw.length >= 8 },
  { label: 'Mayúsculas y minúsculas', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { label: 'Al menos un número', ok: /\d/.test(pw) },
];

const STRENGTH = [
  { label: 'Muy débil', bar: 'bg-error' },
  { label: 'Débil', bar: 'bg-error' },
  { label: 'Aceptable', bar: 'bg-secondary-container' },
  { label: 'Fuerte', bar: 'bg-[#1E7E34]' },
];

/** 0–3 según cuántas reglas se cumplen; +1 de holgura no se usa para no prometer más de lo que valida el servidor. */
export const passwordScore = (pw: string) => passwordRules(pw).filter((r) => r.ok).length;

interface PasswordFieldProps extends FieldBase, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  /** Muestra el medidor de fortaleza y la lista de requisitos (registro, cambio y recuperación). */
  showStrength?: boolean;
}

/** Campo de contraseña con mostrar/ocultar y, opcionalmente, medidor de fortaleza con checklist en vivo. */
export function PasswordField({ id, label, error, hint, optional, showStrength, value, className = '', ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const meterId = useId();
  const pw = typeof value === 'string' ? value : '';
  const score = passwordScore(pw);
  return (
    <div>
      <Field
        id={id} label={label} error={error} hint={showStrength ? undefined : hint} optional={optional} icon="lock" value={value}
        type={visible ? 'text' : 'password'} className={`pr-12 ${className}`}
        {...(showStrength && pw ? { 'aria-describedby': meterId } : {})}
        trailing={(
          <button
            type="button" aria-label="Mostrar u ocultar contraseña" aria-pressed={visible} onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-r-[10px] text-on-surface-variant hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name={visible ? 'visibility_off' : 'visibility'} />
          </button>
        )}
        {...input}
      />
      {showStrength && (
        <div id={meterId} className="mt-2.5 space-y-2">
          {pw && (
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? STRENGTH[score].bar : 'bg-outline-variant/60'}`} />)}
              </div>
              <span className="w-20 text-right text-label-sm font-semibold text-on-surface-variant">{STRENGTH[score].label}</span>
            </div>
          )}
          <ul className="m-0 grid list-none grid-cols-1 gap-x-4 gap-y-1 p-0 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
            {passwordRules(pw).map((r) => (
              <li key={r.label} className={`flex items-center gap-1.5 text-body-sm ${r.ok ? 'text-[#1E7E34]' : 'text-on-surface-variant'}`}>
                <Icon name={r.ok ? 'check_circle' : 'radio_button_unchecked'} className="text-[16px]" />
                <span>{r.label}</span><span className="sr-only">{r.ok ? ': cumplido' : ': pendiente'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Campo de código de un solo uso: números grandes, espaciados y con teclado numérico. */
export function OtpField({ id, label, value, onChange, hint, error }: { id: string; label: string; value: string; onChange(v: string): void; hint?: string; error?: string }) {
  return (
    <Field
      id={id} label={label} value={value} hint={hint} error={error} maxLength={6} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      className="text-center font-mono text-[24px] tracking-[0.5em] placeholder:tracking-[0.5em]"
    />
  );
}

/* --------------------------------------------------- Interruptor y opciones */

/** Interruptor accesible (`role="switch"`): para ajustes de sí/no con efecto inmediato. */
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[10px] text-left focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span>
        <span className="block text-body-md text-on-surface">{label}</span>
        {description && <span className="block text-body-sm text-on-surface-variant">{description}</span>}
      </span>
      <span aria-hidden="true" className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-container' : 'bg-outline-variant'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  );
}

export interface Option<T extends string> { value: T; label: string; hint?: string; icon?: string }

/** Grupo de opciones como tarjetas (radios reales, accesibles por teclado), mejor que radios sueltos para 2–4 opciones. */
export function OptionCards<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: Option<T>[]; onChange(v: T): void }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 text-label-md font-semibold text-on-surface">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label
            key={o.value}
            className={`relative flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20 ${value === o.value ? 'border-primary bg-surface-container' : 'border-outline-variant bg-surface-container-lowest hover:border-outline'}`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon && <Icon name={o.icon} className={value === o.value ? 'text-primary' : 'text-outline'} />}
            <span className="min-w-0">
              <span className="block text-body-md font-semibold text-on-surface">{o.label}</span>
              {o.hint && <span className="block text-body-sm text-on-surface-variant">{o.hint}</span>}
            </span>
            {value === o.value && <Icon name="check_circle" className="ml-auto text-primary" />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* -------------------------------------------------------------- Mensajes */

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-error">
      <Icon name="error" />
      <p className="m-0 text-body-md font-medium">{children}</p>
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex gap-2.5 rounded-[10px] border border-outline-variant/60 border-l-4 border-l-[#1E7E34] bg-surface-container-low p-3">
      <Icon name="check_circle" className="text-[#1E7E34]" />
      <p className="m-0 text-body-md text-on-surface">{children}</p>
    </div>
  );
}

/** Tarjeta de formulario con título e ícono; agrupa campos relacionados. */
export function FormSection({ id, title, icon, description, children }: { id: string; title: string; icon?: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_3px_rgba(27,42,51,0.04),0_1px_2px_rgba(27,42,51,0.02)] md:p-5">
      <div>
        <h2 id={id} className="m-0 flex items-center gap-2 text-title-md text-on-surface">
          {icon && <Icon name={icon} className="text-primary" />}{title}
        </h2>
        {description && <p className="m-0 mt-1 text-body-sm text-on-surface-variant">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Marco de las pantallas públicas (login, registro, verificación, recuperación). */
export function AuthShell({ title, subtitle, icon = 'account_circle', children }: { title: string; subtitle?: string; icon?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-surface-container-low to-surface">
      <header className="flex h-16 items-center gap-3 border-b-4 border-secondary-container bg-primary-container px-4 md:px-margin-desktop">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-secondary-container" aria-hidden="true">
          <span className="material-symbols-outlined text-[22px]">school</span>
        </span>
        <div className="flex flex-col">
          <span className="text-headline-md font-bold tracking-tight text-on-primary">Horario UNI</span>
          <span className="text-label-sm text-on-primary-container">Universidad Católica Luis Amigó</span>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-3 py-8 sm:items-center">
        <div className="w-full max-w-[440px] rounded-[14px] border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(27,42,51,0.08)]">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary-container" aria-hidden="true">
              <span className="material-symbols-outlined text-[30px]">{icon}</span>
            </span>
            <h1 className="m-0 text-headline-md font-bold text-on-surface">{title}</h1>
            {subtitle && <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-body-sm text-on-surface-variant">
        Universidad Católica Luis Amigó · Sistema de Horarios Académicos
      </footer>
    </div>
  );
}
