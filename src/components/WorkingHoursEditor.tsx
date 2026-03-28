import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Copy } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface TimeSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface WeekSchedule {
  [day: string]: DaySchedule;
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday:    { enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  tuesday:   { enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  wednesday: { enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  thursday:  { enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  friday:    { enabled: true,  slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  saturday:  { enabled: true,  slots: [{ start: '09:00', end: '12:00' }] },
  sunday:    { enabled: false, slots: [] },
};

/**
 * Serializes a WeekSchedule to a compact string for DB storage.
 * Format: "Mon 09:00-12:00,14:00-18:00 | Tue 09:00-12:00,14:00-18:00 | Sat 09:00-12:00 | Sun OFF"
 */
export function serializeSchedule(schedule: WeekSchedule): string {
  const dayAbbr: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  };

  return DAY_KEYS.map(day => {
    const d = schedule[day];
    if (!d.enabled || d.slots.length === 0) return `${dayAbbr[day]} OFF`;
    const slotsStr = d.slots.map(s => `${s.start}-${s.end}`).join(',');
    return `${dayAbbr[day]} ${slotsStr}`;
  }).join(' | ');
}

/**
 * Deserializes a string back to WeekSchedule.
 * Supports both new format ("Mon 09:00-12:00,14:00-18:00 | ...") and legacy ("Mon-Sat 09:00-18:00").
 */
export function deserializeSchedule(str: string): WeekSchedule {
  if (!str) return { ...DEFAULT_SCHEDULE };

  // Check for new pipe-separated format
  if (str.includes('|')) {
    const abbrToDay: Record<string, string> = {
      Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
      Fri: 'friday', Sat: 'saturday', Sun: 'sunday'
    };

    const schedule: WeekSchedule = {};
    for (const day of DAY_KEYS) {
      schedule[day] = { enabled: false, slots: [] };
    }

    const parts = str.split('|').map(p => p.trim());
    for (const part of parts) {
      const match = part.match(/^(\w{3})\s+(.+)$/);
      if (!match) continue;
      const dayKey = abbrToDay[match[1]];
      if (!dayKey) continue;

      if (match[2] === 'OFF') {
        schedule[dayKey] = { enabled: false, slots: [] };
      } else {
        const slots = match[2].split(',').map(s => {
          const [start, end] = s.trim().split('-');
          return { start: start?.trim() || '09:00', end: end?.trim() || '18:00' };
        });
        schedule[dayKey] = { enabled: true, slots };
      }
    }
    return schedule;
  }

  // Legacy format: "Mon-Sat 09:00-18:00" or "Lun-Sam 09:00-18:00"
  const legacyMatch = str.match(/(\d{1,2})[h:]?\s*(\d{2})?\s*[-–]\s*(\d{1,2})[h:]?\s*(\d{2})?/);
  const startH = legacyMatch ? `${String(parseInt(legacyMatch[1])).padStart(2, '0')}:${legacyMatch[2] || '00'}` : '09:00';
  const endH = legacyMatch ? `${String(parseInt(legacyMatch[3])).padStart(2, '0')}:${legacyMatch[4] || '00'}` : '18:00';

  const hasSunday = str.toLowerCase().includes('dim') || str.toLowerCase().includes('sun') || str.includes('7/7');
  const hasSatHalf = str.toLowerCase().includes('sam') && str.toLowerCase().includes('12');

  const schedule: WeekSchedule = {};
  for (const day of DAY_KEYS) {
    if (day === 'sunday') {
      schedule[day] = { enabled: hasSunday, slots: hasSunday ? [{ start: startH, end: endH }] : [] };
    } else if (day === 'saturday' && hasSatHalf) {
      schedule[day] = { enabled: true, slots: [{ start: startH, end: '12:00' }] };
    } else {
      schedule[day] = { enabled: true, slots: [{ start: startH, end: endH }] };
    }
  }
  return schedule;
}

interface WorkingHoursEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function WorkingHoursEditor({ value, onChange, disabled }: WorkingHoursEditorProps) {
  const { t, lang } = useLanguage();
  const [schedule, setSchedule] = useState<WeekSchedule>(() => deserializeSchedule(value));
  const [copySource, setCopySource] = useState<string | null>(null);

  useEffect(() => {
    onChange(serializeSchedule(schedule));
  }, [schedule]);

  // Re-parse if value changes externally
  useEffect(() => {
    const parsed = deserializeSchedule(value);
    const serialized = serializeSchedule(parsed);
    const current = serializeSchedule(schedule);
    if (serialized !== current) {
      setSchedule(parsed);
    }
  }, [value]);

  const dayLabels: Record<string, string> = {
    monday: t('day.monday'), tuesday: t('day.tuesday'), wednesday: t('day.wednesday'),
    thursday: t('day.thursday'), friday: t('day.friday'), saturday: t('day.saturday'), sunday: t('day.sunday'),
  };

  const dayAbbr: Record<string, string> = {
    monday: lang === 'fr' ? 'Lun' : 'Mon',
    tuesday: lang === 'fr' ? 'Mar' : 'Tue',
    wednesday: lang === 'fr' ? 'Mer' : 'Wed',
    thursday: lang === 'fr' ? 'Jeu' : 'Thu',
    friday: lang === 'fr' ? 'Ven' : 'Fri',
    saturday: lang === 'fr' ? 'Sam' : 'Sat',
    sunday: lang === 'fr' ? 'Dim' : 'Sun',
  };

  const updateDay = (day: string, update: Partial<DaySchedule>) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], ...update }
    }));
  };

  const updateSlot = (day: string, idx: number, field: 'start' | 'end', val: string) => {
    setSchedule(prev => {
      const newSlots = [...prev[day].slots];
      newSlots[idx] = { ...newSlots[idx], [field]: val };
      return { ...prev, [day]: { ...prev[day], slots: newSlots } };
    });
  };

  const addSlot = (day: string) => {
    setSchedule(prev => {
      const lastSlot = prev[day].slots[prev[day].slots.length - 1];
      const newStart = lastSlot ? lastSlot.end : '14:00';
      return {
        ...prev,
        [day]: { ...prev[day], slots: [...prev[day].slots, { start: newStart, end: '18:00' }] }
      };
    });
  };

  const removeSlot = (day: string, idx: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], slots: prev[day].slots.filter((_, i) => i !== idx) }
    }));
  };

  const copyToOtherDays = (sourceDay: string) => {
    const sourceSlots = schedule[sourceDay].slots;
    setSchedule(prev => {
      const next = { ...prev };
      for (const day of DAY_KEYS) {
        if (day !== sourceDay && prev[day].enabled) {
          next[day] = { ...next[day], slots: sourceSlots.map(s => ({ ...s })) };
        }
      }
      return next;
    });
    setCopySource(sourceDay);
    setTimeout(() => setCopySource(null), 1500);
  };

  return (
    <div className="space-y-3">
      {DAY_KEYS.map(day => (
        <div key={day} className={`rounded-lg border p-3 transition-colors ${schedule[day].enabled ? 'bg-white border-border' : 'bg-muted/30 border-muted'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={schedule[day].enabled}
                onCheckedChange={(v) => {
                  updateDay(day, {
                    enabled: v,
                    slots: v && schedule[day].slots.length === 0 ? [{ start: '09:00', end: '18:00' }] : schedule[day].slots
                  });
                }}
                disabled={disabled}
              />
              <span className={`text-sm font-semibold ${schedule[day].enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {dayLabels[day]}
              </span>
              {!schedule[day].enabled && (
                <span className="text-xs text-muted-foreground ml-1">({t('settings.dayOff')})</span>
              )}
            </div>

            {schedule[day].enabled && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => addSlot(day)}
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3" /> {t('settings.addSlot')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 text-xs gap-1 ${copySource === day ? 'text-green-600' : ''}`}
                  onClick={() => copyToOtherDays(day)}
                  disabled={disabled}
                  title={t('settings.copyToAll')}
                >
                  <Copy className="h-3 w-3" />
                  {copySource === day ? (lang === 'fr' ? 'Copié!' : 'Copied!') : (lang === 'fr' ? 'Copier' : 'Copy')}
                </Button>
              </div>
            )}
          </div>

          {schedule[day].enabled && (
            <div className="space-y-2 ml-10">
              {schedule[day].slots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateSlot(day, idx, 'start', e.target.value)}
                    className="w-[110px] h-8 text-sm"
                    disabled={disabled}
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateSlot(day, idx, 'end', e.target.value)}
                    className="w-[110px] h-8 text-sm"
                    disabled={disabled}
                  />
                  {schedule[day].slots.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                      onClick={() => removeSlot(day, idx)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
