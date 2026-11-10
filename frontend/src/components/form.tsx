// Campo de formulário acessível: label ligado ao input, dica e erro anunciados pelo leitor de tela.

type TextFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
};

export function TextField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  placeholder,
  required,
}: TextFieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-600 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
