'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Icon, type IconName } from './icon';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  trailing?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, error, hint, icon, trailing, className, ...props },
  ref,
) {
  const describedBy =
    [props['aria-describedby'], error ? `${id}-error` : hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && (
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div
        className={cn(
          'field-control',
          icon && 'field-control--icon',
          Boolean(trailing) && 'field-control--trailing',
          error && 'field-control--invalid',
        )}
      >
        {icon && <Icon name={icon} className="field-icon" />}
        <input
          ref={ref}
          {...props}
          id={id}
          className={className}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function PasswordField(props: Omit<FieldProps, 'type' | 'icon' | 'trailing'>) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      icon="lock"
      trailing={
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${props.label.toLowerCase()}`}
          aria-controls={props.id}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      }
    />
  );
}
