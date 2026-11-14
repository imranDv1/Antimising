"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "./countries";

// Helper for flag emoji from country code
export function getFlagEmoji(countryCode: string) {
  // Only make flag for two-letter A-Z (standard ISO 3166-1 alpha-2)
  if (!/^[A-Z]{2}$/i.test(countryCode)) {
    return "🏳️"; // fallback for non-standard codes
  }
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

export function getCountryLabel(countryCode: string) {
  return countries.find((country) => country.value === countryCode)?.label ?? "";
}

interface CountrySelectorProps {
  edit: boolean;
  value: string; // القيمة الحالية
  onChange: (value: string) => void; // دالة تغيير القيمة
}

export function CountrySelector({ edit, value, onChange }: CountrySelectorProps) {
  return (
    <Select disabled={edit} value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a country" />
      </SelectTrigger>
      <SelectContent>
        {countries.map((country) => (
          <SelectItem key={country.value} value={country.value}>
            <span className="flex items-center gap-2">
              <span className="text-xl">{getFlagEmoji(country.value)}</span>
              <span>{country.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
