import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isBefore, startOfDay } from 'date-fns';

export default function CalendarPicker({ selected, onChange, onSelect }) {
  // Support both `onChange` and `onSelect` prop names
  const handleSelect = onChange || onSelect;
  const [view, setView] = useState(selected || new Date());
  const today = startOfDay(new Date());

  useEffect(() => {
    if (selected) setView(selected);
  }, [selected]);

  const start = startOfWeek(startOfMonth(view), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(view), { weekStartsOn: 1 });

  const days = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  return (
    <div className="rounded-[28px] border border-[#ead1d7] bg-white p-5 md:p-6 shadow-sm select-none">
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={() => setView((v) => subMonths(v, 1))} className="w-10 h-10 rounded-full border border-[#ead1d7] flex items-center justify-center text-[#7d5f66] hover:bg-[#faf3f4] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="font-display text-2xl text-[#171314]">{format(view, 'MMMM yyyy')}</p>
        <button type="button" onClick={() => setView((v) => addMonths(v, 1))} className="w-10 h-10 rounded-full border border-[#ead1d7] flex items-center justify-center text-[#7d5f66] hover:bg-[#faf3f4] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <div key={d} className="text-center text-[#9a7b82] text-[11px] font-medium py-1 uppercase tracking-[0.18em]">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const past = isBefore(startOfDay(day), today);
          const isSelected = selected && isSameDay(day, selected);
          const inMonth = isSameMonth(day, view);
          const isToday = isSameDay(day, today);

          return (
            <button
              type="button"
              key={i}
              disabled={past || !inMonth}
              onClick={() => handleSelect && handleSelect(day)}
              className={`aspect-square rounded-2xl flex items-center justify-center text-sm transition-all ${!inMonth ? 'opacity-0 pointer-events-none' : ''} ${past && inMonth ? 'text-[#d0c4c7] cursor-not-allowed' : 'text-[#3d3335] hover:bg-[#f7e6e9]'} ${isSelected ? '!bg-[#1a1a1a] !text-white shadow-md' : ''} ${isToday && !isSelected ? 'border border-[#e7b7bf]' : 'border border-transparent'}`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 pt-4 border-t border-[#f0d9de] text-center">
          <p className="text-[#8c5a65] text-xs font-medium tracking-[0.18em] uppercase">{format(selected, 'EEEE, dd MMMM yyyy')}</p>
        </div>
      )}
    </div>
  );
}
