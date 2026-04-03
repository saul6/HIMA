import { useState } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "time";
  disabled?: boolean;
  placeholder?: string;
}

export function FormField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder = "",
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== "";

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full h-14 px-4 pt-5 pb-2 rounded-lg border border-black/10 bg-white
          focus:outline-none focus:border-[#2B7AB5] focus:ring-1 focus:ring-[#2B7AB5]
          disabled:bg-gray-50 disabled:text-gray-600 transition-all`}
      />
      <label
        className={`absolute left-4 transition-all pointer-events-none text-gray-600
          ${
            isFocused || hasValue
              ? "top-2 text-[11px]"
              : "top-1/2 -translate-y-1/2 text-sm"
          }`}
        style={{ fontWeight: isFocused || hasValue ? 600 : 400 }}
      >
        {label}
      </label>
    </div>
  );
}