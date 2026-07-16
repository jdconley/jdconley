export function resultCopy(gainedHours) {
  const magnitude = Math.abs(gainedHours);
  if (gainedHours > 0) {
    return {
      heading: "More useful light with these settings",
      metric: `+${magnitude} hours`,
      detail: "more useful daylight than current clock policy across your waking hours this year"
    };
  }
  if (gainedHours < 0) {
    return {
      heading: "Less useful light with these settings",
      metric: `−${magnitude} hours`,
      detail: "less useful daylight than current clock policy across your waking hours this year"
    };
  }
  return {
    heading: "The same useful light with these settings",
    metric: "0 hours",
    detail: "difference from current clock policy across your waking hours this year"
  };
}
