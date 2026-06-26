import type { ComponentChildren, JSX } from 'preact';

export function Panel(props: {
  title: string;
  badge?: ComponentChildren;
  intro?: ComponentChildren;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <section class="module-panel">
      <div class="module-panel__head">
        <h1>{props.title}</h1>
        {props.badge !== undefined && <span class="module-panel__badge">{props.badge}</span>}
      </div>
      {props.intro !== undefined && <p class="module-panel__intro">{props.intro}</p>}
      {props.children}
    </section>
  );
}

export function Card(props: { title?: string; children: ComponentChildren }): JSX.Element {
  return (
    <div class="module-panel__card">
      {props.title && <h2 class="card__title">{props.title}</h2>}
      {props.children}
    </div>
  );
}

export function Hint(props: { children: ComponentChildren }): JSX.Element {
  return <p class="module-panel__hint">{props.children}</p>;
}

export function Metric(props: { label: string; value: ComponentChildren; hint?: string }): JSX.Element {
  return (
    <div class="module-panel__metric">
      <span class="metric__label">{props.label}</span>
      <span class="metric__value">{props.value}</span>
      {props.hint && <span class="metric__hint">{props.hint}</span>}
    </div>
  );
}

export function Chip(props: {
  children: ComponentChildren;
  tone?: 'accent' | 'success' | 'info' | 'warn' | 'danger' | 'muted';
}): JSX.Element {
  return <span class={`chip chip--${props.tone ?? 'muted'}`}>{props.children}</span>;
}

export function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  id?: string;
}): JSX.Element {
  return (
    <label class="toggle">
      <input
        type="checkbox"
        checked={props.checked}
        id={props.id}
        onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
      />
      <span class="toggle__track" aria-hidden="true">
        <span class="toggle__thumb" />
      </span>
      {props.label && <span class="toggle__label">{props.label}</span>}
    </label>
  );
}

export function Segment<T extends string | number>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div class="seg" role="tablist">
      {props.options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="tab"
          aria-selected={opt.value === props.value}
          class={`seg__btn ${opt.value === props.value ? 'is-active' : ''}`}
          onClick={() => props.onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Field(props: { label: string; children: ComponentChildren; hint?: string }): JSX.Element {
  return (
    <label class="field">
      <span class="field__label">{props.label}</span>
      {props.children}
      {props.hint && <span class="field__hint">{props.hint}</span>}
    </label>
  );
}

export function Button(props: {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type={props.type ?? 'button'}
      class={`btn btn--${props.variant ?? 'ghost'}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function Empty(props: { children: ComponentChildren }): JSX.Element {
  return <div class="state-empty">{props.children}</div>;
}
