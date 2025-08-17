
// A simple utility to convert an array of objects to a CSV string and trigger a download.
export const exportToCsv = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) {
    // Let the caller handle the user notification.
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')]; // Header row

  data.forEach(row => {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Parses a "YYYY-MM-DD" string into a Date object in the user's local timezone.
 * This prevents the date from shifting by one day due to UTC conversion.
 * @param dateString The date string to parse.
 * @returns A Date object, or null if the input is falsy.
 */
export const parseDateStringAsLocal = (dateString: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  // new Date(year, monthIndex, day)
  return new Date(parts[0], parts[1] - 1, parts[2]);
};
