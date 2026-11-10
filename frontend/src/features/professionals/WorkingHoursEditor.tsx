import { useState } from "react";
import { Alert } from "../../components/ui.tsx";
import {
  DAY_NAMES,
  type TimeRange,
  WEEK_ORDER,
  type WeekSchedule,
  type WorkingHoursItem,
  toWeekSchedule,
  toWorkingHoursItems,
  validateWeek,
} from "./schedule.ts";

type Props = {
  professionalName: string;
  initial: WorkingHoursItem[];
  saving: boolean;
  apiError: string | null;
  onSave: (items: WorkingHoursItem[]) => void;
  onCancel: () => void;
};

// Editor da semana: cada dia pode ter vários intervalos (ex.: 09:00–12:00 e 13:00–18:00, com almoço no meio).
// Ao salvar, a semana inteira é enviada e substitui a anterior (PUT).
export function WorkingHoursEditor({ professionalName, initial, saving, apiError, onSave, onCancel }: Props) {
  const [week, setWeek] = useState<WeekSchedule>(() => toWeekSchedule(initial));
  const [errors, setErrors] = useState<Record<number, string>>({});

  function updateDay(day: number, ranges: TimeRange[]) {
    setWeek({ ...week, [day]: ranges });
  }

  function addRange(day: number) {
    const ranges = week[day]!;
    // Primeiro intervalo: horário comercial. Seguintes: começam onde o anterior terminou.
    const next = ranges.length === 0 ? { startTime: "09:00", endTime: "18:00" } : { startTime: ranges.at(-1)!.endTime, endTime: "" };
    updateDay(day, [...ranges, next]);
  }

  /** Repete o expediente de um dia de segunda a sexta (o caso mais comum). */
  function copyToWeekdays(fromDay: number) {
    const next = { ...week };
    for (const day of [1, 2, 3, 4, 5]) next[day] = week[fromDay]!.map((range) => ({ ...range }));
    setWeek(next);
  }

  function handleSave() {
    const found = validateWeek(week);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(toWorkingHoursItems(week));
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Horários de {professionalName}</h3>
      {apiError && <Alert>{apiError}</Alert>}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {WEEK_ORDER.map((day) => {
          const ranges = week[day]!;
          return (
            <fieldset key={day} className="flex flex-wrap items-start gap-3 p-3">
              <legend className="sr-only">{DAY_NAMES[day]}</legend>
              <span className="w-20 pt-2 text-sm font-medium text-slate-700" aria-hidden>
                {DAY_NAMES[day]}
              </span>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 && <p className="pt-2 text-sm text-slate-400">Folga</p>}
                {ranges.map((range, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${DAY_NAMES[day]}: início do intervalo ${index + 1}`}
                      value={range.startTime}
                      onChange={(e) => updateDay(day, ranges.map((r, i) => (i === index ? { ...r, startTime: e.target.value } : r)))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                      type="time"
                      aria-label={`${DAY_NAMES[day]}: fim do intervalo ${index + 1}`}
                      value={range.endTime}
                      onChange={(e) => updateDay(day, ranges.map((r, i) => (i === index ? { ...r, endTime: e.target.value } : r)))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Remover intervalo ${index + 1} de ${DAY_NAMES[day]}`}
                      onClick={() => updateDay(day, ranges.filter((_, i) => i !== index))}
                      className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {errors[day] && <p className="text-sm text-red-700">{errors[day]}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => addRange(day)}
                  aria-label={`Adicionar intervalo em ${DAY_NAMES[day]}`}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  + intervalo
                </button>
                {day === 1 && ranges.length > 0 && (
                  <button
                    type="button"
                    onClick={() => copyToWeekdays(1)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Copiar para terça a sexta
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar horários"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
      </div>
    </div>
  );
}
