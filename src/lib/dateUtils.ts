/** Returns today's date as YYYY-MM-DD (for date input min attribute) */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Time slots in 30-minute increments from startHour to endHour (inclusive) */
export const timeSlots = (startHour = 7, endHour = 21): string[] => {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < endHour) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
};

export const TIME_SLOTS = timeSlots();
