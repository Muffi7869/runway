import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "../../lib/utils";

function FieldFrame({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="ui-field__hint">{hint}</p> : null}
      {error ? (
        <p className="ui-field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function InputField({
  error,
  hint,
  id,
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  return (
    <FieldFrame error={error} hint={hint} id={id} label={label}>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        className={cn("ui-input", className)}
        id={id}
        {...props}
      />
    </FieldFrame>
  );
}

export function SelectField({
  children,
  error,
  hint,
  id,
  label,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  return (
    <FieldFrame error={error} hint={hint} id={id} label={label}>
      <select className={cn("ui-input", className)} id={id} {...props}>
        {children}
      </select>
    </FieldFrame>
  );
}

export function TextareaField({
  error,
  hint,
  id,
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  hint?: string;
  id: string;
  label: string;
}) {
  return (
    <FieldFrame error={error} hint={hint} id={id} label={label}>
      <textarea className={cn("ui-input ui-textarea", className)} id={id} {...props} />
    </FieldFrame>
  );
}
