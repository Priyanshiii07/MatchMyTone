export function todayAsDateInputValue(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateAgeFromDob(value, now = new Date()) {
  if (!value) return { age: null, error: "Date of birth is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return { age: null, error: "Enter a valid date of birth." };
  const [year, month, day] = value.split("-").map(Number);
  const dob = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return { age: null, error: "Enter a valid date of birth." };
  if (dob > today) return { age: null, error: "Date of birth cannot be in the future." };
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 0 ? { age } : { age: null, error: "Date of birth produced an invalid age." };
}
