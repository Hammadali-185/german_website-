export function googleDirectionsUrl(latitude: number, longitude: number) {
  const destination = `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function googleMapEmbedUrl(latitude: number, longitude: number) {
  const query = `${latitude},${longitude}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&hl=de&output=embed`;
}
